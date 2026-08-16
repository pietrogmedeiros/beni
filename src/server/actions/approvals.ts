"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { withBase } from "@/lib/base-path";
import { avisarDecisaoDeAprovacao } from "@/server/notify";
import { registrarAcao } from "@/server/actions/telemetria";
import { currentWorkspace, requireUser } from "@/lib/auth";

const APPROVAL_TTL_DAYS = 30;

async function assertTask(taskId: string) {
  const workspace = await currentWorkspace();
  const task = await db.task.findFirst({
    where: { id: taskId, project: { workspaceId: workspace.id } },
  });
  if (!task) throw new Error("Tarefa não encontrada");
  return task;
}

/** Monta a URL pública a partir do host da requisição. */
async function publicUrlFor(token: string) {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}${withBase(`/aprovar/${token}`)}`;
}

/**
 * Cria (ou reaproveita) um pedido de aprovação e devolve o link público.
 * Qualquer pessoa com o link pode decidir — por isso o token é aleatório
 * de 32 bytes e o pedido expira em 30 dias.
 */
export async function requestApproval(input: {
  taskId: string;
  message?: string | null;
}) {
  void registrarAcao("aprovacao.pedir");
  const task = await assertTask(input.taskId);
  const user = await requireUser();

  const pending = await db.approval.findFirst({
    where: { taskId: task.id, status: "PENDING" },
  });
  if (pending) {
    return { token: pending.token, url: await publicUrlFor(pending.token) };
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + APPROVAL_TTL_DAYS);

  const approval = await db.approval.create({
    data: {
      taskId: task.id,
      token: randomBytes(32).toString("base64url"),
      requestedById: user.id,
      message: input.message?.trim() || null,
      expiresAt,
    },
  });

  await db.activity.create({
    data: {
      projectId: task.projectId,
      taskId: task.id,
      userId: user.id,
      action: "approval.requested",
      meta: {} as never,
    },
  });

  revalidatePath("/", "layout");
  return { token: approval.token, url: await publicUrlFor(approval.token) };
}

export async function cancelApproval(approvalId: string) {
  const workspace = await currentWorkspace();
  const approval = await db.approval.findFirst({
    where: { id: approvalId, task: { project: { workspaceId: workspace.id } } },
  });
  if (!approval) throw new Error("Pedido não encontrado");
  await db.approval.delete({ where: { id: approvalId } });
  revalidatePath("/", "layout");
}

export async function getApprovalUrl(token: string) {
  return publicUrlFor(token);
}

/* ————— Área pública (sem autenticação) ————— */

export type PublicApproval = NonNullable<
  Awaited<ReturnType<typeof loadPublicApproval>>
>;

/** Carrega o pedido a partir do token. Expõe só o necessário ao aprovador. */
export async function loadPublicApproval(token: string) {
  const approval = await db.approval.findUnique({
    where: { token },
    include: {
      requestedBy: { select: { name: true, email: true } },
      task: {
        include: {
          status: true,
          assignee: { select: { name: true, avatarColor: true } },
          project: { select: { name: true, key: true, color: true } },
        },
      },
    },
  });
  if (!approval) return null;

  const expired =
    !!approval.expiresAt &&
    approval.status === "PENDING" &&
    approval.expiresAt < new Date();

  return {
    id: approval.id,
    status: approval.status as string,
    message: approval.message,
    expired,
    expiresAt: approval.expiresAt?.toISOString() ?? null,
    createdAt: approval.createdAt.toISOString(),
    approverName: approval.approverName,
    approverComment: approval.approverComment,
    decidedAt: approval.decidedAt?.toISOString() ?? null,
    requestedBy: approval.requestedBy,
    task: {
      id: approval.task.id,
      number: approval.task.number,
      title: approval.task.title,
      // a descrição **não** vai: ela é anotação interna da equipe, e o link de
      // aprovação abre para gente de fora. Esconder na tela não bastaria — o
      // texto viajaria no conteúdo da página e bastaria abrir o inspetor.
      type: approval.task.type as string,
      priority: approval.task.priority as string,
      dueDate: approval.task.dueDate?.toISOString() ?? null,
      statusName: approval.task.status.name,
      statusColor: approval.task.status.color,
      assignee: approval.task.assignee,
      project: approval.task.project,
    },
  };
}

const decisionSchema = z.object({
  token: z.string().min(10),
  decision: z.enum(["APPROVED", "REJECTED"]),
  approverName: z.string().min(2, "Informe seu nome completo"),
  approverEmail: z.string().email("E-mail inválido").optional().or(z.literal("")),
  approverComment: z.string().optional(),
});

export type DecisionState = { error?: string; ok?: boolean } | undefined;

/**
 * Registra a decisão do stakeholder. Não exige login: a identidade fica
 * registrada pelo nome (e e-mail, se informado) mais data e hora.
 */
export async function decideApproval(
  _prev: DecisionState,
  formData: FormData,
): Promise<DecisionState> {
  const parsed = decisionSchema.safeParse({
    token: String(formData.get("token") ?? ""),
    decision: String(formData.get("decision") ?? ""),
    approverName: String(formData.get("approverName") ?? "").trim(),
    approverEmail: String(formData.get("approverEmail") ?? "").trim(),
    approverComment: String(formData.get("approverComment") ?? "").trim(),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const approval = await db.approval.findUnique({
    where: { token: parsed.data.token },
    include: { task: true },
  });
  if (!approval) return { error: "Pedido de aprovação não encontrado" };
  if (approval.status !== "PENDING") {
    return { error: "Este pedido já foi respondido" };
  }
  if (approval.expiresAt && approval.expiresAt < new Date()) {
    return { error: "Este link de aprovação expirou" };
  }

  await db.approval.update({
    where: { id: approval.id },
    data: {
      status: parsed.data.decision,
      approverName: parsed.data.approverName,
      approverEmail: parsed.data.approverEmail || null,
      approverComment: parsed.data.approverComment || null,
      decidedAt: new Date(),
    },
  });

  await db.activity.create({
    data: {
      projectId: approval.task.projectId,
      taskId: approval.taskId,
      action:
        parsed.data.decision === "APPROVED"
          ? "approval.approved"
          : "approval.rejected",
      meta: { approverName: parsed.data.approverName } as never,
    },
  });

  // quem pediu a aprovação precisa saber da decisão sem ficar recarregando
  void avisarDecisaoDeAprovacao(approval.id);

  revalidatePath(`/aprovar/${parsed.data.token}`);
  revalidatePath("/", "layout");
  return { ok: true };
}

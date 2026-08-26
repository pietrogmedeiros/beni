"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { filtroDeProjetos } from "@/server/escopo";
import { withBase } from "@/lib/base-path";
import {getSession, requireUser } from "@/lib/auth";
import { toTaskDTO } from "@/server/queries";
import { registrarAcao } from "@/server/actions/telemetria";

const SHARE_TTL_DAYS = 90;

async function assertProject(projectId: string) {
  const project = await db.project.findFirst({
    where: { id: projectId, ...(await filtroDeProjetos()) },
  });
  if (!project) throw new Error("Projeto não encontrado");
  return project;
}

async function publicUrlFor(token: string) {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}${withBase(`/compartilhar/${token}`)}`;
}

/* ————— Gestão do link (área autenticada) ————— */

export async function getOrCreateProjectShare(projectId: string) {
  const project = await assertProject(projectId);
  const user = await requireUser();

  const existing = await db.projectShare.findFirst({
    where: { projectId: project.id, view: "gantt" },
    orderBy: { createdAt: "desc" },
  });

  if (existing && (!existing.expiresAt || existing.expiresAt > new Date())) {
    return {
      id: existing.id,
      token: existing.token,
      allowComments: existing.allowComments,
      expiresAt: existing.expiresAt?.toISOString() ?? null,
      url: await publicUrlFor(existing.token),
    };
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SHARE_TTL_DAYS);

  // só aqui: a função também é chamada para *ler* o link existente, e contar
  // isso como criação inflaria justamente o número que decide o teto do plano
  void registrarAcao("link.criar");

  const share = await db.projectShare.create({
    data: {
      projectId: project.id,
      token: randomBytes(32).toString("base64url"),
      view: "gantt",
      createdById: user.id,
      expiresAt,
    },
  });

  revalidatePath("/", "layout");
  return {
    id: share.id,
    token: share.token,
    allowComments: share.allowComments,
    expiresAt: share.expiresAt?.toISOString() ?? null,
    url: await publicUrlFor(share.token),
  };
}

export async function findProjectShare(projectId: string) {
  await assertProject(projectId);
  const share = await db.projectShare.findFirst({
    where: { projectId, view: "gantt" },
    orderBy: { createdAt: "desc" },
  });
  if (!share) return null;
  return {
    id: share.id,
    token: share.token,
    allowComments: share.allowComments,
    expiresAt: share.expiresAt?.toISOString() ?? null,
    url: await publicUrlFor(share.token),
  };
}

export async function setShareComments(shareId: string, allowComments: boolean) {
  const share = await db.projectShare.findFirst({
    where: { id: shareId, project: await filtroDeProjetos() },
  });
  if (!share) throw new Error("Link não encontrado");
  await db.projectShare.update({
    where: { id: shareId },
    data: { allowComments },
  });
  revalidatePath("/", "layout");
}

export async function revokeProjectShare(shareId: string) {
  await db.projectShare.deleteMany({
    where: { id: shareId, project: await filtroDeProjetos() },
  });
  revalidatePath("/", "layout");
}

/* ————— Área pública ————— */

async function resolveShare(token: string) {
  const share = await db.projectShare.findUnique({
    where: { token },
    include: { createdBy: { select: { name: true } } },
  });
  if (!share) return null;
  if (share.expiresAt && share.expiresAt < new Date()) return null;
  return share;
}

export async function loadSharedGantt(token: string) {
  const share = await resolveShare(token);
  if (!share) return null;

  const [project, tasks, dependencies] = await Promise.all([
    db.project.findUnique({
      where: { id: share.projectId },
      select: { id: true, name: true, key: true, color: true, icon: true },
    }),
    db.task.findMany({
      where: { projectId: share.projectId, archived: false },
      include: {
        status: true,
        assignee: true,
        project: { select: { key: true, name: true, color: true } },
        tags: { include: { tag: true } },
        subtasks: { select: { id: true, status: { select: { category: true } } } },
        _count: { select: { comments: true, blockedBy: true } },
      },
      orderBy: [{ order: "asc" }],
    }),
    db.dependency.findMany({
      where: { task: { projectId: share.projectId } },
      select: { taskId: true, dependsOnId: true },
    }),
  ]);

  if (!project) return null;

  return {
    project,
    allowComments: share.allowComments,
    sharedBy: share.createdBy?.name ?? null,
    expiresAt: share.expiresAt?.toISOString() ?? null,
    tasks: tasks.map(toTaskDTO),
    dependencies,
  };
}

export type SharedGantt = NonNullable<Awaited<ReturnType<typeof loadSharedGantt>>>;

/** Detalhe leve de uma tarefa + comentários, para o painel do link público. */
export async function loadSharedTaskThread(token: string, taskId: string) {
  const share = await resolveShare(token);
  if (!share) return null;

  const task = await db.task.findFirst({
    where: { id: taskId, projectId: share.projectId },
    include: {
      status: true,
      assignee: { select: { name: true, avatarColor: true } },
      comments: {
        include: { author: { select: { name: true, avatarColor: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!task) return null;

  return {
    id: task.id,
    number: task.number,
    title: task.title,
    description: task.description,
    type: task.type as string,
    priority: task.priority as string,
    statusName: task.status.name,
    statusColor: task.status.color,
    startDate: task.startDate?.toISOString() ?? null,
    dueDate: task.dueDate?.toISOString() ?? null,
    progress: task.progress,
    assignee: task.assignee,
    allowComments: share.allowComments,
    comments: task.comments.map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      isGuest: !c.author,
      name: c.author?.name ?? c.guestName ?? "Visitante",
      avatarColor: c.author?.avatarColor ?? "#94a3b8",
    })),
  };
}

export type SharedTaskThread = NonNullable<
  Awaited<ReturnType<typeof loadSharedTaskThread>>
>;

const guestCommentSchema = z.object({
  token: z.string().min(10),
  taskId: z.string().min(1),
  name: z.string().min(2, "Informe seu nome"),
  email: z.string().email("Informe um e-mail válido"),
  body: z.string().min(1, "Escreva um comentário"),
});

export type GuestCommentState = { error?: string; ok?: boolean } | undefined;

/**
 * Comentário vindo do link público.
 * Se a pessoa estiver logada, usa a conta dela; senão, exige nome e e-mail.
 */
export async function addSharedComment(
  _prev: GuestCommentState,
  formData: FormData,
): Promise<GuestCommentState> {
  const session = await getSession();

  const raw = {
    token: String(formData.get("token") ?? ""),
    taskId: String(formData.get("taskId") ?? ""),
    name: String(formData.get("name") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    body: String(formData.get("body") ?? "").trim(),
  };

  // logado: nome e e-mail vêm da conta
  const parsed = guestCommentSchema.safeParse(
    session ? { ...raw, name: session.name, email: session.email } : raw,
  );
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const share = await resolveShare(parsed.data.token);
  if (!share) return { error: "Este link não está mais disponível" };
  if (!share.allowComments) {
    return { error: "Os comentários foram desativados neste link" };
  }

  const task = await db.task.findFirst({
    where: { id: parsed.data.taskId, projectId: share.projectId },
  });
  if (!task) return { error: "Item não encontrado" };

  await db.comment.create({
    data: {
      taskId: task.id,
      authorId: session?.userId ?? null,
      guestName: session ? null : parsed.data.name,
      guestEmail: session ? null : parsed.data.email,
      body: parsed.data.body,
    },
  });

  await db.activity.create({
    data: {
      projectId: task.projectId,
      taskId: task.id,
      userId: session?.userId ?? null,
      action: "comment.added",
      meta: session ? {} : ({ guest: parsed.data.name } as never),
    },
  });

  revalidatePath(`/compartilhar/${parsed.data.token}`);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Nome e e-mail preenchidos automaticamente quando há sessão ativa. */
export async function currentVisitor() {
  const session = await getSession();
  return session ? { name: session.name, email: session.email } : null;
}

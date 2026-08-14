"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { currentWorkspace, requireUser } from "@/lib/auth";
import {
  MAX_FEEDBACK_IMAGES,
  MAX_FEEDBACK_LENGTH,
  type FeedbackKindValue,
  type FeedbackStatusValue,
} from "@/lib/feedback";
import {
  avisarAutorDoStatus,
  avisarFeedbackNovo,
  buildStamp,
  isFeedbackAdmin,
} from "@/server/feedback";
import { syncTask } from "@/server/search";

const envio = z.object({
  kind: z.enum(["PROBLEMA", "IDEIA", "ELOGIO", "DUVIDA"]),
  message: z.string().trim().min(3).max(MAX_FEEDBACK_LENGTH),
  /** Prints já enviados pela rota de anexos, ainda sem dono. */
  anexos: z.array(z.string()).max(MAX_FEEDBACK_IMAGES).optional(),
  pageUrl: z.string().max(500).optional(),
  userAgent: z.string().max(300).optional(),
});

export type EnvioFeedback = z.infer<typeof envio>;

/**
 * Recebe o recado.
 *
 * O contexto (página, build, navegador) entra aqui e não no formulário: pedir
 * para a pessoa descrever onde estava é justamente o atrito que faz ela
 * desistir de contar.
 */
export async function enviarFeedback(dados: EnvioFeedback) {
  const user = await requireUser();
  const parsed = envio.safeParse(dados);
  if (!parsed.success) {
    return { ok: false as const, erro: "Escreva pelo menos uma frase." };
  }

  const workspace = user.memberships[0]?.workspace ?? null;

  const feedback = await db.feedback.create({
    data: {
      kind: parsed.data.kind,
      message: parsed.data.message,
      pageUrl: parsed.data.pageUrl ?? null,
      userAgent: parsed.data.userAgent ?? null,
      appBuild: await buildStamp(),
      userId: user.id,
      email: user.email,
      name: user.name,
      workspaceId: workspace?.id ?? null,
    },
  });

  // os prints subiram antes de existir feedback (a rota de anexos aceita
  // arquivo grande, a Server Action não). Só adoto os que estão soltos e são
  // de quem está enviando agora — assim ninguém adota anexo alheio.
  const anexos = parsed.data.anexos ?? [];
  if (anexos.length > 0) {
    await db.attachment.updateMany({
      where: {
        id: { in: anexos },
        uploadedById: user.id,
        taskId: null,
        noteId: null,
        feedbackId: null,
      },
      data: { feedbackId: feedback.id },
    });
  }

  // o convite único não deve voltar para quem já falou
  await db.user.update({
    where: { id: user.id },
    data: { feedbackPromptedAt: new Date() },
  });

  try {
    await avisarFeedbackNovo(feedback.id);
  } catch (error) {
    // aviso é aviso: o recado da pessoa já está guardado
    console.error("[feedback] aviso falhou:", (error as Error).message);
  }

  revalidatePath("/feedback");
  return { ok: true as const };
}

/** A pessoa dispensou o convite. Não volta a aparecer. */
export async function dispensarConvite() {
  const user = await requireUser();
  await db.user.update({
    where: { id: user.id },
    data: { feedbackPromptedAt: new Date() },
  });
}

// ---------------------------------------------------------------- triagem

export type FeedbackDTO = {
  id: string;
  kind: string;
  status: string;
  message: string;
  pageUrl: string | null;
  appBuild: string | null;
  userAgent: string | null;
  autor: { nome: string; email: string };
  workspaceNome: string | null;
  adminNote: string | null;
  respondedAt: string | null;
  taskId: string | null;
  taskRef: string | null;
  imagens: { id: string; url: string; name: string }[];
  createdAt: string;
};

async function exigirTriador() {
  const user = await requireUser();
  if (!(await isFeedbackAdmin(user.email))) throw new Error("SEM_PERMISSAO");
  return user;
}

export async function podeTriar() {
  const user = await requireUser();
  return isFeedbackAdmin(user.email);
}

export async function listarFeedbacks(filtro?: {
  status?: FeedbackStatusValue | "TODOS";
  kind?: FeedbackKindValue | "TODOS";
}): Promise<FeedbackDTO[]> {
  await exigirTriador();

  const rows = await db.feedback.findMany({
    where: {
      status:
        filtro?.status && filtro.status !== "TODOS" ? filtro.status : undefined,
      kind: filtro?.kind && filtro.kind !== "TODOS" ? filtro.kind : undefined,
    },
    include: {
      attachments: { select: { id: true, name: true, mimeType: true } },
      task: { select: { number: true, project: { select: { key: true } } } },
    },
    orderBy: [{ createdAt: "desc" }],
    take: 300,
  });

  // o nome do workspace é buscado em lote: são poucos ids distintos e evita
  // uma consulta por linha
  const ids = [...new Set(rows.map((r) => r.workspaceId).filter(Boolean))] as string[];
  const workspaces = ids.length
    ? await db.workspace.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true },
      })
    : [];
  const nomePorId = new Map(workspaces.map((w) => [w.id, w.name]));

  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    status: r.status,
    message: r.message,
    pageUrl: r.pageUrl,
    appBuild: r.appBuild,
    userAgent: r.userAgent,
    autor: { nome: r.name ?? r.email, email: r.email },
    workspaceNome: r.workspaceId ? (nomePorId.get(r.workspaceId) ?? null) : null,
    adminNote: r.adminNote,
    respondedAt: r.respondedAt?.toISOString() ?? null,
    taskId: r.taskId,
    taskRef: r.task ? `${r.task.project.key}-${r.task.number}` : null,
    imagens: r.attachments
      .filter((a) => a.mimeType.startsWith("image/"))
      .map((a) => ({ id: a.id, url: `/api/attachments/${a.id}`, name: a.name })),
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function contarNovos() {
  const user = await requireUser();
  if (!(await isFeedbackAdmin(user.email))) return 0;
  return db.feedback.count({ where: { status: "NOVO" } });
}

export async function mudarStatus(id: string, status: FeedbackStatusValue) {
  await exigirTriador();
  await db.feedback.update({ where: { id }, data: { status } });
  revalidatePath("/feedback");
}

export async function anotar(id: string, texto: string) {
  await exigirTriador();
  await db.feedback.update({
    where: { id },
    data: { adminNote: texto.slice(0, 2000) || null },
  });
  revalidatePath("/feedback");
}

/**
 * Promove o recado a tarefa no projeto escolhido.
 *
 * É o passo que impede a caixa de virar cemitério: se triar custa um clique,
 * a triagem acontece. A tarefa nasce no workspace de quem promoveu — o
 * conteúdo veio de fora, a tarefa é interna.
 */
export async function virarTarefa(id: string, projectId: string) {
  const user = await exigirTriador();
  const workspace = await currentWorkspace();

  const feedback = await db.feedback.findUnique({ where: { id } });
  if (!feedback) throw new Error("Feedback não encontrado");
  if (feedback.taskId) throw new Error("Este feedback já virou tarefa");

  const project = await db.project.findFirst({
    where: { id: projectId, workspaceId: workspace.id },
    select: { id: true },
  });
  if (!project) throw new Error("Projeto não encontrado");

  const status = await db.taskStatus.findFirst({
    where: { projectId },
    orderBy: { order: "asc" },
  });
  if (!status) throw new Error("Projeto sem status configurado");

  const counter = await db.project.update({
    where: { id: projectId },
    data: { taskCounter: { increment: 1 } },
    select: { taskCounter: true },
  });

  const primeiraLinha = feedback.message.split("\n")[0]!.trim();
  const titulo =
    primeiraLinha.length > 90 ? `${primeiraLinha.slice(0, 87)}…` : primeiraLinha;

  const task = await db.task.create({
    data: {
      projectId,
      number: counter.taskCounter,
      title: titulo || "Feedback",
      description: [
        feedback.message,
        "",
        `— ${feedback.name ?? feedback.email} (${feedback.email})`,
        feedback.pageUrl ? `Estava em: ${feedback.pageUrl}` : null,
      ]
        .filter((l) => l !== null)
        .join("\n"),
      statusId: status.id,
      type: feedback.kind === "PROBLEMA" ? "BUG" : "TASK",
      priority: feedback.kind === "PROBLEMA" ? "HIGH" : "NONE",
      reporterId: user.id,
      order: Date.now(),
    },
  });

  // os prints vão junto: sem eles a tarefa perde a prova do problema
  await db.attachment.updateMany({
    where: { feedbackId: feedback.id },
    data: { taskId: task.id },
  });

  await db.feedback.update({
    where: { id },
    data: { taskId: task.id, status: "PLANEJADO" },
  });

  await syncTask(task.id).catch(() => {});
  revalidatePath("/feedback");
  return { taskId: task.id };
}

/** Responde a quem escreveu, por e-mail. */
export async function responderAoAutor(id: string, texto: string) {
  await exigirTriador();
  const limpo = texto.trim();
  if (limpo.length < 3) return { ok: false as const, erro: "Escreva a resposta." };

  const enviado = await avisarAutorDoStatus(id, limpo);
  revalidatePath("/feedback");
  return enviado
    ? { ok: true as const }
    : { ok: false as const, erro: "O envio de e-mail não está configurado." };
}

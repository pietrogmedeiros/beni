import "server-only";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ApiAuthError, authenticateRequest, type ApiCaller } from "@/server/api-auth";

/**
 * Peças comuns das rotas de API.
 *
 * Cada rota vira uma função curta: o handler cuida de autenticar, capturar
 * erro e responder JSON, e o corpo só descreve o que a rota faz.
 */
export function handler(
  fn: (caller: ApiCaller, request: Request, params: Record<string, string>) => Promise<unknown>,
) {
  return async (
    request: Request,
    context?: { params?: Promise<Record<string, string>> },
  ) => {
    try {
      const caller = await authenticateRequest(request);
      const params = (await context?.params) ?? {};
      const data = await fn(caller, request, params);
      return NextResponse.json(data);
    } catch (error) {
      if (error instanceof ApiAuthError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      const message = error instanceof Error ? error.message : "Erro inesperado";
      // 400 e não 500: quase tudo que chega aqui é pedido malformado
      return NextResponse.json({ error: message }, { status: 400 });
    }
  };
}

/** Garante que o projeto é do workspace de quem chamou. */
export async function projectOf(caller: ApiCaller, projectId: string) {
  const project = await db.project.findFirst({
    where: { id: projectId, workspaceId: caller.workspaceId },
  });
  if (!project) throw new Error(`Projeto ${projectId} não encontrado neste workspace`);
  return project;
}

/** Aceita o id da tarefa ou a referência curta (`WEB-12`). */
export async function taskOf(caller: ApiCaller, idOrRef: string) {
  const ref = idOrRef.match(/^([A-Za-z][\w-]*)-(\d+)$/);

  const task = ref
    ? await db.task.findFirst({
        where: {
          number: Number(ref[2]),
          project: {
            key: { equals: ref[1], mode: "insensitive" },
            workspaceId: caller.workspaceId,
          },
        },
      })
    : await db.task.findFirst({
        where: { id: idOrRef, project: { workspaceId: caller.workspaceId } },
      });

  if (!task) throw new Error(`Tarefa ${idOrRef} não encontrada neste workspace`);
  return task;
}

export const taskShape = {
  status: { select: { name: true, category: true, color: true } },
  assignee: { select: { id: true, name: true, email: true } },
  project: { select: { id: true, key: true, name: true } },
  tags: { include: { tag: { select: { name: true } } } },
  sprint: { select: { id: true, name: true } },
  _count: { select: { subtasks: true, comments: true, attachments: true } },
} as const;

type TaskWithShape = {
  id: string;
  number: number;
  title: string;
  description: string | null;
  type: string;
  priority: string;
  progress: number;
  points: number | null;
  estimate: number | null;
  startDate: Date | null;
  dueDate: Date | null;
  archived: boolean;
  updatedAt: Date;
  parentId: string | null;
  status: { name: string; category: string; color: string };
  assignee: { id: string; name: string; email: string } | null;
  project: { id: string; key: string; name: string };
  tags: { tag: { name: string } }[];
  sprint: { id: string; name: string } | null;
  _count: { subtasks: number; comments: number; attachments: number };
};

/**
 * Formato devolvido pela API.
 *
 * Datas saem como `YYYY-MM-DD` (sem hora) porque prazo é de calendário — a
 * hora só criaria confusão de fuso do outro lado.
 */
export function taskJson(task: TaskWithShape) {
  return {
    id: task.id,
    ref: `${task.project.key}-${task.number}`,
    title: task.title,
    description: task.description,
    status: task.status.name,
    statusCategory: task.status.category,
    type: task.type,
    priority: task.priority,
    progress: task.progress,
    points: task.points,
    estimateHours: task.estimate,
    startDate: task.startDate?.toISOString().slice(0, 10) ?? null,
    dueDate: task.dueDate?.toISOString().slice(0, 10) ?? null,
    assignee: task.assignee ? { name: task.assignee.name, email: task.assignee.email } : null,
    project: { id: task.project.id, key: task.project.key, name: task.project.name },
    sprint: task.sprint?.name ?? null,
    tags: task.tags.map((t) => t.tag.name),
    parentId: task.parentId,
    counts: {
      subtasks: task._count.subtasks,
      comments: task._count.comments,
      attachments: task._count.attachments,
    },
    archived: task.archived,
    updatedAt: task.updatedAt.toISOString(),
  };
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new Error("Corpo da requisição não é JSON válido");
  }
}

import "server-only";
import { db } from "@/lib/db";
import { syncTask } from "@/server/search";
import { projectOf, taskShape } from "@/server/api-core";
import type { ApiCaller } from "@/server/api-auth";
import { PALETTE } from "@/lib/constants";

/**
 * Escrita de tarefas pela API.
 *
 * Não reaproveita as Server Actions de propósito: elas dependem da sessão do
 * navegador (`requireUser`), enquanto aqui quem age é uma chave. As regras de
 * negócio que importam — numeração por projeto, status padrão, ordem — são as
 * mesmas, e ficam neste arquivo para não se espalharem.
 */

export type CreateTaskInput = {
  project?: string;
  projectId?: string;
  title: string;
  description?: string | null;
  status?: string;
  type?: string;
  priority?: string;
  assignee?: string | null;
  dueDate?: string | null;
  startDate?: string | null;
  points?: number | null;
  estimateHours?: number | null;
  tags?: string[];
  parent?: string | null;
};

/** Data de calendário: monta ao meio-dia para não escorregar de fuso. */
function calendarDate(value?: string | null) {
  if (!value) return null;
  const iso = value.slice(0, 10);
  return new Date(`${iso}T12:00:00.000Z`);
}

async function resolveProject(caller: ApiCaller, input: CreateTaskInput) {
  if (input.projectId) return projectOf(caller, input.projectId);

  const hint = input.project?.trim();
  if (!hint) throw new Error("Informe o projeto (id, chave como WEB, ou nome)");

  const project =
    (await db.project.findFirst({
      where: { workspaceId: caller.workspaceId, key: { equals: hint, mode: "insensitive" } },
    })) ??
    (await db.project.findFirst({
      where: { workspaceId: caller.workspaceId, id: hint },
    })) ??
    (await db.project.findFirst({
      where: { workspaceId: caller.workspaceId, name: { contains: hint, mode: "insensitive" } },
    }));

  if (!project) throw new Error(`Projeto "${hint}" não encontrado neste workspace`);
  return project;
}

async function resolveAssignee(caller: ApiCaller, hint?: string | null) {
  if (hint === null) return null;
  if (!hint) return undefined;

  const members = await db.membership.findMany({
    where: { workspaceId: caller.workspaceId },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  const needle = hint.trim().toLowerCase();
  const match =
    members.find((m) => m.user.email.toLowerCase() === needle) ??
    members.find((m) => m.user.name.toLowerCase() === needle) ??
    members.find((m) => m.user.name.toLowerCase().includes(needle));

  if (!match) throw new Error(`Ninguém no time corresponde a "${hint}"`);
  return match.user.id;
}

async function resolveStatus(projectId: string, name?: string) {
  if (!name) {
    const first = await db.taskStatus.findFirst({ where: { projectId }, orderBy: { order: "asc" } });
    if (!first) throw new Error("Projeto sem status configurado");
    return first;
  }

  const status = await db.taskStatus.findFirst({
    where: { projectId, name: { equals: name, mode: "insensitive" } },
  });
  if (!status) {
    const todos = await db.taskStatus.findMany({ where: { projectId }, orderBy: { order: "asc" } });
    throw new Error(
      `Status "${name}" não existe neste projeto. Disponíveis: ${todos.map((s) => s.name).join(", ")}`,
    );
  }
  return status;
}

async function resolveTags(caller: ApiCaller, names?: string[]) {
  if (!names?.length) return [];
  const ids: string[] = [];
  for (const name of names) {
    const existing = await db.tag.findFirst({
      where: { workspaceId: caller.workspaceId, name: { equals: name, mode: "insensitive" } },
    });
    const tag =
      existing ??
      (await db.tag.create({
        data: {
          workspaceId: caller.workspaceId,
          name,
          color: PALETTE[ids.length % PALETTE.length],
        },
      }));
    ids.push(tag.id);
  }
  return ids;
}

export async function createTaskViaApi(caller: ApiCaller, input: CreateTaskInput) {
  if (!input.title?.trim()) throw new Error("Informe o título da tarefa");

  const project = await resolveProject(caller, input);
  const status = await resolveStatus(project.id, input.status);
  const assigneeId = await resolveAssignee(caller, input.assignee);
  const tagIds = await resolveTags(caller, input.tags);

  const last = await db.task.findFirst({
    where: { projectId: project.id, statusId: status.id },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  const counter = await db.project.update({
    where: { id: project.id },
    data: { taskCounter: { increment: 1 } },
    select: { taskCounter: true },
  });

  const parent = input.parent
    ? await db.task.findFirst({
        where: { id: input.parent, project: { workspaceId: caller.workspaceId } },
        select: { id: true },
      })
    : null;

  const task = await db.task.create({
    data: {
      projectId: project.id,
      number: counter.taskCounter,
      title: input.title.trim().slice(0, 200),
      description: input.description ?? null,
      statusId: status.id,
      type: (input.type ?? "TASK").toUpperCase() as never,
      priority: (input.priority ?? "NONE").toUpperCase() as never,
      assigneeId: assigneeId ?? null,
      reporterId: caller.userId,
      parentId: parent?.id ?? null,
      startDate: calendarDate(input.startDate),
      dueDate: calendarDate(input.dueDate),
      points: input.points ?? null,
      estimate: input.estimateHours ?? null,
      progress: status.category === "DONE" ? 100 : 0,
      completedAt: status.category === "DONE" ? new Date() : null,
      order: (last?.order ?? 0) + 1000,
      tags: tagIds.length ? { create: tagIds.map((tagId) => ({ tagId })) } : undefined,
    },
    include: taskShape,
  });

  await db.activity.create({
    data: {
      projectId: project.id,
      taskId: task.id,
      userId: caller.userId,
      action: "task.created",
      meta: { title: task.title, via: "api" } as never,
    },
  });

  void syncTask(task.id);
  return task;
}

export type UpdateTaskInput = Partial<{
  title: string;
  description: string | null;
  status: string;
  type: string;
  priority: string;
  assignee: string | null;
  dueDate: string | null;
  startDate: string | null;
  points: number | null;
  estimateHours: number | null;
  progress: number;
  archived: boolean;
}>;

export async function updateTaskViaApi(
  caller: ApiCaller,
  taskId: string,
  input: UpdateTaskInput,
) {
  const current = await db.task.findFirst({
    where: { id: taskId, project: { workspaceId: caller.workspaceId } },
    select: { id: true, projectId: true },
  });
  if (!current) throw new Error("Tarefa não encontrada");

  const status = input.status ? await resolveStatus(current.projectId, input.status) : null;
  const assigneeId =
    input.assignee !== undefined ? await resolveAssignee(caller, input.assignee) : undefined;

  const task = await db.task.update({
    where: { id: current.id },
    data: {
      title: input.title?.trim().slice(0, 200),
      description: input.description,
      statusId: status?.id,
      type: input.type ? (input.type.toUpperCase() as never) : undefined,
      priority: input.priority ? (input.priority.toUpperCase() as never) : undefined,
      assigneeId: assigneeId === undefined ? undefined : assigneeId,
      startDate: input.startDate === undefined ? undefined : calendarDate(input.startDate),
      dueDate: input.dueDate === undefined ? undefined : calendarDate(input.dueDate),
      points: input.points,
      estimate: input.estimateHours,
      progress: status?.category === "DONE" ? 100 : input.progress,
      completedAt: status ? (status.category === "DONE" ? new Date() : null) : undefined,
      archived: input.archived,
    },
    include: taskShape,
  });

  await db.activity.create({
    data: {
      projectId: current.projectId,
      taskId: task.id,
      userId: caller.userId,
      action: "task.updated",
      meta: { fields: Object.keys(input), via: "api" } as never,
    },
  });

  void syncTask(task.id);
  return task;
}

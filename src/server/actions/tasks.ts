"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { currentWorkspace, requireUser } from "@/lib/auth";
import { removeTaskFromIndex, syncTask } from "@/server/search";
import { registrarAcao } from "@/server/actions/telemetria";
import { avisarAtribuicao } from "@/server/notify";

async function assertProject(projectId: string) {
  const workspace = await currentWorkspace();
  const project = await db.project.findFirst({
    where: { id: projectId, workspaceId: workspace.id },
  });
  if (!project) throw new Error("Projeto não encontrado");
  return project;
}

async function assertTask(taskId: string) {
  const workspace = await currentWorkspace();
  const task = await db.task.findFirst({
    where: { id: taskId, project: { workspaceId: workspace.id } },
    include: { status: true },
  });
  if (!task) throw new Error("Tarefa não encontrada");
  return task;
}

async function logActivity(
  projectId: string,
  taskId: string | null,
  action: string,
  meta?: Record<string, unknown>,
) {
  const user = await requireUser();
  await db.activity.create({
    data: {
      projectId,
      taskId,
      userId: user.id,
      action,
      meta: (meta ?? {}) as never,
    },
  });
}

const createSchema = z.object({
  projectId: z.string(),
  title: z.string().min(1, "Informe um título"),
  description: z.string().optional().nullable(),
  statusId: z.string().optional().nullable(),
  sprintId: z.string().optional().nullable(),
  parentId: z.string().optional().nullable(),
  type: z.string().optional(),
  priority: z.string().optional(),
  assigneeId: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  estimate: z.number().optional().nullable(),
  points: z.number().optional().nullable(),
  tagIds: z.array(z.string()).optional(),
  order: z.number().optional(),
});

export type CreateTaskInput = z.input<typeof createSchema>;

export async function createTask(input: CreateTaskInput) {
  void registrarAcao("tarefa.criar");
  const data = createSchema.parse(input);
  const project = await assertProject(data.projectId);
  const user = await requireUser();

  let statusId = data.statusId;
  if (!statusId) {
    const first = await db.taskStatus.findFirst({
      where: { projectId: project.id },
      orderBy: { order: "asc" },
    });
    if (!first) throw new Error("Projeto sem status configurado");
    statusId = first.id;
  }

  const order =
    data.order ??
    ((
      await db.task.findFirst({
        where: { projectId: project.id, statusId },
        orderBy: { order: "desc" },
        select: { order: true },
      })
    )?.order ?? 0) + 1000;

  const updated = await db.project.update({
    where: { id: project.id },
    data: { taskCounter: { increment: 1 } },
    select: { taskCounter: true },
  });

  const status = await db.taskStatus.findUnique({ where: { id: statusId } });

  const task = await db.task.create({
    data: {
      projectId: project.id,
      number: updated.taskCounter,
      title: data.title,
      description: data.description || null,
      statusId,
      sprintId: data.sprintId || null,
      parentId: data.parentId || null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type: (data.type as any) || "TASK",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      priority: (data.priority as any) || "NONE",
      assigneeId: data.assigneeId || null,
      reporterId: user.id,
      startDate: data.startDate ? new Date(data.startDate) : null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      estimate: data.estimate ?? null,
      points: data.points ?? null,
      order,
      completedAt: status?.category === "DONE" ? new Date() : null,
      progress: status?.category === "DONE" ? 100 : 0,
      tags: data.tagIds?.length
        ? { create: data.tagIds.map((tagId) => ({ tagId })) }
        : undefined,
    },
  });

  await logActivity(project.id, task.id, "task.created", { title: task.title });
  if (task.assigneeId) void avisarAtribuicao(task.id, user.id);
  void syncTask(task.id);
  revalidatePath("/", "layout");
  return { id: task.id, number: task.number };
}

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  statusId: z.string().optional(),
  sprintId: z.string().nullable().optional(),
  type: z.string().optional(),
  priority: z.string().optional(),
  assigneeId: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  estimate: z.number().nullable().optional(),
  points: z.number().nullable().optional(),
  progress: z.number().min(0).max(100).optional(),
  archived: z.boolean().optional(),
  order: z.number().optional(),
});

export type UpdateTaskInput = z.input<typeof updateSchema>;

export async function updateTask(taskId: string, input: UpdateTaskInput) {
  const task = await assertTask(taskId);
  const data = updateSchema.parse(input);
  const quem = await requireUser();

  let completedAt = undefined as Date | null | undefined;
  let progress = data.progress;

  if (data.statusId && data.statusId !== task.statusId) {
    const next = await db.taskStatus.findUnique({ where: { id: data.statusId } });
    if (!next || next.projectId !== task.projectId) {
      throw new Error("Status inválido para este projeto");
    }
    if (next.category === "DONE") {
      completedAt = new Date();
      if (progress === undefined) progress = 100;
    } else if (task.status.category === "DONE") {
      completedAt = null;
      if (progress === undefined) progress = 0;
    }
    await logActivity(task.projectId, task.id, "task.status_changed", {
      from: task.status.name,
      to: next.name,
    });
  }

  const anterior = await db.task.findUnique({
    where: { id: taskId },
    select: { assigneeId: true },
  });

  await db.task.update({
    where: { id: taskId },
    data: {
      ...data,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type: data.type as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      priority: data.priority as any,
      progress,
      completedAt,
      startDate:
        data.startDate !== undefined
          ? data.startDate
            ? new Date(data.startDate)
            : null
          : undefined,
      dueDate:
        data.dueDate !== undefined
          ? data.dueDate
            ? new Date(data.dueDate)
            : null
          : undefined,
    },
  });

  // avisar por e-mail quem passou a ser responsável — sem segurar a resposta
  if (data.assigneeId !== undefined && data.assigneeId !== anterior?.assigneeId) {
    void avisarAtribuicao(taskId, quem.id);
  }

  void syncTask(taskId);
  revalidatePath("/", "layout");
}

/** Move uma tarefa entre colunas do kanban / posições da lista. */
export async function moveTask(input: {
  taskId: string;
  statusId?: string;
  sprintId?: string | null;
  beforeId?: string | null;
  afterId?: string | null;
}) {
  const task = await assertTask(input.taskId);

  const neighborOrders = await Promise.all([
    input.beforeId
      ? db.task.findUnique({
          where: { id: input.beforeId },
          select: { order: true },
        })
      : null,
    input.afterId
      ? db.task.findUnique({
          where: { id: input.afterId },
          select: { order: true },
        })
      : null,
  ]);

  const before = neighborOrders[0]?.order ?? null;
  const after = neighborOrders[1]?.order ?? null;

  let order: number;
  if (before == null && after == null) order = 1000;
  else if (before == null) order = (after as number) - 1000;
  else if (after == null) order = before + 1000;
  else order = (before + after) / 2;

  const patch: Record<string, unknown> = { order };

  if (input.statusId && input.statusId !== task.statusId) {
    const next = await db.taskStatus.findUnique({
      where: { id: input.statusId },
    });
    if (!next || next.projectId !== task.projectId) {
      throw new Error("Status inválido");
    }
    patch.statusId = next.id;
    if (next.category === "DONE") {
      patch.completedAt = new Date();
      patch.progress = 100;
    } else if (task.status.category === "DONE") {
      patch.completedAt = null;
      patch.progress = 0;
    }
    await logActivity(task.projectId, task.id, "task.status_changed", {
      from: task.status.name,
      to: next.name,
    });
  }

  if (input.sprintId !== undefined) {
    patch.sprintId = input.sprintId;
  }

  await db.task.update({ where: { id: input.taskId }, data: patch });
  void syncTask(input.taskId);
  revalidatePath("/", "layout");
}

/** Ajusta datas via drag/resize no Gantt. */
export async function rescheduleTask(input: {
  taskId: string;
  startDate: string | null;
  dueDate: string | null;
}) {
  await assertTask(input.taskId);
  await db.task.update({
    where: { id: input.taskId },
    data: {
      startDate: input.startDate ? new Date(input.startDate) : null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
    },
  });
  revalidatePath("/", "layout");
}

export async function toggleTaskDone(taskId: string) {
  const task = await assertTask(taskId);
  const statuses = await db.taskStatus.findMany({
    where: { projectId: task.projectId },
    orderBy: { order: "asc" },
  });
  const done = statuses.find((s) => s.category === "DONE");
  const todo =
    statuses.find((s) => s.category === "TODO") ??
    statuses.find((s) => s.category === "BACKLOG") ??
    statuses[0];

  const isDone = task.status.category === "DONE";
  const target = isDone ? todo : done;
  if (!target) return;

  await db.task.update({
    where: { id: taskId },
    data: {
      statusId: target.id,
      completedAt: isDone ? null : new Date(),
      progress: isDone ? 0 : 100,
    },
  });
  revalidatePath("/", "layout");
}

export async function deleteTask(taskId: string) {
  const task = await assertTask(taskId);
  await db.task.delete({ where: { id: taskId } });
  await logActivity(task.projectId, null, "task.deleted", { title: task.title });
  void removeTaskFromIndex(taskId);
  revalidatePath("/", "layout");
}

export async function duplicateTask(taskId: string) {
  const task = await assertTask(taskId);
  const full = await db.task.findUnique({
    where: { id: taskId },
    include: { tags: true },
  });
  if (!full) return;

  const updated = await db.project.update({
    where: { id: task.projectId },
    data: { taskCounter: { increment: 1 } },
    select: { taskCounter: true },
  });

  await db.task.create({
    data: {
      projectId: full.projectId,
      number: updated.taskCounter,
      title: `${full.title} (cópia)`,
      description: full.description,
      statusId: full.statusId,
      sprintId: full.sprintId,
      parentId: full.parentId,
      type: full.type,
      priority: full.priority,
      assigneeId: full.assigneeId,
      startDate: full.startDate,
      dueDate: full.dueDate,
      estimate: full.estimate,
      points: full.points,
      order: full.order + 1,
      tags: { create: full.tags.map((t) => ({ tagId: t.tagId })) },
    },
  });
  revalidatePath("/", "layout");
}

export async function setTaskTags(taskId: string, tagIds: string[]) {
  await assertTask(taskId);
  await db.$transaction([
    db.taskTag.deleteMany({ where: { taskId } }),
    db.taskTag.createMany({
      data: tagIds.map((tagId) => ({ taskId, tagId })),
      skipDuplicates: true,
    }),
  ]);
  void syncTask(taskId);
  revalidatePath("/", "layout");
}

/* ————— Dependências ————— */

export async function addDependency(input: {
  taskId: string;
  dependsOnId: string;
  type?: string;
}) {
  if (input.taskId === input.dependsOnId) {
    throw new Error("Uma tarefa não pode depender dela mesma");
  }
  await assertTask(input.taskId);
  await assertTask(input.dependsOnId);

  // impede ciclo simples
  const reverse = await db.dependency.findFirst({
    where: { taskId: input.dependsOnId, dependsOnId: input.taskId },
  });
  if (reverse) throw new Error("Isso criaria uma dependência circular");

  await db.dependency.upsert({
    where: {
      taskId_dependsOnId: {
        taskId: input.taskId,
        dependsOnId: input.dependsOnId,
      },
    },
    update: {},
    create: {
      taskId: input.taskId,
      dependsOnId: input.dependsOnId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type: (input.type as any) || "FINISH_TO_START",
    },
  });
  revalidatePath("/", "layout");
}

export async function removeDependency(id: string) {
  const dep = await db.dependency.findUnique({ where: { id } });
  if (!dep) return;
  await assertTask(dep.taskId);
  await db.dependency.delete({ where: { id } });
  revalidatePath("/", "layout");
}

/* ————— Comentários ————— */

export async function addComment(taskId: string, body: string) {
  const task = await assertTask(taskId);
  const user = await requireUser();
  if (!body.trim()) return;
  await db.comment.create({
    data: { taskId, authorId: user.id, body: body.trim() },
  });
  await logActivity(task.projectId, taskId, "comment.added");
  void syncTask(taskId);
  revalidatePath("/", "layout");
}

export async function deleteComment(commentId: string) {
  const user = await requireUser();
  await db.comment.deleteMany({ where: { id: commentId, authorId: user.id } });
  revalidatePath("/", "layout");
}

/* ————— Ações em lote ————— */

export async function bulkUpdateTasks(
  taskIds: string[],
  input: {
    statusId?: string;
    priority?: string;
    assigneeId?: string | null;
    sprintId?: string | null;
  },
) {
  const workspace = await currentWorkspace();
  const tasks = await db.task.findMany({
    where: { id: { in: taskIds }, project: { workspaceId: workspace.id } },
    select: { id: true },
  });
  const ids = tasks.map((t) => t.id);
  if (!ids.length) return;

  ids.forEach((id) => void syncTask(id));
  await db.task.updateMany({
    where: { id: { in: ids } },
    data: {
      statusId: input.statusId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      priority: input.priority as any,
      assigneeId: input.assigneeId,
      sprintId: input.sprintId,
    },
  });
  revalidatePath("/", "layout");
}

export async function bulkDeleteTasks(taskIds: string[]) {
  const workspace = await currentWorkspace();
  await db.task.deleteMany({
    where: { id: { in: taskIds }, project: { workspaceId: workspace.id } },
  });
  revalidatePath("/", "layout");
}

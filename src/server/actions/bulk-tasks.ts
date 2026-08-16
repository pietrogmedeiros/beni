"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { currentWorkspace, requireUser } from "@/lib/auth";
import {
  detectBulkMode,
  MAX_BULK_TASKS,
  parseBulkTasks,
  type BulkMode,
  type ParsedTask,
} from "@/lib/bulk-parse";
import { syncTask } from "@/server/search";
import { registrarAcao } from "@/server/actions/telemetria";
import { PALETTE } from "@/lib/constants";

export type BulkPreviewTask = ParsedTask & {
  /** Pessoa encontrada a partir do `@apelido`, se houve. */
  assigneeName: string | null;
  assigneeId: string | null;
};

export type BulkPreview = {
  tasks: BulkPreviewTask[];
  /** Apelidos que não casaram com ninguém do time. */
  unknownPeople: string[];
  /** Quantas linhas ficaram de fora por causa do limite. */
  ignored: number;
  /** Formato usado na leitura — a tela mostra e deixa trocar. */
  mode: BulkMode;
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Interpreta o texto e resolve as pessoas, sem gravar nada.
 *
 * Existe para a tela mostrar exatamente o que será criado antes de criar. Um
 * texto colado errado deve virar uma correção, não vinte tarefas para apagar.
 */
export async function previewBulkTasks(
  projectId: string,
  text: string,
  mode: BulkMode | "auto" = "auto",
): Promise<BulkPreview> {
  const workspace = await currentWorkspace();
  const project = await db.project.findFirst({
    where: { id: projectId, workspaceId: workspace.id },
    select: { id: true },
  });
  if (!project) throw new Error("Projeto não encontrado");

  const resolvido = mode === "auto" ? detectBulkMode(text) : mode;
  const todas = parseBulkTasks(text, new Date(), resolvido);
  const parsed = todas.slice(0, MAX_BULK_TASKS);
  const ignored = todas.length - parsed.length;

  const members = await db.membership.findMany({
    where: { workspaceId: workspace.id },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  const unknownPeople: string[] = [];

  const tasks = parsed.map((task) => {
    if (!task.assigneeHint) {
      return { ...task, assigneeId: null, assigneeName: null };
    }

    const hint = normalize(task.assigneeHint);
    const match =
      members.find((m) => normalize(m.user.name) === hint) ??
      members.find((m) => normalize(m.user.email).split("@")[0] === hint) ??
      members.find((m) =>
        normalize(m.user.name).split(" ").some((part) => part === hint),
      ) ??
      members.find((m) => normalize(m.user.name).startsWith(hint));

    if (!match) {
      if (!unknownPeople.includes(task.assigneeHint)) {
        unknownPeople.push(task.assigneeHint);
      }
      return { ...task, assigneeId: null, assigneeName: null };
    }

    return { ...task, assigneeId: match.user.id, assigneeName: match.user.name };
  });

  return { tasks, unknownPeople, ignored, mode: resolvido };
}

/**
 * Cria tudo de uma vez.
 *
 * O texto é reinterpretado aqui em vez de confiar no que o navegador mandou:
 * a pré-visualização é uma cortesia da interface, não a fonte da verdade.
 */
export async function createBulkTasks(
  projectId: string,
  text: string,
  mode: BulkMode | "auto" = "auto",
) {
  void registrarAcao("tarefa.massa");
  const user = await requireUser();
  const workspace = await currentWorkspace();

  const project = await db.project.findFirst({
    where: { id: projectId, workspaceId: workspace.id },
    select: { id: true },
  });
  if (!project) throw new Error("Projeto não encontrado");

  const { tasks } = await previewBulkTasks(projectId, text, mode);
  if (tasks.length === 0) return { created: 0, subtasks: 0 };

  const status = await db.taskStatus.findFirst({
    where: { projectId },
    orderBy: { order: "asc" },
  });
  if (!status) throw new Error("Projeto sem status configurado");

  const lastOrder =
    (
      await db.task.findFirst({
        where: { projectId, statusId: status.id },
        orderBy: { order: "desc" },
        select: { order: true },
      })
    )?.order ?? 0;

  // as etiquetas citadas com #: reaproveita as existentes, cria as que faltam
  const tagNames = [...new Set(tasks.flatMap((t) => t.tags))];
  const tagIdByName = new Map<string, string>();
  for (const name of tagNames) {
    const existing = await db.tag.findFirst({
      where: { workspaceId: workspace.id, name: { equals: name, mode: "insensitive" } },
    });
    const tag =
      existing ??
      (await db.tag.create({
        data: {
          workspaceId: workspace.id,
          name,
          color: PALETTE[tagIdByName.size % PALETTE.length],
        },
      }));
    tagIdByName.set(name, tag.id);
  }

  const counter = await db.project.update({
    where: { id: projectId },
    data: { taskCounter: { increment: tasks.length } },
    select: { taskCounter: true },
  });
  let number = counter.taskCounter - tasks.length;

  const createdIds: string[] = [];
  let subtaskCount = 0;

  for (const [index, task] of tasks.entries()) {
    number += 1;
    const created = await db.task.create({
      data: {
        projectId,
        number,
        title: task.title,
        description: task.description,
        statusId: status.id,
        type: (task.type ?? "TASK") as never,
        priority: (task.priority ?? "NONE") as never,
        assigneeId: task.assigneeId,
        reporterId: user.id,
        dueDate: task.dueDate ? new Date(`${task.dueDate}T12:00:00`) : null,
        estimate: task.estimateHours,
        points: task.points,
        order: lastOrder + (index + 1) * 1000,
        tags: task.tags.length
          ? {
              create: task.tags
                .map((name) => tagIdByName.get(name))
                .filter((id): id is string => !!id)
                .map((tagId) => ({ tagId })),
            }
          : undefined,
      },
    });
    createdIds.push(created.id);

    for (const [subIndex, title] of task.subtasks.entries()) {
      const sub = await db.project.update({
        where: { id: projectId },
        data: { taskCounter: { increment: 1 } },
        select: { taskCounter: true },
      });
      const subtask = await db.task.create({
        data: {
          projectId,
          number: sub.taskCounter,
          title,
          statusId: status.id,
          parentId: created.id,
          reporterId: user.id,
          order: lastOrder + (index + 1) * 1000 + (subIndex + 1),
        },
      });
      createdIds.push(subtask.id);
      subtaskCount += 1;
    }
  }

  await db.activity.create({
    data: {
      projectId,
      userId: user.id,
      action: "tasks.bulk_created",
      meta: { count: tasks.length, subtasks: subtaskCount } as never,
    },
  });

  for (const id of createdIds) void syncTask(id);
  revalidatePath("/", "layout");

  return { created: tasks.length, subtasks: subtaskCount };
}

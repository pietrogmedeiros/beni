import { db } from "@/lib/db";
import { handler, readJson, taskJson, taskShape } from "@/server/api-core";
import { createTaskViaApi, type CreateTaskInput } from "@/server/api-tasks";
import type { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

/**
 * Lista tarefas com os filtros que se usa no dia a dia.
 *
 * `status=aberto` é o atalho que mais importa: pedir "o que está em aberto"
 * sem precisar saber os nomes de status de cada projeto.
 */
export const GET = handler(async (caller, request) => {
  const url = new URL(request.url);
  const p = url.searchParams;
  const limit = Math.min(Number(p.get("limit") ?? 50), 200);

  const where: Prisma.TaskWhereInput = {
    project: { workspaceId: caller.workspaceId },
    archived: p.get("archived") === "true" ? true : false,
  };

  const project = p.get("project");
  if (project) {
    where.project = {
      workspaceId: caller.workspaceId,
      OR: [{ id: project }, { key: { equals: project, mode: "insensitive" } }],
    };
  }

  const status = p.get("status");
  if (status === "aberto" || status === "open") {
    where.status = { category: { notIn: ["DONE", "CANCELED"] } };
  } else if (status === "concluido" || status === "done") {
    where.status = { category: "DONE" };
  } else if (status) {
    where.status = { name: { equals: status, mode: "insensitive" } };
  }

  const assignee = p.get("assignee");
  if (assignee === "eu" || assignee === "me") {
    where.assigneeId = caller.userId;
  } else if (assignee === "ninguem" || assignee === "none") {
    where.assigneeId = null;
  } else if (assignee) {
    where.assignee = {
      OR: [
        { email: { equals: assignee, mode: "insensitive" } },
        { name: { contains: assignee, mode: "insensitive" } },
      ],
    };
  }

  const q = p.get("q");
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }

  if (p.get("overdue") === "true") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    where.dueDate = { lt: today };
    where.status = { category: { notIn: ["DONE", "CANCELED"] } };
  }

  const tasks = await db.task.findMany({
    where,
    include: taskShape,
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { updatedAt: "desc" }],
    take: limit,
  });

  return { count: tasks.length, tasks: tasks.map(taskJson) };
});

/** Cria uma tarefa. */
export const POST = handler(async (caller, request) => {
  const input = await readJson<CreateTaskInput>(request);
  const task = await createTaskViaApi(caller, input);
  return { task: taskJson(task) };
});

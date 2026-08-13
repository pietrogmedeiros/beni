import { db } from "@/lib/db";
import { handler, readJson, taskJson, taskOf, taskShape } from "@/server/api-core";
import { updateTaskViaApi, type UpdateTaskInput } from "@/server/api-tasks";

export const dynamic = "force-dynamic";

/** Uma tarefa por inteiro: subtarefas, comentários, dependências e anexos. */
export const GET = handler(async (caller, _request, params) => {
  const found = await taskOf(caller, params.id);

  const task = await db.task.findUniqueOrThrow({
    where: { id: found.id },
    include: {
      ...taskShape,
      subtasks: { include: taskShape, orderBy: { order: "asc" } },
      comments: {
        include: { author: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
        take: 50,
      },
      attachments: { select: { id: true, name: true, mimeType: true, size: true } },
      blockedBy: { include: { dependsOn: { select: { id: true, title: true } } } },
    },
  });

  return {
    task: {
      ...taskJson(task),
      subtasks: task.subtasks.map(taskJson),
      comments: task.comments.map((c) => ({
        author: c.author?.name ?? c.guestName ?? "convidado",
        body: c.body,
        createdAt: c.createdAt.toISOString(),
      })),
      attachments: task.attachments,
      dependsOn: task.blockedBy.map((d) => ({
        id: d.dependsOn.id,
        title: d.dependsOn.title,
      })),
    },
  };
});

/** Altera campos da tarefa — só o que vier no corpo é tocado. */
export const PATCH = handler(async (caller, request, params) => {
  const found = await taskOf(caller, params.id);
  const input = await readJson<UpdateTaskInput>(request);
  const task = await updateTaskViaApi(caller, found.id, input);
  return { task: taskJson(task) };
});

/**
 * Apaga a tarefa de vez.
 *
 * Existe porque criar em massa a partir de texto erra às vezes, e desfazer
 * arquivando deixaria lixo no acervo. Subtarefas vão junto, por cascata.
 */
export const DELETE = handler(async (caller, _request, params) => {
  const task = await taskOf(caller, params.id);
  await db.task.delete({ where: { id: task.id } });
  return { deleted: task.id };
});

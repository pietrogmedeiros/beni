import { db } from "@/lib/db";
import { handler, readJson, taskOf } from "@/server/api-core";
import { syncTask } from "@/server/search";

export const dynamic = "force-dynamic";

/** Comenta numa tarefa, em nome de quem é dono da chave. */
export const POST = handler(async (caller, request, params) => {
  const task = await taskOf(caller, params.id);
  const { body } = await readJson<{ body: string }>(request);
  if (!body?.trim()) throw new Error("Comentário vazio");

  const comment = await db.comment.create({
    data: { taskId: task.id, authorId: caller.userId, body: body.trim() },
  });

  await db.activity.create({
    data: {
      projectId: task.projectId,
      taskId: task.id,
      userId: caller.userId,
      action: "comment.created",
      meta: { via: "api" } as never,
    },
  });

  void syncTask(task.id);
  return { comment: { id: comment.id, createdAt: comment.createdAt.toISOString() } };
});

import { handler, readJson, taskJson } from "@/server/api-core";
import { createTaskViaApi } from "@/server/api-tasks";
import { detectBulkMode, MAX_BULK_TASKS, parseBulkTasks, type BulkMode } from "@/lib/bulk-parse";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Body = {
  project?: string;
  projectId?: string;
  text: string;
  mode?: BulkMode | "auto";
  /** Só interpreta e devolve o que faria, sem gravar. */
  dryRun?: boolean;
};

/**
 * Cria várias tarefas a partir de texto — o mesmo interpretador da tela.
 *
 * `dryRun` existe para quem chama poder mostrar o resultado antes de gravar,
 * que é a própria razão de a funcionalidade não usar modelo de linguagem: o
 * resultado é previsível e conferível.
 */
export const POST = handler(async (caller, request) => {
  const body = await readJson<Body>(request);
  if (!body.text?.trim()) throw new Error("Texto vazio");

  const mode = body.mode && body.mode !== "auto" ? body.mode : detectBulkMode(body.text);
  const todas = parseBulkTasks(body.text, new Date(), mode);
  const parsed = todas.slice(0, MAX_BULK_TASKS);

  if (body.dryRun) {
    return {
      mode,
      ignored: todas.length - parsed.length,
      tasks: parsed.map((t) => ({
        title: t.title,
        description: t.description,
        priority: t.priority,
        type: t.type,
        assignee: t.assigneeHint,
        dueDate: t.dueDate,
        estimateHours: t.estimateHours,
        points: t.points,
        tags: t.tags,
        subtasks: t.subtasks,
      })),
    };
  }

  const created = [];
  let subtasks = 0;

  for (const item of parsed) {
    const task = await createTaskViaApi(caller, {
      project: body.project,
      projectId: body.projectId,
      title: item.title,
      description: item.description,
      priority: item.priority ?? undefined,
      type: item.type ?? undefined,
      // um apelido que não casa com ninguém não pode derrubar a leva inteira
      assignee: undefined,
      dueDate: item.dueDate,
      points: item.points,
      estimateHours: item.estimateHours,
      tags: item.tags,
    });
    created.push(task);

    for (const title of item.subtasks) {
      await createTaskViaApi(caller, {
        projectId: task.projectId,
        title,
        parent: task.id,
      });
      subtasks += 1;
    }
  }

  return {
    mode,
    created: created.length,
    subtasks,
    ignored: todas.length - parsed.length,
    tasks: created.map(taskJson),
  };
});

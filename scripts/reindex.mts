/**
 * Reindexa todas as tarefas no Elasticsearch.
 * Rode depois de configurar `ELASTICSEARCH_URL` ou de mudar o mapeamento.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  SEARCH_INDEX,
  authHeader,
  baseUrl,
  ensureIndex,
  searchEnabled,
} from "../src/server/search-core";

const connectionString = process.env.DATABASE_URL ?? "";
// o driver `pg` ignora o `?schema=` da URL; ver src/lib/db.ts
const schema = connectionString
  ? (new URL(connectionString).searchParams.get("schema") ?? undefined)
  : undefined;

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString }, { schema }),
});

async function main() {
  if (!searchEnabled()) {
    console.log("ELASTICSEARCH_URL não configurado — nada a fazer.");
    return;
  }

  await ensureIndex();

  const tasks = await db.task.findMany({
    include: {
      status: true,
      assignee: { select: { name: true } },
      project: { select: { key: true, name: true, workspaceId: true } },
      tags: { include: { tag: true } },
      comments: { select: { body: true }, take: 50, orderBy: { createdAt: "desc" } },
    },
  });

  const lines: string[] = [];
  for (const task of tasks) {
    lines.push(JSON.stringify({ index: { _index: SEARCH_INDEX, _id: task.id } }));
    lines.push(
      JSON.stringify({
        workspaceId: task.project.workspaceId,
        projectId: task.projectId,
        projectKey: task.project.key,
        projectName: task.project.name,
        number: task.number,
        ref: `${task.project.key}-${task.number}`.toLowerCase(),
        title: task.title,
        description: task.description ?? "",
        comments: task.comments.map((c) => c.body).join("\n"),
        tags: task.tags.map((t) => t.tag.name),
        statusName: task.status.name,
        statusCategory: task.status.category,
        priority: task.priority,
        type: task.type,
        assigneeName: task.assignee?.name ?? "",
        archived: task.archived,
        updatedAt: task.updatedAt.toISOString(),
      }),
    );
  }

  if (lines.length === 0) {
    console.log("Nenhuma tarefa para indexar.");
    return;
  }

  const response = await fetch(`${baseUrl()}/_bulk?refresh=true`, {
    method: "POST",
    headers: { "Content-Type": "application/x-ndjson", ...authHeader() },
    body: `${lines.join("\n")}\n`,
  });

  const result = (await response.json()) as { errors?: boolean };
  if (result.errors) {
    console.error("Houve erros na indexação em lote.");
    process.exitCode = 1;
    return;
  }

  console.log(`✔ ${lines.length / 2} tarefa(s) indexada(s) em "${SEARCH_INDEX}"`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

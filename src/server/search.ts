import "server-only";
import { db } from "@/lib/db";
import {
  SEARCH_INDEX as INDEX,
  baseUrl,
  authHeader,
  ensureIndex,
  es,
  searchEnabled,
} from "@/server/search-core";

export { ensureIndex, searchEnabled, SEARCH_INDEX } from "@/server/search-core";

/**
 * Busca com Elasticsearch — opcional e sempre degradável.
 *
 * Decisão de arquitetura: o **Postgres continua sendo a fonte da verdade**.
 * Tarefa, ordem, contador e status dependem de transação, unicidade e chave
 * estrangeira — coisas que o ES não oferece, e cujo `refresh_interval` (~1s)
 * faria um card "voltar" logo depois de ser arrastado.
 *
 * O ES entra só onde ele ganha do Postgres: busca textual com stemming em
 * português (achar "integrações" digitando "integrar") através de título,
 * descrição, etiquetas e comentários ao mesmo tempo.
 *
 * Sem `ELASTICSEARCH_URL` configurado, tudo aqui vira no-op e a busca cai no
 * `ILIKE` do Postgres. O app funciona igual — só com busca mais literal.
 */

/* ————— Indexação ————— */

async function buildDocument(taskId: string) {
  const task = await db.task.findUnique({
    where: { id: taskId },
    include: {
      status: true,
      assignee: { select: { name: true } },
      project: { select: { key: true, name: true, workspaceId: true } },
      tags: { include: { tag: true } },
      comments: { select: { body: true }, take: 50, orderBy: { createdAt: "desc" } },
    },
  });
  if (!task) return null;

  return {
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
  };
}

/**
 * Reindexa uma tarefa. Chamado sem `await` pelas Server Actions: se o ES
 * estiver fora do ar, a gravação no Postgres já aconteceu de qualquer jeito.
 */
export async function syncTask(taskId: string) {
  if (!searchEnabled()) return;
  const doc = await buildDocument(taskId);
  if (!doc) return;
  await es(`/${INDEX}/_doc/${taskId}`, { method: "PUT", body: doc });
}

export async function removeTaskFromIndex(taskId: string) {
  if (!searchEnabled()) return;
  await es(`/${INDEX}/_doc/${taskId}`, { method: "DELETE" });
}

/** Reindexa o workspace inteiro (usado pelo script `npm run search:reindex`). */
export async function reindexWorkspace(workspaceId: string) {
  if (!searchEnabled()) return { indexed: 0 };
  await ensureIndex();

  const tasks = await db.task.findMany({
    where: { project: { workspaceId } },
    select: { id: true },
  });

  const lines: string[] = [];
  for (const { id } of tasks) {
    const doc = await buildDocument(id);
    if (!doc) continue;
    lines.push(JSON.stringify({ index: { _index: INDEX, _id: id } }));
    lines.push(JSON.stringify(doc));
  }
  if (lines.length === 0) return { indexed: 0 };

  const url = baseUrl();
  await fetch(`${url}/_bulk?refresh=true`, {
    method: "POST",
    headers: { "Content-Type": "application/x-ndjson", ...authHeader() },
    body: `${lines.join("\n")}\n`,
  });

  return { indexed: lines.length / 2 };
}

/* ————— Consulta ————— */

type SearchHit = { _id: string; _score: number };

/**
 * Devolve os ids das tarefas em ordem de relevância, ou `null` quando o ES
 * não está disponível — sinal para o chamador usar o Postgres.
 */
export async function searchTaskIds(
  workspaceId: string,
  term: string,
  limit = 20,
): Promise<string[] | null> {
  if (!searchEnabled()) return null;

  const value = term.trim();
  if (!value) return [];

  const result = await es<{ hits: { hits: SearchHit[] } }>(
    `/${INDEX}/_search`,
    {
      method: "POST",
      body: {
        size: limit,
        _source: false,
        query: {
          bool: {
            filter: [
              { term: { workspaceId } },
              { term: { archived: false } },
            ],
            should: [
              // referência exata: "WEB-12"
              { term: { ref: { value: value.toLowerCase(), boost: 10 } } },
              {
                multi_match: {
                  query: value,
                  fields: [
                    "title^4",
                    "title.exact^6",
                    "tags^3",
                    "description^2",
                    "assigneeName^2",
                    "comments",
                    "projectName",
                  ],
                  fuzziness: "AUTO",
                  operator: "and",
                },
              },
              // prefixo, para busca enquanto digita
              {
                multi_match: {
                  query: value,
                  type: "bool_prefix",
                  fields: ["title", "tags"],
                },
              },
            ],
            minimum_should_match: 1,
          },
        },
      },
    },
  );

  if (!result) return null;
  return result.hits.hits.map((h) => h._id);
}


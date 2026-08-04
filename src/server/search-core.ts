/**
 * Núcleo da busca com Elasticsearch: configuração, cliente HTTP e mapeamento.
 *
 * Sem dependência de banco de propósito — assim o script de reindexação
 * (`scripts/reindex.mts`) reaproveita as mesmas definições sem esbarrar no
 * `server-only` da camada de dados.
 */

export const SEARCH_INDEX = `${process.env.SEARCH_INDEX_PREFIX ?? "beni"}-tasks`;

export function baseUrl() {
  return process.env.ELASTICSEARCH_URL?.replace(/\/$/, "") ?? null;
}

export function searchEnabled() {
  return !!baseUrl();
}

export function authHeader(): Record<string, string> {
  const apiKey = process.env.ELASTICSEARCH_API_KEY;
  if (apiKey) return { Authorization: `ApiKey ${apiKey}` };

  const user = process.env.ELASTICSEARCH_USERNAME;
  const pass = process.env.ELASTICSEARCH_PASSWORD;
  if (user && pass) {
    return {
      Authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`,
    };
  }
  return {};
}

export async function es<T = unknown>(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T | null> {
  const url = baseUrl();
  if (!url) return null;

  try {
    const response = await fetch(`${url}${path}`, {
      method: init?.method ?? "GET",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: init?.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });

    if (!response.ok) {
      if (response.status !== 404) {
        console.error(`[busca] ${path} → ${response.status}`);
      }
      return null;
    }
    return (await response.json()) as T;
  } catch (error) {
    // busca é acessório: nunca derruba a requisição do usuário
    console.error("[busca] indisponível:", (error as Error).message);
    return null;
  }
}

/* ————— Índice ————— */

export const MAPPING = {
  mappings: {
    properties: {
      workspaceId: { type: "keyword" },
      projectId: { type: "keyword" },
      projectKey: { type: "keyword" },
      projectName: { type: "text", analyzer: "brazilian" },
      number: { type: "integer" },
      ref: { type: "keyword" },
      title: {
        type: "text",
        analyzer: "brazilian",
        fields: { exact: { type: "keyword", ignore_above: 256 } },
      },
      description: { type: "text", analyzer: "brazilian" },
      comments: { type: "text", analyzer: "brazilian" },
      tags: { type: "keyword" },
      statusName: { type: "keyword" },
      statusCategory: { type: "keyword" },
      priority: { type: "keyword" },
      type: { type: "keyword" },
      assigneeName: { type: "text", analyzer: "brazilian" },
      archived: { type: "boolean" },
      updatedAt: { type: "date" },
    },
  },
} as const;

export async function ensureIndex() {
  if (!searchEnabled()) return false;
  const exists = await es(`/${SEARCH_INDEX}`);
  if (exists) return true;
  const created = await es(`/${SEARCH_INDEX}`, { method: "PUT", body: MAPPING });
  return !!created;
}


export const INDEX = SEARCH_INDEX;

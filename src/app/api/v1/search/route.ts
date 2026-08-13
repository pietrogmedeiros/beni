import { db } from "@/lib/db";
import { handler, taskJson, taskShape } from "@/server/api-core";
import { searchTaskIds } from "@/server/search";

export const dynamic = "force-dynamic";

/**
 * Busca no acervo. Usa o Elasticsearch quando está configurado — que é o que
 * faz "integrar" encontrar "Integração" — e cai na busca literal do Postgres
 * quando não está.
 */
export const GET = handler(async (caller, request) => {
  const q = new URL(request.url).searchParams.get("q")?.trim();
  if (!q) throw new Error("Informe o termo em ?q=");

  const ids = await searchTaskIds(caller.workspaceId, q, 30);

  const tasks = ids
    ? await db.task.findMany({
        where: { id: { in: ids }, project: { workspaceId: caller.workspaceId } },
        include: taskShape,
      })
    : await db.task.findMany({
        where: {
          archived: false,
          project: { workspaceId: caller.workspaceId },
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        },
        include: taskShape,
        take: 30,
        orderBy: { updatedAt: "desc" },
      });

  const byId = new Map(tasks.map((t) => [t.id, t]));
  const ordered = ids ? ids.map((id) => byId.get(id)).filter((t) => !!t) : tasks;

  return {
    engine: ids ? "elasticsearch" : "postgres",
    count: ordered.length,
    tasks: ordered.map(taskJson),
  };
});

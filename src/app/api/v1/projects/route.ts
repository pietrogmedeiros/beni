import { db } from "@/lib/db";
import { escopoDoChamador, exigirMembroDoChamador } from "@/server/escopo";
import { handler, readJson } from "@/server/api-core";
import { DEFAULT_STATUSES, PALETTE } from "@/lib/constants";
import { projectKeyFrom } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Projetos do workspace, cada um com seus status e sprints.
 *
 * Os status vêm junto de propósito: sem eles, quem chama teria de adivinhar
 * que "Em revisão" existe neste projeto e não naquele.
 */
export const GET = handler(async (caller) => {
  const projects = await db.project.findMany({
    where: { ...(await escopoDoChamador(caller)), archived: false },
    include: {
      statuses: { orderBy: { order: "asc" }, select: { name: true, category: true } },
      sprints: {
        where: { status: { not: "COMPLETED" } },
        orderBy: { startDate: "asc" },
        select: { id: true, name: true, status: true },
      },
      _count: { select: { tasks: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return {
    projects: projects.map((p) => ({
      id: p.id,
      key: p.key,
      name: p.name,
      description: p.description,
      taskCount: p._count.tasks,
      statuses: p.statuses.map((s) => s.name),
      doneStatuses: p.statuses.filter((s) => s.category === "DONE").map((s) => s.name),
      sprints: p.sprints,
    })),
  };
});

/** Cria um projeto com o conjunto de status padrão. */
export const POST = handler(async (caller, request) => {
  // convidado trabalha dentro de um projeto, não cria projeto novo
  await exigirMembroDoChamador(caller);
  const { name, description, key } = await readJson<{
    name: string;
    description?: string;
    key?: string;
  }>(request);

  if (!name?.trim()) throw new Error("Informe o nome do projeto");

  const chave = (key || projectKeyFrom(name)).toUpperCase().slice(0, 6);
  const existente = await db.project.findFirst({
    where: { workspaceId: caller.workspaceId, key: chave },
  });
  if (existente) throw new Error(`Já existe um projeto com a chave ${chave}`);

  const project = await db.project.create({
    data: {
      workspaceId: caller.workspaceId,
      name: name.trim(),
      description: description ?? null,
      key: chave,
      color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
      statuses: {
        create: DEFAULT_STATUSES.map((s, i) => ({
          name: s.name,
          color: s.color,
          category: s.category,
          order: i,
        })),
      },
    },
    include: { statuses: { orderBy: { order: "asc" } } },
  });

  return {
    project: {
      id: project.id,
      key: project.key,
      name: project.name,
      statuses: project.statuses.map((s) => s.name),
    },
  };
});

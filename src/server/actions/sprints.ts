"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { filtroDeProjetos, exigirMembroDoWorkspace } from "@/server/escopo";
import { currentWorkspace } from "@/lib/auth";

async function assertProject(projectId: string) {
  const workspace = await currentWorkspace();
  const project = await db.project.findFirst({
    where: { id: projectId, ...(await filtroDeProjetos()) },
  });
  if (!project) throw new Error("Projeto não encontrado");
  return project;
}

async function assertSprint(sprintId: string) {
  const workspace = await currentWorkspace();
  const sprint = await db.sprint.findFirst({
    where: { id: sprintId, project: await filtroDeProjetos() },
  });
  if (!sprint) throw new Error("Sprint não encontrada");
  return sprint;
}

export async function createSprint(input: {
  projectId: string;
  name: string;
  goal?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}) {
  await exigirMembroDoWorkspace();
  await assertProject(input.projectId);
  const last = await db.sprint.findFirst({
    where: { projectId: input.projectId },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  const sprint = await db.sprint.create({
    data: {
      projectId: input.projectId,
      name: input.name,
      goal: input.goal || null,
      startDate: input.startDate ? new Date(input.startDate) : null,
      endDate: input.endDate ? new Date(input.endDate) : null,
      order: (last?.order ?? 0) + 1000,
    },
  });
  revalidatePath("/", "layout");
  return sprint;
}

export async function updateSprint(
  sprintId: string,
  input: {
    name?: string;
    goal?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    status?: string;
  },
) {
  await exigirMembroDoWorkspace();
  await assertSprint(sprintId);
  await db.sprint.update({
    where: { id: sprintId },
    data: {
      name: input.name,
      goal: input.goal,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      status: input.status as any,
      startDate:
        input.startDate !== undefined
          ? input.startDate
            ? new Date(input.startDate)
            : null
          : undefined,
      endDate:
        input.endDate !== undefined
          ? input.endDate
            ? new Date(input.endDate)
            : null
          : undefined,
    },
  });
  revalidatePath("/", "layout");
}

/** Inicia a sprint (e encerra qualquer outra ativa no projeto). */
export async function startSprint(sprintId: string) {
  await exigirMembroDoWorkspace();
  const sprint = await assertSprint(sprintId);
  await db.$transaction([
    db.sprint.updateMany({
      where: { projectId: sprint.projectId, status: "ACTIVE" },
      data: { status: "COMPLETED" },
    }),
    db.sprint.update({
      where: { id: sprintId },
      data: {
        status: "ACTIVE",
        startDate: sprint.startDate ?? new Date(),
      },
    }),
  ]);
  revalidatePath("/", "layout");
}

/** Conclui a sprint e move as tarefas não finalizadas para o backlog. */
export async function completeSprint(sprintId: string) {
  await exigirMembroDoWorkspace();
  const sprint = await assertSprint(sprintId);
  await db.task.updateMany({
    where: {
      sprintId,
      status: { category: { notIn: ["DONE", "CANCELED"] } },
    },
    data: { sprintId: null },
  });
  await db.sprint.update({
    where: { id: sprintId },
    data: { status: "COMPLETED", endDate: sprint.endDate ?? new Date() },
  });
  revalidatePath("/", "layout");
}

export async function deleteSprint(sprintId: string) {
  await exigirMembroDoWorkspace();
  await assertSprint(sprintId);
  await db.task.updateMany({ where: { sprintId }, data: { sprintId: null } });
  await db.sprint.delete({ where: { id: sprintId } });
  revalidatePath("/", "layout");
}

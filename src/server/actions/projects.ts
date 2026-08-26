"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ehMascoteValido } from "@/lib/avatares";
import { db } from "@/lib/db";
import { filtroDeProjetos, exigirMembroDoWorkspace } from "@/server/escopo";
import { currentWorkspace, requireUser } from "@/lib/auth";
import { DEFAULT_STATUSES } from "@/lib/constants";
import { projectKeyFrom } from "@/lib/utils";

async function assertProjectAccess(projectId: string) {
  const project = await db.project.findFirst({
    where: { id: projectId, ...(await filtroDeProjetos()) },
  });
  if (!project) throw new Error("Projeto não encontrado");
  return project;
}

const projectSchema = z.object({
  name: z.string().min(1, "Informe o nome do projeto"),
  description: z.string().optional().nullable(),
  color: z.string().default("#eab308"),
  icon: z.string().default("Rocket"),
  key: z.string().optional().nullable(),
});

export async function createProject(input: {
  name: string;
  description?: string | null;
  color?: string;
  icon?: string;
  key?: string | null;
}) {
  await exigirMembroDoWorkspace();
  const workspace = await currentWorkspace();
  const data = projectSchema.parse(input);

  let key = (data.key || projectKeyFrom(data.name)).toUpperCase().slice(0, 6);
  let attempt = 1;
  while (
    await db.project.findUnique({
      where: { workspaceId_key: { workspaceId: workspace.id, key } },
    })
  ) {
    key = `${projectKeyFrom(data.name)}${++attempt}`.slice(0, 6);
  }

  const last = await db.project.findFirst({
    where: { workspaceId: workspace.id },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  const project = await db.project.create({
    data: {
      workspaceId: workspace.id,
      name: data.name,
      description: data.description || null,
      color: data.color,
      icon: data.icon,
      key,
      order: (last?.order ?? 0) + 1000,
    },
  });

  await db.taskStatus.createMany({
    data: DEFAULT_STATUSES.map((s, i) => ({
      projectId: project.id,
      name: s.name,
      color: s.color,
      category: s.category,
      order: (i + 1) * 1000,
    })),
  });

  revalidatePath("/", "layout");
  return project;
}

export async function createProjectAndGo(formData: FormData) {
  await exigirMembroDoWorkspace();
  const project = await createProject({
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? "") || null,
    color: String(formData.get("color") ?? "#eab308"),
    icon: String(formData.get("icon") ?? "Rocket"),
    key: String(formData.get("key") ?? "") || null,
  });
  redirect(`/p/${project.id}/board`);
}

export async function updateProject(
  projectId: string,
  input: Partial<{
    name: string;
    description: string | null;
    color: string;
    icon: string;
    archived: boolean;
    startDate: string | null;
    endDate: string | null;
  }>,
) {
  await exigirMembroDoWorkspace();
  await assertProjectAccess(projectId);
  await db.project.update({
    where: { id: projectId },
    data: {
      ...input,
      startDate: input.startDate !== undefined
        ? input.startDate
          ? new Date(input.startDate)
          : null
        : undefined,
      endDate: input.endDate !== undefined
        ? input.endDate
          ? new Date(input.endDate)
          : null
        : undefined,
    },
  });
  revalidatePath("/", "layout");
}

export async function deleteProject(projectId: string) {
  await exigirMembroDoWorkspace();
  await assertProjectAccess(projectId);

  // Cobrança tem `onDelete: Restrict`, então o banco recusaria de qualquer
  // forma — mas recusaria com um erro de chave estrangeira, que na tela vira
  // "algo deu errado". Vale conferir antes só para poder explicar: apagar um
  // projeto não pode levar junto o histórico de quem pagou o quê.
  const cobrancas = await db.cobranca.count({ where: { projectId } });
  if (cobrancas > 0) {
    throw new Error(
      `Este projeto tem ${cobrancas} cobrança${cobrancas > 1 ? "s" : ""} registrada${cobrancas > 1 ? "s" : ""}. Exclua ou mova as cobranças antes de apagar o projeto.`,
    );
  }

  await db.project.delete({ where: { id: projectId } });
  revalidatePath("/", "layout");
}

/* ————— Status (colunas) ————— */

export async function createStatus(
  projectId: string,
  input: { name: string; color: string; category: string },
) {
  await exigirMembroDoWorkspace();
  await assertProjectAccess(projectId);
  const last = await db.taskStatus.findFirst({
    where: { projectId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  await db.taskStatus.create({
    data: {
      projectId,
      name: input.name,
      color: input.color,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      category: input.category as any,
      order: (last?.order ?? 0) + 1000,
    },
  });
  revalidatePath("/", "layout");
}

export async function updateStatus(
  statusId: string,
  input: { name?: string; color?: string; category?: string },
) {
  await exigirMembroDoWorkspace();
  const status = await db.taskStatus.findUnique({ where: { id: statusId } });
  if (!status) throw new Error("Status não encontrado");
  await assertProjectAccess(status.projectId);
  await db.taskStatus.update({
    where: { id: statusId },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: input as any,
  });
  revalidatePath("/", "layout");
}

export async function deleteStatus(statusId: string) {
  await exigirMembroDoWorkspace();
  const status = await db.taskStatus.findUnique({
    where: { id: statusId },
    include: { _count: { select: { tasks: true } } },
  });
  if (!status) throw new Error("Status não encontrado");
  await assertProjectAccess(status.projectId);

  const remaining = await db.taskStatus.count({
    where: { projectId: status.projectId },
  });
  if (remaining <= 1) throw new Error("O projeto precisa de pelo menos um status");

  if (status._count.tasks > 0) {
    const fallback = await db.taskStatus.findFirst({
      where: { projectId: status.projectId, id: { not: statusId } },
      orderBy: { order: "asc" },
    });
    if (fallback) {
      await db.task.updateMany({
        where: { statusId },
        data: { statusId: fallback.id },
      });
    }
  }

  await db.taskStatus.delete({ where: { id: statusId } });
  revalidatePath("/", "layout");
}

export async function reorderStatuses(projectId: string, orderedIds: string[]) {
  await exigirMembroDoWorkspace();
  await assertProjectAccess(projectId);
  await db.$transaction(
    orderedIds.map((id, i) =>
      db.taskStatus.update({ where: { id }, data: { order: (i + 1) * 1000 } }),
    ),
  );
  revalidatePath("/", "layout");
}

/* ————— Tags ————— */

export async function createTag(input: { name: string; color: string }) {
  await exigirMembroDoWorkspace();
  const workspace = await currentWorkspace();
  const tag = await db.tag.upsert({
    where: { workspaceId_name: { workspaceId: workspace.id, name: input.name } },
    update: { color: input.color },
    create: { workspaceId: workspace.id, name: input.name, color: input.color },
  });
  revalidatePath("/", "layout");
  return tag;
}

export async function deleteTag(tagId: string) {
  await exigirMembroDoWorkspace();
  const workspace = await currentWorkspace();
  await db.tag.deleteMany({ where: { id: tagId, workspaceId: workspace.id } });
  revalidatePath("/", "layout");
}

/* ————— Perfil / workspace ————— */

export async function updateProfile(input: {
  name?: string;
  avatarColor?: string;
}) {
  const user = await requireUser();
  await db.user.update({ where: { id: user.id }, data: input });
  revalidatePath("/", "layout");
}

export async function updateWorkspaceName(name: string) {
  await exigirMembroDoWorkspace();
  const workspace = await currentWorkspace();
  await db.workspace.update({ where: { id: workspace.id }, data: { name } });
  revalidatePath("/", "layout");
}

/**
 * Escolhe um mascote como avatar, ou volta para as iniciais com `null`.
 *
 * Apaga a foto: manter as duas coisas guardadas faria o avatar depender de
 * uma regra de precedência invisível, e quem trocasse de volta encontraria
 * uma foto que achava ter substituído.
 */
export async function escolherMascote(chave: string | null) {
  const user = await requireUser();
  if (chave !== null && !ehMascoteValido(chave)) {
    throw new Error("Mascote desconhecido");
  }

  await db.$transaction([
    db.avatar.deleteMany({ where: { userId: user.id } }),
    db.user.update({ where: { id: user.id }, data: { avatarMascot: chave } }),
  ]);
  revalidatePath("/", "layout");
}

/** Tira a foto e volta para as iniciais. */
export async function removerFotoDePerfil() {
  const user = await requireUser();
  await db.$transaction([
    db.avatar.deleteMany({ where: { userId: user.id } }),
    db.user.update({ where: { id: user.id }, data: { avatarMascot: null } }),
  ]);
  revalidatePath("/", "layout");
}

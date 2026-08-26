"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { filtroDeProjetos, exigirMembroDoWorkspace } from "@/server/escopo";
import { currentWorkspace } from "@/lib/auth";
import { decryptSecret, encryptSecret, maskSecret } from "@/lib/crypto";
import {
  GithubError,
  fetchItem,
  fetchRepo,
  listOpenItems,
  parseIssueInput,
  parseRepoInput,
  listarReposDaConta,
  type GithubItem,
  type RepoDaConta,
} from "@/server/github";

async function workspaceToken() {
  const workspace = await currentWorkspace();
  const row = await db.workspace.findUnique({
    where: { id: workspace.id },
    select: { githubToken: true },
  });
  return decryptSecret(row?.githubToken);
}

async function assertProject(projectId: string) {
  const project = await db.project.findFirst({
    where: { id: projectId, ...(await filtroDeProjetos()) },
  });
  if (!project) throw new Error("Projeto não encontrado");
  return project;
}

/* ————— Token do workspace ————— */

export async function getGithubTokenPreview() {
  await exigirMembroDoWorkspace();
  return maskSecret(await workspaceToken());
}

export async function setGithubToken(token: string | null) {
  await exigirMembroDoWorkspace();
  const workspace = await currentWorkspace();
  const value = token?.trim();

  await db.workspace.update({
    where: { id: workspace.id },
    data: { githubToken: value ? encryptSecret(value) : null },
  });

  revalidatePath("/", "layout");
  return maskSecret(value || null);
}

/* ————— Repositórios ————— */

export async function connectRepository(projectId: string, input: string) {
  await exigirMembroDoWorkspace();
  await assertProject(projectId);

  const parsed = parseRepoInput(input);
  if (!parsed) {
    throw new Error(
      "Informe no formato dono/repositório ou cole a URL do GitHub",
    );
  }

  const token = await workspaceToken();
  let info;
  try {
    info = await fetchRepo(parsed.owner, parsed.name, token);
  } catch (e) {
    throw new Error(
      e instanceof GithubError ? e.message : "Erro ao consultar o GitHub",
    );
  }

  const repo = await db.githubRepo.upsert({
    where: {
      projectId_owner_name: {
        projectId,
        owner: info.owner,
        name: info.name,
      },
    },
    update: {
      htmlUrl: info.htmlUrl,
      description: info.description,
      defaultBranch: info.defaultBranch,
      isPrivate: info.isPrivate,
    },
    create: {
      projectId,
      owner: info.owner,
      name: info.name,
      htmlUrl: info.htmlUrl,
      description: info.description,
      defaultBranch: info.defaultBranch,
      isPrivate: info.isPrivate,
    },
  });

  revalidatePath("/", "layout");
  return { id: repo.id, owner: repo.owner, name: repo.name };
}

export async function disconnectRepository(repoId: string) {
  await exigirMembroDoWorkspace();
  const repo = await db.githubRepo.findFirst({
    where: { id: repoId, project: await filtroDeProjetos() },
  });
  if (!repo) throw new Error("Repositório não encontrado");
  await db.githubRepo.delete({ where: { id: repoId } });
  revalidatePath("/", "layout");
}

/** Dados ao vivo do repositório (estrelas, issues abertas, último push). */
export async function repositoryStats(repoId: string) {
  await exigirMembroDoWorkspace();
  const repo = await db.githubRepo.findFirst({
    where: { id: repoId, project: await filtroDeProjetos() },
  });
  if (!repo) throw new Error("Repositório não encontrado");

  try {
    return await fetchRepo(repo.owner, repo.name, await workspaceToken());
  } catch {
    return null;
  }
}

/* ————— Vínculos com issues e pull requests ————— */

async function assertTask(taskId: string) {
  const task = await db.task.findFirst({
    where: { id: taskId, project: await filtroDeProjetos() },
  });
  if (!task) throw new Error("Tarefa não encontrada");
  return task;
}

export async function listRepositoriesForTask(taskId: string) {
  await exigirMembroDoWorkspace();
  const task = await assertTask(taskId);
  const repos = await db.githubRepo.findMany({
    where: { projectId: task.projectId },
    orderBy: { createdAt: "asc" },
  });
  return repos.map((r) => ({
    id: r.id,
    owner: r.owner,
    name: r.name,
    htmlUrl: r.htmlUrl,
    defaultBranch: r.defaultBranch,
  }));
}

export async function listOpenItemsForRepo(
  repoId: string,
): Promise<GithubItem[]> {
  const repo = await db.githubRepo.findFirst({
    where: { id: repoId, project: await filtroDeProjetos() },
  });
  if (!repo) throw new Error("Repositório não encontrado");

  try {
    return await listOpenItems(repo.owner, repo.name, await workspaceToken());
  } catch {
    return [];
  }
}

/** Vincula uma issue/PR pelo número (`#42`) ou colando a URL. */
export async function linkGithubItem(input: {
  taskId: string;
  repoId: string;
  reference: string;
}) {
  await exigirMembroDoWorkspace();
  await exigirMembroDoWorkspace();
  const task = await assertTask(input.taskId);
  const repo = await db.githubRepo.findFirst({
    where: { id: input.repoId, projectId: task.projectId },
  });
  if (!repo) throw new Error("Repositório não vinculado a este projeto");

  const parsed = parseIssueInput(input.reference);
  if (!parsed) {
    throw new Error("Informe o número (#42) ou cole a URL da issue/PR");
  }

  const owner = parsed.owner ?? repo.owner;
  const name = parsed.name ?? repo.name;

  let item;
  try {
    item = await fetchItem(owner, name, parsed.number, await workspaceToken());
  } catch (e) {
    throw new Error(
      e instanceof GithubError ? e.message : "Erro ao consultar o GitHub",
    );
  }

  await db.taskGithubLink.upsert({
    where: {
      taskId_repoId_number: {
        taskId: task.id,
        repoId: repo.id,
        number: item.number,
      },
    },
    update: {
      title: item.title,
      state: item.state,
      htmlUrl: item.htmlUrl,
      author: item.author,
      syncedAt: new Date(),
    },
    create: {
      taskId: task.id,
      repoId: repo.id,
      type: item.type,
      number: item.number,
      title: item.title,
      state: item.state,
      htmlUrl: item.htmlUrl,
      author: item.author,
    },
  });

  await db.activity.create({
    data: {
      projectId: task.projectId,
      taskId: task.id,
      action: "github.linked",
      meta: {
        number: item.number,
        type: item.type,
        repo: `${owner}/${name}`,
      } as never,
    },
  });

  revalidatePath("/", "layout");
}

export async function unlinkGithubItem(linkId: string) {
  await exigirMembroDoWorkspace();
  const link = await db.taskGithubLink.findFirst({
    where: { id: linkId, task: { project: await filtroDeProjetos() } },
  });
  if (!link) return;
  await db.taskGithubLink.delete({ where: { id: linkId } });
  revalidatePath("/", "layout");
}

/** Reconsulta o GitHub e atualiza título e estado dos itens vinculados. */
export async function syncGithubLinks(taskId: string) {
  await exigirMembroDoWorkspace();
  const task = await assertTask(taskId);
  const links = await db.taskGithubLink.findMany({
    where: { taskId: task.id },
    include: { repo: true },
  });
  if (links.length === 0) return { updated: 0 };

  const token = await workspaceToken();
  let updated = 0;

  for (const link of links) {
    try {
      const item = await fetchItem(
        link.repo.owner,
        link.repo.name,
        link.number,
        token,
      );
      await db.taskGithubLink.update({
        where: { id: link.id },
        data: {
          title: item.title,
          state: item.state,
          author: item.author,
          syncedAt: new Date(),
        },
      });
      updated += 1;
    } catch {
      // um item inacessível não deve derrubar a sincronização dos outros
    }
  }

  revalidatePath("/", "layout");
  return { updated };
}


/**
 * Repositórios da conta ligada, para o seletor.
 *
 * Devolve lista vazia (e não erro) quando não há token: a tela já explica que
 * sem token só dá para digitar o nome, e transformar isso em exceção encheria
 * de vermelho uma situação que é só "ainda não configurou".
 */
export async function listarRepositoriosDaConta(): Promise<{
  repos: RepoDaConta[];
  /** Há token configurado? Sem isto a tela não sabe distinguir "conta não
   *  ligada" de "ligada e sem repositório", e as duas apareceriam igual: em
   *  branco. Foi exatamente essa ambiguidade que fez parecer que a
   *  funcionalidade não tinha subido. */
  temToken: boolean;
  erro: string | null;
}> {
  await exigirMembroDoWorkspace();
  const token = await workspaceToken();
  if (!token) return { repos: [], temToken: false, erro: null };

  try {
    return { repos: await listarReposDaConta(token), temToken: true, erro: null };
  } catch (e) {
    return {
      repos: [],
      temToken: true,
      erro:
        e instanceof GithubError
          ? e.message
          : "Não consegui listar seus repositórios agora.",
    };
  }
}

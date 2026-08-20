"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  createSession,
  currentWorkspace,
  hashPassword,
  requireUser,
} from "@/lib/auth";
import { exigirMembroDoWorkspace, exigirProjeto } from "@/server/escopo";
import { withBase } from "@/lib/base-path";

/**
 * Convidados de projeto.
 *
 * Convidar quase sempre é convidar quem **ainda não tem conta**: o cliente, o
 * freelancer. Por isso o convite guarda e-mail e projeto e vira um link; a
 * conta nasce quando a pessoa aceita.
 *
 * Quem aceita entra no workspace como `GUEST`, e é esse papel que faz o
 * `server/escopo` restringir tudo ao projeto. Sem o `ProjectAccess` junto, o
 * papel sozinho não daria acesso a nada, o que é a falha segura correta.
 */

type Resposta = { ok: true } | { ok: false; erro: string };
const erro = (m: string): Resposta => ({ ok: false, erro: m });

export type ConvidadoDTO = {
  tipo: "acesso" | "convite";
  id: string;
  nome: string | null;
  email: string;
  desde: string;
  /** Só em convite pendente: o link para reenviar. */
  link: string | null;
};

export async function listarConvidados(projectId: string): Promise<ConvidadoDTO[]> {
  await exigirMembroDoWorkspace();
  await exigirProjeto(projectId);

  const [acessos, convites] = await Promise.all([
    db.projectAccess.findMany({
      where: { projectId },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    db.projectInvite.findMany({
      where: { projectId, aceitoEm: null },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return [
    ...acessos.map((a) => ({
      tipo: "acesso" as const,
      id: a.id,
      nome: a.user.name,
      email: a.user.email,
      desde: a.createdAt.toISOString(),
      link: null,
    })),
    ...convites.map((c) => ({
      tipo: "convite" as const,
      id: c.id,
      nome: null,
      email: c.email,
      desde: c.createdAt.toISOString(),
      link: withBase(`/convite/${c.token}`),
    })),
  ];
}

const convite = z.object({
  projectId: z.string().min(1),
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
});

export async function convidarParaProjeto(
  dados: z.input<typeof convite>,
): Promise<Resposta & { link?: string }> {
  await exigirMembroDoWorkspace();
  const parsed = convite.safeParse(dados);
  if (!parsed.success) return erro(parsed.error.issues[0].message);

  const projeto = await exigirProjeto(parsed.data.projectId);
  const user = await requireUser();
  const workspace = await currentWorkspace();

  // Já é do time? Então não é convidado, e transformar em convidado seria
  // rebaixar alguém sem querer.
  const jaEhDoTime = await db.membership.findFirst({
    where: {
      workspaceId: workspace.id,
      role: { not: "GUEST" },
      user: { email: parsed.data.email },
    },
  });
  if (jaEhDoTime) {
    return erro("Essa pessoa já é do time e enxerga este projeto.");
  }

  const conta = await db.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true },
  });

  // Conta que já existe entra na hora: não faz sentido mandar link para quem
  // já está aqui dentro.
  if (conta) {
    await db.membership.upsert({
      where: { userId_workspaceId: { userId: conta.id, workspaceId: workspace.id } },
      update: {},
      create: { userId: conta.id, workspaceId: workspace.id, role: "GUEST" },
    });
    await db.projectAccess.upsert({
      where: { projectId_userId: { projectId: projeto.id, userId: conta.id } },
      update: {},
      create: { projectId: projeto.id, userId: conta.id, concedidoPorId: user.id },
    });
    revalidatePath(`/p/${projeto.id}/settings`);
    return { ok: true };
  }

  const token = randomBytes(24).toString("base64url");
  await db.projectInvite.upsert({
    where: { projectId_email: { projectId: projeto.id, email: parsed.data.email } },
    update: { token, criadoPorId: user.id, aceitoEm: null },
    create: {
      projectId: projeto.id,
      email: parsed.data.email,
      token,
      criadoPorId: user.id,
    },
  });

  revalidatePath(`/p/${projeto.id}/settings`);
  return { ok: true, link: withBase(`/convite/${token}`) };
}

export async function revogarConvidado(
  projectId: string,
  id: string,
  tipo: "acesso" | "convite",
): Promise<Resposta> {
  await exigirMembroDoWorkspace();
  await exigirProjeto(projectId);

  if (tipo === "convite") {
    await db.projectInvite.deleteMany({ where: { id, projectId } });
  } else {
    const acesso = await db.projectAccess.findFirst({ where: { id, projectId } });
    if (!acesso) return erro("Acesso não encontrado");
    await db.projectAccess.delete({ where: { id } });

    // Convidado que ficou sem nenhum projeto perde também o vínculo com o
    // workspace: deixar a associação vazia significaria uma conta que entra e
    // não encontra nada, o que parece defeito e não decisão.
    const workspace = await currentWorkspace();
    const restantes = await db.projectAccess.count({
      where: { userId: acesso.userId, project: { workspaceId: workspace.id } },
    });
    if (restantes === 0) {
      await db.membership.deleteMany({
        where: { userId: acesso.userId, workspaceId: workspace.id, role: "GUEST" },
      });
    }
  }

  revalidatePath(`/p/${projectId}/settings`);
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Aceitar                                                                     */
/* -------------------------------------------------------------------------- */

export async function conviteAberto(token: string) {
  const c = await db.projectInvite.findUnique({
    where: { token },
    include: {
      project: {
        select: { id: true, name: true, workspace: { select: { name: true } } },
      },
    },
  });
  if (!c || c.aceitoEm) return null;
  if (c.expiraEm && c.expiraEm < new Date()) return null;
  return {
    email: c.email,
    projeto: c.project.name,
    workspace: c.project.workspace.name,
    projectId: c.project.id,
  };
}

const aceite = z.object({
  token: z.string().min(1),
  nome: z.string().trim().min(1, "Diga como quer ser chamado").max(80),
  senha: z.string().min(8, "A senha precisa de pelo menos 8 caracteres"),
});

/**
 * Cria a conta do convidado e a liga ao projeto.
 *
 * Não passa pelo cadastro comum de propósito: aquele cria um workspace novo
 * para cada pessoa, e é justamente isso que **não** pode acontecer aqui. O
 * convidado não ganha espaço próprio, ele entra no espaço de quem convidou.
 */
export async function aceitarConvite(
  dados: z.input<typeof aceite>,
): Promise<Resposta & { projectId?: string }> {
  const parsed = aceite.safeParse(dados);
  if (!parsed.success) return erro(parsed.error.issues[0].message);

  const c = await db.projectInvite.findUnique({
    where: { token: parsed.data.token },
    include: { project: { select: { id: true, workspaceId: true } } },
  });
  if (!c || c.aceitoEm) return erro("Convite inválido ou já usado");
  if (c.expiraEm && c.expiraEm < new Date()) return erro("Convite expirado");

  const existente = await db.user.findUnique({ where: { email: c.email } });
  if (existente) {
    return erro("Já existe conta com esse e-mail. Entre e abra o link de novo.");
  }

  const user = await db.user.create({
    data: {
      name: parsed.data.nome,
      email: c.email,
      passwordHash: await hashPassword(parsed.data.senha),
      // o convite prova o endereço: o link chegou nele
      emailVerifiedAt: new Date(),
    },
  });

  await db.membership.create({
    data: { userId: user.id, workspaceId: c.project.workspaceId, role: "GUEST" },
  });
  await db.projectAccess.create({
    data: {
      projectId: c.project.id,
      userId: user.id,
      concedidoPorId: c.criadoPorId,
    },
  });
  await db.projectInvite.update({
    where: { id: c.id },
    data: { aceitoEm: new Date() },
  });

  await createSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    epoch: user.sessionEpoch,
  });
  return { ok: true, projectId: c.project.id };
}

/** Quem já tem conta e abriu o link estando logado. */
export async function entrarComConvite(token: string): Promise<Resposta & { projectId?: string }> {
  const user = await requireUser();
  const c = await db.projectInvite.findUnique({
    where: { token },
    include: { project: { select: { id: true, workspaceId: true } } },
  });
  if (!c || c.aceitoEm) return erro("Convite inválido ou já usado");
  if (c.email !== user.email.toLowerCase()) {
    return erro("Este convite foi feito para outro e-mail.");
  }

  await db.membership.upsert({
    where: { userId_workspaceId: { userId: user.id, workspaceId: c.project.workspaceId } },
    update: {},
    create: { userId: user.id, workspaceId: c.project.workspaceId, role: "GUEST" },
  });
  await db.projectAccess.upsert({
    where: { projectId_userId: { projectId: c.project.id, userId: user.id } },
    update: {},
    create: { projectId: c.project.id, userId: user.id, concedidoPorId: c.criadoPorId },
  });
  await db.projectInvite.update({ where: { id: c.id }, data: { aceitoEm: new Date() } });

  return { ok: true, projectId: c.project.id };
}

import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { currentWorkspace, requireUser } from "@/lib/auth";

/**
 * Quem alcança o quê.
 *
 * Até aqui o acesso era uma pergunta só: "esta pessoa é do workspace?". Com
 * convidado de projeto passam a ser duas, e a segunda é "e ela alcança **este**
 * projeto?". Como o app filtra por workspace em dezenas de lugares, esquecer
 * um deles não daria erro: daria vazamento silencioso, que é o pior tipo.
 *
 * Por isso tudo converge para cá. Nenhuma consulta de projeto deve montar o
 * próprio `where` de visibilidade; ela pede o filtro a este módulo.
 *
 * A regra é curta de propósito: **só `GUEST` é restrito**. Dono, admin e
 * membro continuam vendo o workspace inteiro, exatamente como antes, o que
 * mantém o comportamento de todo mundo que já usa.
 */

/**
 * Ids que a pessoa alcança, ou `null` quando ela alcança tudo.
 *
 * `null` não é "nenhum": é "sem restrição". A distinção importa porque um
 * array vazio (convidado sem nenhum projeto) tem que resultar em **nada
 * visível**, e um `null` tem que resultar em tudo. Trocar os dois por engano
 * abriria o workspace para o convidado.
 */
export const projetosPermitidos = cache(async (): Promise<string[] | null> => {
  const user = await requireUser();
  const vinculo = user.memberships[0];
  if (!vinculo) throw new Error("NO_WORKSPACE");
  if (vinculo.role !== "GUEST") return null;

  const acessos = await db.projectAccess.findMany({
    where: { userId: user.id, project: { workspaceId: vinculo.workspaceId } },
    select: { projectId: true },
  });
  return acessos.map((a) => a.projectId);
});

export const ehConvidado = cache(async () => {
  const user = await requireUser();
  return user.memberships[0]?.role === "GUEST";
});

/**
 * Filtro pronto para usar em `db.project.findMany({ where: ... })`.
 *
 * Já traz o workspace junto, para que ninguém precise lembrar de somar os
 * dois.
 */
export async function filtroDeProjetos() {
  const workspace = await currentWorkspace();
  const permitidos = await projetosPermitidos();
  return permitidos === null
    ? { workspaceId: workspace.id }
    : { workspaceId: workspace.id, id: { in: permitidos } };
}

/**
 * O mesmo filtro, para quando o projeto é uma relação (tarefa, anotação,
 * sprint, anexo). Use como `where: { project: await filtroDeProjetoRelacao() }`.
 */
export async function filtroDeProjetoRelacao() {
  return filtroDeProjetos();
}

/**
 * Confirma que a pessoa alcança este projeto, e devolve o projeto.
 *
 * Devolve `null` em vez de lançar, para que cada chamador decida entre 404 e
 * erro. Quem lança sem pensar acaba mostrando "algo deu errado" onde o certo
 * era "não existe".
 */
export async function projetoPermitido(projectId: string) {
  const workspace = await currentWorkspace();
  const permitidos = await projetosPermitidos();
  if (permitidos !== null && !permitidos.includes(projectId)) return null;

  return db.project.findFirst({
    where: { id: projectId, workspaceId: workspace.id },
    select: { id: true, name: true, key: true },
  });
}

/** Versão que interrompe, para ações de escrita. */
export async function exigirProjeto(projectId: string) {
  const projeto = await projetoPermitido(projectId);
  if (!projeto) throw new Error("Projeto não encontrado");
  return projeto;
}

/**
 * O mesmo escopo, para quem entra por chave de API ou pelo conector do Claude.
 *
 * Esse caminho não tem sessão: a identidade vem do token. Se ficasse de fora,
 * bastaria um convidado criar uma chave em Configurações para ler o workspace
 * inteiro pela API, contornando tudo que a tela protege. É o furo mais fácil
 * de esquecer justamente porque a tela continuaria correta.
 */
export async function escopoDoChamador(caller: {
  userId: string;
  workspaceId: string;
}) {
  const vinculo = await db.membership.findUnique({
    where: {
      userId_workspaceId: {
        userId: caller.userId,
        workspaceId: caller.workspaceId,
      },
    },
    select: { role: true },
  });

  if (!vinculo || vinculo.role !== "GUEST") {
    return { workspaceId: caller.workspaceId };
  }

  const acessos = await db.projectAccess.findMany({
    where: { userId: caller.userId, project: { workspaceId: caller.workspaceId } },
    select: { projectId: true },
  });
  return { workspaceId: caller.workspaceId, id: { in: acessos.map((a) => a.projectId) } };
}

/**
 * Barreira para o que é do workspace, não do projeto.
 *
 * O convidado trabalha **dentro** de um projeto: cria tarefa, move no quadro,
 * comenta. O que ele não faz é mexer na estrutura, e a linha é essa: criar ou
 * apagar projeto, mudar colunas e sprints, mexer em etiquetas, renomear o
 * workspace, convidar gente. São decisões que valem para todo mundo, e quem as
 * toma é quem é do time.
 */
export async function exigirMembroDoWorkspace() {
  if (await ehConvidado()) throw new Error("SEM_ACESSO");
}

/** O chamador de API é convidado? Mesma pergunta de `ehConvidado`, sem sessão. */
export async function chamadorEhConvidado(caller: {
  userId: string;
  workspaceId: string;
}) {
  const vinculo = await db.membership.findUnique({
    where: {
      userId_workspaceId: {
        userId: caller.userId,
        workspaceId: caller.workspaceId,
      },
    },
    select: { role: true },
  });
  return vinculo?.role === "GUEST";
}

/** Barreira de escrita estrutural pela API e pelo conector. */
export async function exigirMembroDoChamador(caller: {
  userId: string;
  workspaceId: string;
}) {
  if (await chamadorEhConvidado(caller)) throw new Error("SEM_ACESSO");
}

/**
 * Filtro da lista de pessoas para quem entra por chave.
 *
 * Espelha a regra da tela: convidado recebe só quem tem a ver com os projetos
 * dele. Sem isto, a rota de workspace entregaria o time inteiro por fora.
 */
export async function filtroDeMembrosDoChamador(caller: {
  userId: string;
  workspaceId: string;
}) {
  if (!(await chamadorEhConvidado(caller))) {
    return { workspaceId: caller.workspaceId };
  }
  const acessos = await db.projectAccess.findMany({
    where: { userId: caller.userId, project: { workspaceId: caller.workspaceId } },
    select: { projectId: true },
  });
  const ids = acessos.map((a) => a.projectId);
  return {
    workspaceId: caller.workspaceId,
    user: {
      OR: [
        { assignedTasks: { some: { projectId: { in: ids } } } },
        { reportedTasks: { some: { projectId: { in: ids } } } },
        { acessos: { some: { projectId: { in: ids } } } },
      ],
    },
  };
}

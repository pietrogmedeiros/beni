"use server";

import { currentWorkspace, requireUser } from "@/lib/auth";
import { isFeedbackAdmin } from "@/server/feedback";
import {
  carregarPainel,
  registrar,
  type Evento,
  type Painel,
} from "@/server/telemetria";

/**
 * Registra que uma tela foi vista.
 *
 * Quem chama é um componente de cliente, no momento em que o navegador
 * realmente montou a tela. Fazer isso no servidor, dentro da própria página,
 * seria mais barato — mas o Next renderiza páginas antecipadamente ao passar o
 * mouse sobre um link, e a contagem encheria de telas que ninguém chegou a ver.
 */
export async function registrarVisao(evento: Evento) {
  try {
    const user = await requireUser();
    const workspace = user.memberships[0]?.workspaceId ?? null;
    registrar(evento, { userId: user.id, workspaceId: workspace ?? undefined });
  } catch {
    // sem sessão não há o que registrar, e isso não é erro
  }
}

export async function podeVerTelemetria() {
  const user = await requireUser();
  return isFeedbackAdmin(user.email);
}

export async function dadosDoPainel(incluirInternos = false): Promise<Painel> {
  const user = await requireUser();
  if (!(await isFeedbackAdmin(user.email))) throw new Error("SEM_PERMISSAO");
  return carregarPainel(incluirInternos);
}

/** Atalho para as ações do servidor que já sabem o workspace. */
export async function registrarAcao(
  evento: Evento,
  meta?: Record<string, unknown>,
) {
  try {
    const [user, workspace] = await Promise.all([requireUser(), currentWorkspace()]);
    registrar(evento, { userId: user.id, workspaceId: workspace.id, meta });
  } catch {
    /* idem */
  }
}

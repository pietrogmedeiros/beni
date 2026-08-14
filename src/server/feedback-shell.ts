import "server-only";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { isFeedbackAdmin } from "@/server/feedback";
import {
  CONVITE_IDADE_MINIMA_DIAS,
  CONVITE_TAREFAS_MINIMAS,
} from "@/lib/feedback";

/**
 * O que o layout precisa saber sobre feedback.
 *
 * Fica separado das Server Actions porque isto roda em toda navegação: o custo
 * de cada consulta aqui é pago pela aplicação inteira, então as duas respostas
 * saem cedo na maioria dos casos.
 */

export async function podeTriarFeedback() {
  const user = await requireUser();
  return isFeedbackAdmin(user.email);
}

/**
 * Decide se o convite único aparece.
 *
 * Ordem pensada para custar nada em regime: quem já foi convidado sai na
 * primeira linha (é a maioria depois da primeira semana), e a idade da conta
 * — que já veio na sessão — corta antes de qualquer ida ao banco. Só sobra
 * consulta para quem está exatamente na janela de ser convidado.
 */
export async function deveConvidar(projectIds: string[]) {
  const user = await requireUser();
  if (user.feedbackPromptedAt) return false;

  const dias = (Date.now() - user.createdAt.getTime()) / 86_400_000;
  if (dias < CONVITE_IDADE_MINIMA_DIAS) return false;
  if (projectIds.length === 0) return false;

  const tarefas = await db.task.count({
    where: { projectId: { in: projectIds } },
  });
  return tarefas >= CONVITE_TAREFAS_MINIMAS;
}

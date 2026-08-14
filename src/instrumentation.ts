/**
 * Ponto de partida do servidor.
 *
 * O Next chama isto uma vez, quando o processo sobe — é onde o agendador do
 * resumo diário nasce. Fica atrás da checagem de runtime porque o mesmo
 * arquivo é carregado no edge, onde `setInterval` de longa duração não faz
 * sentido.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { iniciarAgendador } = await import("@/server/scheduler");
  iniciarAgendador();
}

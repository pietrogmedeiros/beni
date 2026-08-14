import "server-only";
import { enviarResumoDiario } from "@/server/notify";
import { emailEnabled } from "@/server/email";

/**
 * Agendamento do resumo diário, dentro do próprio processo.
 *
 * A VM não tem serviço de cron e o app roda numa instância só — um
 * `setInterval` resolve sem infraestrutura nova. A checagem é de hora em hora,
 * e o envio só acontece na hora configurada; quem garante que ninguém receba
 * duas vezes é a chave do `EmailLog`, não este relógio.
 *
 * Se um dia houver mais de uma réplica, isto continua correto pelo mesmo
 * motivo: as duas tentariam, e só a primeira gravaria a chave.
 */
const HORA = Number(process.env.DIGEST_HOUR ?? 8);
const FUSO = process.env.DIGEST_TZ ?? "America/Sao_Paulo";

let iniciado = false;

function horaLocal() {
  return Number(
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: FUSO,
      hour: "numeric",
      hour12: false,
    }).format(new Date()),
  );
}

export function iniciarAgendador() {
  if (iniciado || !emailEnabled()) return;
  iniciado = true;

  const verificar = () => {
    if (horaLocal() !== HORA) return;
    enviarResumoDiario()
      .then((r) => {
        if (r.enviados > 0) console.log(`[resumo] ${r.enviados} e-mail(s) enviados`);
      })
      .catch((e) => console.error("[resumo] falhou:", (e as Error).message));
  };

  // a primeira checagem espera um minuto: no boot o banco pode ainda não estar
  // aceitando conexão, e uma falha aqui não deve aparecer como erro de partida
  setTimeout(verificar, 60_000);
  setInterval(verificar, 30 * 60_000).unref?.();

  console.log(`[resumo] agendado para ${HORA}h (${FUSO})`);
}

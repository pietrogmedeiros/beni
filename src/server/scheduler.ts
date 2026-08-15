import "server-only";
import { db } from "@/lib/db";
import { enviarResumoDiario } from "@/server/notify";
import { emailEnabled } from "@/server/email";
import { removeUpload } from "@/lib/uploads";
import { limparTokensVencidos } from "@/server/auth-tokens";

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

/**
 * Recolhe print que foi colado no formulário de feedback e nunca enviado.
 *
 * O arquivo sobe antes de o feedback existir, então quem desiste no meio deixa
 * um anexo sem dono. Um dia de carência é folga suficiente para qualquer
 * formulário aberto, e sem isto os bytes ficam no banco para sempre.
 */
async function limparAnexosSoltos() {
  const ontem = new Date(Date.now() - 24 * 60 * 60_000);
  const orfaos = await db.attachment.findMany({
    where: {
      taskId: null,
      noteId: null,
      feedbackId: null,
      createdAt: { lt: ontem },
    },
    select: { id: true, storageKey: true },
    take: 500,
  });
  if (orfaos.length === 0) return;

  await db.attachment.deleteMany({ where: { id: { in: orfaos.map((o) => o.id) } } });
  for (const orfao of orfaos) await removeUpload(orfao.storageKey);
  console.log(`[limpeza] ${orfaos.length} anexo(s) sem dono removido(s)`);
}

export function iniciarAgendador() {
  if (iniciado) return;
  iniciado = true;

  // a limpeza não depende de e-mail configurado
  const limpar = () => {
    limparAnexosSoltos().catch((e) =>
      console.error("[limpeza] falhou:", (e as Error).message),
    );
    limparTokensVencidos().catch((e) =>
      console.error("[limpeza] tokens:", (e as Error).message),
    );
  };
  setTimeout(limpar, 90_000);
  setInterval(limpar, 6 * 60 * 60_000).unref?.();

  if (!emailEnabled()) return;

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

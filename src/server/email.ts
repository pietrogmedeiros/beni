import "server-only";
import { db } from "@/lib/db";

/**
 * Envio de e-mail pelo Resend.
 *
 * Chamada HTTP direta em vez do SDK: é um POST com JSON, e uma dependência a
 * menos é uma dependência a menos para atualizar e auditar.
 *
 * **Nada aqui derruba o pedido do usuário.** Um e-mail é aviso, não a ação —
 * se o Resend estiver fora do ar, a tarefa ainda tem que ser criada. Por isso
 * toda falha vira registro no log do servidor e segue adiante.
 */

// endereço da API; trocável no teste para apontar a um servidor local
const API = process.env.RESEND_API_URL ?? "https://api.resend.com/emails";

export function emailEnabled() {
  return !!process.env.RESEND_API_KEY;
}

function remetente() {
  return process.env.EMAIL_FROM ?? "Beni <beni@benicio.space>";
}

export function appUrl() {
  return (process.env.APP_URL ?? "https://app.benicio.space").replace(/\/$/, "");
}

type Envio = {
  para: string;
  assunto: string;
  titulo: string;
  /** Parágrafos do corpo. */
  corpo: string[];
  botao?: { texto: string; url: string };
  rodape?: string;
};

/** Escapa o que vai para dentro do HTML — nome de tarefa é texto de usuário. */
function esc(texto: string) {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Um só desenho para todos os avisos.
 *
 * Tabelas e estilo em linha porque cliente de e-mail ignora folha de estilo e
 * boa parte do CSS moderno — o que é feio no navegador é o que funciona no
 * Outlook.
 */
function montarHtml({ titulo, corpo, botao, rodape }: Envio) {
  const paragrafos = corpo
    .map(
      (p) =>
        `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3f3f46">${p}</p>`,
    )
    .join("");

  const acao = botao
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0">
         <tr><td style="border-radius:8px;background:#eab308">
           <a href="${esc(botao.url)}" style="display:inline-block;padding:10px 20px;font-size:14px;font-weight:600;color:#3b2c05;text-decoration:none">${esc(botao.texto)}</a>
         </td></tr>
       </table>`
    : "";

  return `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:24px;background:#faf9f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e7e5e4;border-radius:12px">
    <tr><td style="padding:24px">
      <p style="margin:0 0 18px;font-size:13px;font-weight:600;color:#a16207;letter-spacing:.02em">BENI</p>
      <h1 style="margin:0 0 14px;font-size:19px;line-height:1.35;color:#18181b">${esc(titulo)}</h1>
      ${paragrafos}
      ${acao}
      <p style="margin:18px 0 0;padding-top:14px;border-top:1px solid #f0efed;font-size:12px;color:#a1a1aa">
        ${rodape ? `${esc(rodape)}<br />` : ""}
        Para não receber mais estes avisos, ajuste em
        <a href="${appUrl()}/settings" style="color:#a16207">Configurações</a>.
      </p>
    </td></tr>
  </table>
</body></html>`;
}

function montarTexto({ titulo, corpo, botao }: Envio) {
  // `<br>` vira quebra antes de tirar as tags: sem isso a versão em texto puro
  // sai com a lista inteira grudada numa linha só
  const semTags = corpo.map((p) =>
    p.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, ""),
  );
  return [titulo, "", ...semTags, botao ? `\n${botao.texto}: ${botao.url}` : ""]
    .join("\n")
    .trim();
}

async function enviar(envio: Envio) {
  if (!emailEnabled()) return false;

  try {
    const resposta = await fetch(API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: remetente(),
        to: [envio.para],
        subject: envio.assunto,
        html: montarHtml(envio),
        text: montarTexto(envio),
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!resposta.ok) {
      console.error(`[email] ${resposta.status}: ${(await resposta.text()).slice(0, 200)}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[email] falhou:", (error as Error).message);
    return false;
  }
}

/**
 * Envia uma vez só.
 *
 * A chave descreve o fato — "tarefa X venceu no dia Y" —, então reiniciar o
 * container ou rodar a rotina duas vezes não gera e-mail repetido. Marcamos
 * antes de enviar: em caso de corrida, é melhor um aviso perdido do que dois
 * na caixa de alguém.
 */
export async function enviarUmaVez(
  userId: string,
  kind: string,
  key: string,
  envio: Envio,
) {
  if (!emailEnabled()) return false;

  // `createMany` com `skipDuplicates` em vez de `create` num try/catch: a
  // colisão é o caminho esperado (já enviamos), e não deveria aparecer como
  // erro no log do servidor toda vez.
  const marca = await db.emailLog.createMany({
    data: [{ userId, kind, key }],
    skipDuplicates: true,
  });
  if (marca.count === 0) return false;

  return enviar(envio);
}

export { enviar };

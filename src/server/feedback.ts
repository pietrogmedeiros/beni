import "server-only";
import { readFile } from "node:fs/promises";
import { cache } from "react";
import { db } from "@/lib/db";
import { appUrl, enviar } from "@/server/email";
import { kindLabel } from "@/lib/feedback";

/**
 * Quem enxerga a caixa de entrada do feedback.
 *
 * A lista vem de `FEEDBACK_ADMIN_EMAILS` (separada por vírgula). Não é coluna
 * no banco de propósito: permissão que mora em dado pode ser alterada por
 * qualquer caminho que escreva naquela tabela, e aqui o que está em jogo é ler
 * o que estranhos escreveram sobre o produto.
 *
 * Sem a variável, o dono é **a conta mais antiga da instância** — quem
 * instalou. Isso evita o pior desfecho possível: subir a funcionalidade e a
 * página de triagem não existir para ninguém, nem para quem a construiu.
 */
export const feedbackAdmins = cache(async (): Promise<string[]> => {
  const configurado = (process.env.FEEDBACK_ADMIN_EMAILS ?? "")
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (configurado.length > 0) return configurado;

  const primeiro = await db.user.findFirst({
    orderBy: { createdAt: "asc" },
    select: { email: true },
  });
  return primeiro ? [primeiro.email.toLowerCase()] : [];
});

export async function isFeedbackAdmin(email: string) {
  return (await feedbackAdmins()).includes(email.toLowerCase());
}

/** Carimbo do build no ar — vai junto do relato para saber o que a pessoa viu. */
export const buildStamp = cache(async () => {
  return readFile("/app/.build-stamp", "utf8")
    .then((v) => v.trim())
    .catch(() => process.env.BUILD_STAMP ?? "desenvolvimento");
});

/**
 * Avisa quem tria que chegou recado novo.
 *
 * Na hora, não no resumo: enquanto o volume é baixo, responder no mesmo dia é
 * o que faz alguém mandar o segundo feedback.
 */
export async function avisarFeedbackNovo(feedbackId: string) {
  const feedback = await db.feedback.findUnique({
    where: { id: feedbackId },
    include: { attachments: { select: { id: true } } },
  });
  if (!feedback) return;

  const destinos = await db.user.findMany({
    where: { email: { in: await feedbackAdmins(), mode: "insensitive" } },
    select: { id: true, email: true },
  });

  const quem = feedback.name ?? feedback.email;
  const prints = feedback.attachments.length;

  for (const destino of destinos) {
    await enviar({
      para: destino.email,
      assunto: `${kindLabel(feedback.kind)} — ${quem}`,
      titulo: `${quem} mandou um feedback`,
      corpo: [
        `<strong>${kindLabel(feedback.kind)}</strong>`,
        feedback.message.slice(0, 600).replace(/\n/g, "<br />"),
        [
          feedback.pageUrl ? `Estava em: ${feedback.pageUrl}` : null,
          prints > 0 ? `${prints} print(s) anexado(s)` : null,
          feedback.appBuild ? `Build: ${feedback.appBuild}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
      ],
      botao: { texto: "Abrir a triagem", url: `${appUrl()}/feedback` },
      rodape: `Responder vai para ${feedback.email}.`,
    });
  }
}

/**
 * Conta a quem escreveu que o recado dele andou.
 *
 * É a metade que quase todo canal de feedback esquece — e a razão pela qual
 * ninguém manda o segundo.
 */
export async function avisarAutorDoStatus(feedbackId: string, texto: string) {
  const feedback = await db.feedback.findUnique({ where: { id: feedbackId } });
  if (!feedback) return false;

  const enviado = await enviar({
    para: feedback.email,
    assunto: "Sobre o que você mandou no Beni",
    titulo: "Seu feedback andou",
    corpo: [
      `Você escreveu: <em>“${feedback.message.slice(0, 220)}${feedback.message.length > 220 ? "…" : ""}”</em>`,
      texto.replace(/\n/g, "<br />"),
    ],
    botao: { texto: "Abrir o Beni", url: appUrl() },
    rodape: "Você recebeu isto porque mandou um feedback pelo próprio Beni.",
  });

  if (enviado) {
    await db.feedback.update({
      where: { id: feedbackId },
      data: { respondedAt: new Date() },
    });
  }
  return enviado;
}

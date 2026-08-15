import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { hashToken } from "@/server/api-auth";

/**
 * Tokens de uso único para recuperar senha e confirmar e-mail.
 *
 * As duas coisas são o mesmo problema: provar que quem clicou no link é dono
 * daquela caixa de entrada. Muda só o prazo e o que acontece depois.
 *
 * Como nas chaves de API, o banco guarda só o hash. O valor completo existe
 * uma vez, dentro do e-mail. Assim ler o banco não dá acesso a conta nenhuma.
 */

type Proposito = "RESET_SENHA" | "CONFIRMAR_EMAIL";

/** Recuperação vence rápido; confirmação pode esperar o dia seguinte. */
const VALIDADE_MINUTOS: Record<Proposito, number> = {
  RESET_SENHA: 60,
  CONFIRMAR_EMAIL: 60 * 24 * 3,
};

/**
 * Intervalo mínimo entre dois pedidos iguais.
 *
 * Sem isso, um formulário aberto vira um jeito barato de encher a caixa de
 * outra pessoa — e de queimar a reputação do domínio no caminho.
 */
const ESPERA_SEGUNDOS = 60;

export async function criarToken(userId: string, purpose: Proposito) {
  const recente = await db.authToken.findFirst({
    where: {
      userId,
      purpose,
      usedAt: null,
      createdAt: { gt: new Date(Date.now() - ESPERA_SEGUNDOS * 1000) },
    },
    select: { id: true },
  });
  if (recente) return null;

  // 32 bytes: quem tentar adivinhar precisa de mais tempo do que o token vive
  const raw = randomBytes(32).toString("base64url");

  await db.authToken.create({
    data: {
      userId,
      purpose,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + VALIDADE_MINUTOS[purpose] * 60_000),
    },
  });

  return raw;
}

/** Só olha; não gasta. Serve para a página decidir o que desenhar. */
export async function conferirToken(raw: string, purpose: Proposito) {
  if (!raw) return null;
  const token = await db.authToken.findUnique({
    where: { tokenHash: hashToken(raw) },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  if (!token || token.purpose !== purpose) return null;
  if (token.usedAt) return null;
  if (token.expiresAt < new Date()) return null;
  return token;
}

/**
 * Gasta o token, e só devolve o dono se ninguém tiver gastado antes.
 *
 * O `updateMany` com `usedAt: null` na condição é o que garante uso único
 * mesmo com dois cliques ao mesmo tempo: o banco decide quem chegou primeiro,
 * não o código.
 */
export async function consumirToken(raw: string, purpose: Proposito) {
  const token = await conferirToken(raw, purpose);
  if (!token) return null;

  const marcado = await db.authToken.updateMany({
    where: { id: token.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (marcado.count === 0) return null;

  return token;
}

/** Descarta os outros pedidos do mesmo tipo — um link novo aposenta os velhos. */
export async function invalidarTokens(userId: string, purpose: Proposito) {
  await db.authToken.updateMany({
    where: { userId, purpose, usedAt: null },
    data: { usedAt: new Date() },
  });
}

/** Limpeza dos vencidos, chamada pelo agendador. */
export async function limparTokensVencidos() {
  const { count } = await db.authToken.deleteMany({
    where: { expiresAt: { lt: new Date(Date.now() - 24 * 60 * 60_000) } },
  });
  if (count > 0) console.log(`[limpeza] ${count} token(s) de auth vencido(s)`);
}

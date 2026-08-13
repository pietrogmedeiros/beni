import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { db } from "@/lib/db";

/**
 * OAuth 2.1 para o servidor MCP.
 *
 * O conector do Claude na web não aceita chave fixa: ele descobre os endereços
 * de autorização, registra um cliente sozinho (RFC 7591), manda a pessoa
 * autorizar no navegador e só então troca um código por token. É mais peça do
 * que uma chave no cabeçalho, mas é o que o cliente exige — e tem uma vantagem
 * real: quem autoriza vê na tela o que está liberando, e o token nasce ligado
 * àquela pessoa, revogável como qualquer outra chave.
 *
 * O token emitido no fim é um `ApiToken` comum, então revogar em Configurações
 * corta o acesso do conector também.
 */

/** Endereço público desta instância, do jeito que o cliente a enxerga. */
export async function issuer() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export function newOpaque(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

/** PKCE: o verificador é hasheado e comparado com o desafio guardado. */
export function verifyPkce(verifier: string, challenge: string) {
  const calculado = createHash("sha256").update(verifier).digest("base64url");
  return calculado === challenge;
}

const CODE_TTL_MS = 5 * 60 * 1000;

export async function createAuthorizationCode(input: {
  clientId: string;
  userId: string;
  workspaceId: string;
  redirectUri: string;
  codeChallenge: string;
  scope?: string;
}) {
  const code = newOpaque(24);
  await db.oAuthCode.create({
    data: {
      code,
      clientId: input.clientId,
      userId: input.userId,
      workspaceId: input.workspaceId,
      redirectUri: input.redirectUri,
      codeChallenge: input.codeChallenge,
      scope: input.scope,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });
  return code;
}

/**
 * Troca o código por um token, uma única vez.
 *
 * Marcar como usado antes de emitir evita que dois pedidos simultâneos com o
 * mesmo código gerem dois tokens.
 */
export async function consumeAuthorizationCode(code: string) {
  const registro = await db.oAuthCode.findUnique({ where: { code } });
  if (!registro) throw new Error("invalid_grant");
  if (registro.usedAt) throw new Error("invalid_grant");
  if (registro.expiresAt < new Date()) throw new Error("invalid_grant");

  await db.oAuthCode.update({ where: { id: registro.id }, data: { usedAt: new Date() } });
  return registro;
}

/** Descarta códigos vencidos — a tabela não deve crescer para sempre. */
export async function pruneCodes() {
  await db.oAuthCode
    .deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - CODE_TTL_MS) } } })
    .catch(() => {});
}

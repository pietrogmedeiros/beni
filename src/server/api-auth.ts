import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";

/**
 * Autenticação das rotas de API por chave — o que o MCP usa.
 *
 * A sessão do navegador não serve aqui: ela vive num cookie e depende de
 * login interativo. Uma integração precisa de credencial própria, que se possa
 * revogar sozinha, sem trocar a senha de ninguém.
 *
 * Guardamos só o hash da chave. Roubar o banco não dá acesso à API, e a chave
 * completa aparece uma única vez, na criação.
 */

const PREFIX = "beni_";

export function generateToken() {
  const raw = `${PREFIX}${randomBytes(24).toString("base64url")}`;
  return { raw, hash: hashToken(raw), hint: raw.slice(-4) };
}

export function hashToken(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

export type ApiCaller = {
  userId: string;
  userName: string;
  workspaceId: string;
  tokenId: string;
};

export class ApiAuthError extends Error {
  constructor(
    message: string,
    readonly status = 401,
  ) {
    super(message);
  }
}

/**
 * Lê a chave do cabeçalho `Authorization: Bearer …` (ou `X-Beni-Token`) e
 * devolve quem está chamando.
 *
 * A comparação é pelo hash e em tempo constante: comparar strings com `===`
 * vaza, pelo tempo de resposta, quantos caracteres iniciais estavam certos.
 */
export async function authenticateRequest(request: Request): Promise<ApiCaller> {
  const header =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    request.headers.get("x-beni-token") ??
    "";

  const raw = header.trim();
  if (!raw) throw new ApiAuthError("Faltou a chave de acesso");
  if (!raw.startsWith(PREFIX)) throw new ApiAuthError("Chave inválida");

  const hash = hashToken(raw);
  const token = await db.apiToken.findUnique({
    where: { tokenHash: hash },
    include: { user: { select: { id: true, name: true } } },
  });

  if (!token || token.revokedAt) throw new ApiAuthError("Chave inválida ou revogada");

  const a = Buffer.from(token.tokenHash);
  const b = Buffer.from(hash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new ApiAuthError("Chave inválida");
  }

  // registro de uso: útil para saber se uma chave esquecida ainda está viva
  void db.apiToken
    .update({ where: { id: token.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return {
    userId: token.userId,
    userName: token.user.name,
    workspaceId: token.workspaceId,
    tokenId: token.id,
  };
}

import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

/**
 * Cifra simétrica para segredos guardados no banco (hoje: o token do GitHub).
 * A chave vem do AUTH_SECRET — trocar o segredo invalida os tokens salvos,
 * que é o comportamento desejado.
 */
function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET não configurado");
  return createHash("sha256").update(secret).digest();
}

export function encryptSecret(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);
  return [
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptSecret(value: string | null | undefined) {
  if (!value) return null;
  try {
    const [iv, tag, data] = value.split(".");
    if (!iv || !tag || !data) return null;
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key(),
      Buffer.from(iv, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(data, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

/** Mostra só o final do token, para conferência na tela de configurações. */
export function maskSecret(plain: string | null) {
  if (!plain) return null;
  return `••••••••${plain.slice(-4)}`;
}

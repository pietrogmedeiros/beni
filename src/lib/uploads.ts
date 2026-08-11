import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Armazenamento de anexos em disco.
 *
 * Vídeo e imagem não vão para o banco: um `bytea` de 80 MB transforma cada
 * backup e cada réplica num problema. Os bytes ficam num diretório e o banco
 * guarda só o endereço.
 *
 * **Em produção esse diretório precisa ser um volume.** Sem volume, o sistema
 * de arquivos do container é descartado a cada implantação e os anexos somem
 * enquanto os registros continuam no banco — apontando para o vazio.
 */
export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "/app/uploads";

/** Teto por arquivo. 100 MB cobre vídeo de tela sem virar depósito. */
export const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_MB ?? 100) * 1024 * 1024;

const ALLOWED_PREFIXES = ["image/", "video/", "audio/"];
const ALLOWED_EXACT = new Set([
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/zip",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

export function isAllowedType(mimeType: string) {
  return (
    ALLOWED_PREFIXES.some((p) => mimeType.startsWith(p)) ||
    ALLOWED_EXACT.has(mimeType)
  );
}

/**
 * Nome do arquivo em disco. Nunca reaproveitamos o nome enviado: ele viria do
 * navegador e poderia conter `../` ou barras. O nome original fica no banco,
 * só para exibição.
 */
function storageKeyFor(originalName: string) {
  const ext = path.extname(originalName).slice(0, 12).replace(/[^.\w]/g, "");
  return `${randomUUID()}${ext}`;
}

export function resolveStoragePath(storageKey: string) {
  // defesa em profundidade: mesmo vindo do banco, o nome é normalizado e
  // precisa continuar dentro do diretório de uploads
  const safe = path.basename(storageKey);
  const full = path.join(UPLOAD_DIR, safe);
  if (!full.startsWith(path.resolve(UPLOAD_DIR) + path.sep) && full !== path.join(UPLOAD_DIR, safe)) {
    throw new Error("Caminho de anexo inválido");
  }
  return full;
}

export async function saveUpload(file: File) {
  await mkdir(UPLOAD_DIR, { recursive: true });
  const storageKey = storageKeyFor(file.name);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(resolveStoragePath(storageKey), buffer);
  return {
    storageKey,
    size: buffer.byteLength,
    checksum: createHash("sha256").update(buffer).digest("hex").slice(0, 16),
  };
}

export async function removeUpload(storageKey: string) {
  try {
    await unlink(resolveStoragePath(storageKey));
  } catch {
    // arquivo já sumiu (volume recriado, remoção manual): o registro no banco
    // é apagado do mesmo jeito
  }
}

export async function uploadSize(storageKey: string) {
  try {
    return (await stat(resolveStoragePath(storageKey))).size;
  } catch {
    return null;
  }
}

/** Categoria usada pela interface para decidir como exibir. */
export function kindOf(mimeType: string): "image" | "video" | "audio" | "file" {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "file";
}

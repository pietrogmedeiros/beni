import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Armazenamento de anexos.
 *
 * **Padrão: dentro do Postgres.** Sem `UPLOAD_DIR`, os bytes vão para a coluna
 * `data` da própria tabela. Isso resolve o problema que dói de verdade: no
 * container, o sistema de arquivos é descartado a cada implantação, então um
 * anexo em disco sem volume montado desaparece e deixa o registro apontando
 * para o vazio. No banco ele entra no mesmo backup do resto e pronto.
 *
 * O preço é o backup crescer com os arquivos — por isso o teto padrão é baixo
 * (25 MB), o suficiente para captura de tela e vídeo curto de aprovação. Quem
 * precisar hospedar arquivo grande define `UPLOAD_DIR` apontando para um
 * volume e volta a gravar em disco, com só o endereço no banco.
 *
 * A leitura por faixa não carrega o arquivo inteiro em nenhum dos dois modos:
 * em disco é `createReadStream` com início e fim; no banco é `substring()` do
 * Postgres, que fatia antes de mandar pela rede.
 */
export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? null;

export function usingDisk() {
  return !!UPLOAD_DIR;
}

/** Teto por arquivo: 25 MB no banco, 100 MB quando há volume em disco. */
export const MAX_UPLOAD_BYTES =
  Number(process.env.MAX_UPLOAD_MB ?? (UPLOAD_DIR ? 100 : 25)) * 1024 * 1024;

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
  if (!UPLOAD_DIR) throw new Error("UPLOAD_DIR não configurado");
  // defesa em profundidade: mesmo vindo do banco, o nome é normalizado e
  // precisa continuar dentro do diretório de uploads
  const safe = path.basename(storageKey);
  return path.join(UPLOAD_DIR, safe);
}

export type StoredUpload = {
  storageKey: string | null;
  data: Buffer | null;
  size: number;
  checksum: string;
};

export async function saveUpload(file: File): Promise<StoredUpload> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const checksum = createHash("sha256").update(buffer).digest("hex").slice(0, 16);

  if (!UPLOAD_DIR) {
    return { storageKey: null, data: buffer, size: buffer.byteLength, checksum };
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  const storageKey = storageKeyFor(file.name);
  await writeFile(resolveStoragePath(storageKey), buffer);
  return { storageKey, data: null, size: buffer.byteLength, checksum };
}

export async function removeUpload(storageKey: string | null) {
  if (!storageKey || !UPLOAD_DIR) return;
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

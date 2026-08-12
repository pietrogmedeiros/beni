import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { db, dbSchema } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { resolveStoragePath, uploadSize } from "@/lib/uploads";

export const dynamic = "force-dynamic";

/**
 * Entrega o arquivo de um anexo.
 *
 * Dois caminhos de acesso, nunca mais que isso:
 *  - sessão válida no workspace dono da tarefa;
 *  - `?token=` de uma aprovação ou de um compartilhamento **daquela mesma
 *    tarefa** — é o que permite ao stakeholder ver o vídeo sem ter conta.
 *
 * O token é conferido contra a tarefa do anexo, então um link de aprovação não
 * serve para pescar anexos de outras tarefas.
 */
async function canRead(attachment: { id: string; taskId: string }, token: string | null) {
  const session = await getSession();
  if (session) {
    const allowed = await db.task.findFirst({
      where: {
        id: attachment.taskId,
        project: { workspace: { members: { some: { userId: session.userId } } } },
      },
      select: { id: true },
    });
    if (allowed) return true;
  }

  if (!token) return false;

  const approval = await db.approval.findFirst({
    where: { token, taskId: attachment.taskId },
    select: { id: true },
  });
  if (approval) return true;

  const share = await db.projectShare.findFirst({
    where: { token, project: { tasks: { some: { id: attachment.taskId } } } },
    select: { id: true },
  });
  return !!share;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const token = new URL(request.url).searchParams.get("token");

  const attachment = await db.attachment.findUnique({ where: { id } });
  if (!attachment) return new NextResponse("Não encontrado", { status: 404 });

  if (!(await canRead(attachment, token))) {
    return new NextResponse("Sem permissão", { status: 403 });
  }

  const size = attachment.storageKey
    ? await uploadSize(attachment.storageKey)
    : attachment.size;
  if (size === null) {
    return new NextResponse("Arquivo indisponível", { status: 410 });
  }

  const headers = new Headers({
    "Content-Type": attachment.mimeType,
    "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(attachment.name)}`,
    "Cache-Control": "private, max-age=3600",
    "Accept-Ranges": "bytes",
  });

  // Sem resposta parcial o navegador baixa o vídeo inteiro antes de tocar e
  // não deixa arrastar a linha do tempo. Range é o que torna vídeo utilizável.
  const range = request.headers.get("range");
  const match = range?.match(/^bytes=(\d*)-(\d*)$/);
  if (match) {
    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;

    if (Number.isNaN(start) || start >= size || end < start) {
      return new NextResponse("Faixa inválida", {
        status: 416,
        headers: { "Content-Range": `bytes */${size}` },
      });
    }

    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
    headers.set("Content-Length", String(end - start + 1));

    if (attachment.storageKey) {
      const stream = Readable.toWeb(
        createReadStream(resolveStoragePath(attachment.storageKey), { start, end }),
      ) as ReadableStream;
      return new NextResponse(stream, { status: 206, headers });
    }

    // `substring` do Postgres corta antes de mandar: arrastar a linha do tempo
    // de um vídeo não carrega o arquivo inteiro na memória do servidor.
    // O schema vem da configuração, nunca do pedido; o resto vai parametrizado.
    const [row] = await db.$queryRawUnsafe<{ chunk: Buffer }[]>(
      `SELECT substring(data from $1 for $2) AS chunk
       FROM "${dbSchema()}"."Attachment" WHERE id = $3`,
      start + 1,
      end - start + 1,
      id,
    );
    return new NextResponse(new Uint8Array(row?.chunk ?? Buffer.alloc(0)), {
      status: 206,
      headers,
    });
  }

  headers.set("Content-Length", String(size));

  if (attachment.storageKey) {
    const stream = Readable.toWeb(
      createReadStream(resolveStoragePath(attachment.storageKey)),
    ) as ReadableStream;
    return new NextResponse(stream, { headers });
  }

  return new NextResponse(new Uint8Array(attachment.data ?? Buffer.alloc(0)), {
    headers,
  });
}

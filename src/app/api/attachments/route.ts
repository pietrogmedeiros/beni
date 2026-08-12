import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, currentWorkspace } from "@/lib/auth";
import {
  MAX_UPLOAD_BYTES,
  isAllowedType,
  removeUpload,
  saveUpload,
} from "@/lib/uploads";

export const dynamic = "force-dynamic";
// vídeo passa longe do limite de 1 MB das Server Actions; por isso o envio é
// uma rota própria, que recebe o corpo em multipart sem esse teto
export const maxDuration = 60;

/** Envio de anexo. Só quem tem sessão e acesso à tarefa consegue enviar. */
export async function POST(request: Request) {
  const user = await requireUser();
  const workspace = await currentWorkspace();

  const form = await request.formData();
  const taskId = String(form.get("taskId") ?? "");
  const file = form.get("file");

  if (!taskId || !(file instanceof File)) {
    return NextResponse.json({ error: "Envio incompleto" }, { status: 400 });
  }

  const task = await db.task.findFirst({
    where: { id: taskId, project: { workspaceId: workspace.id } },
    select: { id: true, projectId: true },
  });
  if (!task) {
    return NextResponse.json({ error: "Tarefa não encontrada" }, { status: 404 });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      {
        error: `Arquivo maior que o limite de ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB`,
      },
      { status: 413 },
    );
  }

  const mimeType = file.type || "application/octet-stream";
  if (!isAllowedType(mimeType)) {
    return NextResponse.json(
      { error: `Tipo de arquivo não aceito (${mimeType})` },
      { status: 415 },
    );
  }

  const { storageKey, data, size } = await saveUpload(file);

  try {
    const attachment = await db.attachment.create({
      data: {
        taskId,
        name: file.name.slice(0, 200),
        mimeType,
        size,
        storageKey,
        // o Prisma tipa Bytes como Uint8Array; Buffer é um, mas o tipo é estrito
        data: data ? new Uint8Array(data) : null,
        uploadedById: user.id,
      },
    });

    await db.activity.create({
      data: {
        projectId: task.projectId,
        taskId,
        userId: user.id,
        action: "attachment_added",
        meta: { name: attachment.name, mimeType } as never,
      },
    });

    return NextResponse.json({ id: attachment.id });
  } catch (error) {
    // o arquivo já está no disco; sem registro no banco ele vira lixo órfão
    await removeUpload(storageKey);
    throw error;
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { currentWorkspace, requireUser } from "@/lib/auth";
import { kindOf, removeUpload } from "@/lib/uploads";

export type AttachmentDTO = {
  id: string;
  name: string;
  mimeType: string;
  kind: "image" | "video" | "audio" | "file";
  size: number;
  url: string;
  uploadedBy: string | null;
  createdAt: string;
};

function toDTO(a: {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt: Date;
  uploadedBy?: { name: string } | null;
}): AttachmentDTO {
  return {
    id: a.id,
    name: a.name,
    mimeType: a.mimeType,
    kind: kindOf(a.mimeType),
    size: a.size,
    url: `/api/attachments/${a.id}`,
    uploadedBy: a.uploadedBy?.name ?? null,
    createdAt: a.createdAt.toISOString(),
  };
}

export async function listAttachments(taskId: string): Promise<AttachmentDTO[]> {
  const workspace = await currentWorkspace();
  const rows = await db.attachment.findMany({
    where: { taskId, task: { project: { workspaceId: workspace.id } } },
    include: { uploadedBy: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toDTO);
}

export async function deleteAttachment(id: string) {
  const user = await requireUser();
  const workspace = await currentWorkspace();

  const attachment = await db.attachment.findFirst({
    where: { id, task: { project: { workspaceId: workspace.id } } },
    include: { task: { select: { projectId: true, id: true } } },
  });
  if (!attachment) throw new Error("Anexo não encontrado");

  await db.attachment.delete({ where: { id } });
  await removeUpload(attachment.storageKey);

  if (attachment.task) {
    await db.activity.create({
      data: {
        projectId: attachment.task.projectId,
        taskId: attachment.task.id,
        userId: user.id,
        action: "attachment_removed",
        meta: { name: attachment.name } as never,
      },
    });
    revalidatePath(`/t/${attachment.task.id}`);
  }
}

/** Anexos vistos por quem chega pelo link público — sem sessão. */
export async function publicAttachments(
  taskId: string,
  token: string,
): Promise<AttachmentDTO[]> {
  const approval = await db.approval.findFirst({
    where: { token, taskId },
    select: { id: true },
  });

  const share = approval
    ? null
    : await db.projectShare.findFirst({
        where: { token, project: { tasks: { some: { id: taskId } } } },
        select: { id: true },
      });

  if (!approval && !share) return [];

  const rows = await db.attachment.findMany({
    where: { taskId },
    include: { uploadedBy: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });

  // o token viaja na URL para que o navegador consiga carregar imagem e vídeo
  // direto das tags <img>/<video>, que não mandam cabeçalho nenhum
  return rows.map((r) => ({
    ...toDTO(r),
    url: `/api/attachments/${r.id}?token=${encodeURIComponent(token)}`,
  }));
}

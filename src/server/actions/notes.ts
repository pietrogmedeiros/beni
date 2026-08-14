"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { currentWorkspace, requireUser } from "@/lib/auth";
import { excerpt, newBlock, sanitizeBlocks, type Block } from "@/lib/notes";
import { withBase } from "@/lib/base-path";

export type NoteSummary = {
  id: string;
  title: string;
  icon: string | null;
  excerpt: string;
  updatedAt: string;
  author: string | null;
  shared: boolean;
};

export type NoteDetail = {
  id: string;
  title: string;
  icon: string | null;
  blocks: Block[];
  updatedAt: string;
  shareUrl: string | null;
};

async function noteOf(noteId: string) {
  const workspace = await currentWorkspace();
  const note = await db.note.findFirst({
    where: { id: noteId, project: { workspaceId: workspace.id } },
  });
  if (!note) throw new Error("Anotação não encontrada");
  return note;
}

async function projectOf(projectId: string) {
  const workspace = await currentWorkspace();
  const project = await db.project.findFirst({
    where: { id: projectId, workspaceId: workspace.id },
    select: { id: true },
  });
  if (!project) throw new Error("Projeto não encontrado");
  return project;
}

export async function listNotes(projectId: string): Promise<NoteSummary[]> {
  await projectOf(projectId);

  const notes = await db.note.findMany({
    where: { projectId, archived: false },
    include: { createdBy: { select: { name: true } }, share: { select: { id: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return notes.map((n) => ({
    id: n.id,
    title: n.title,
    icon: n.icon,
    excerpt: excerpt(sanitizeBlocks(n.blocks)),
    updatedAt: n.updatedAt.toISOString(),
    author: n.createdBy?.name ?? null,
    shared: !!n.share,
  }));
}

export async function getNote(noteId: string): Promise<NoteDetail> {
  const note = await noteOf(noteId);
  const share = await db.noteShare.findUnique({ where: { noteId: note.id } });

  return {
    id: note.id,
    title: note.title,
    icon: note.icon,
    blocks: sanitizeBlocks(note.blocks),
    updatedAt: note.updatedAt.toISOString(),
    shareUrl: share ? await publicUrl(share.token) : null,
  };
}

export async function createNote(projectId: string, title = "Sem título") {
  const user = await requireUser();
  await projectOf(projectId);

  const note = await db.note.create({
    data: {
      projectId,
      title,
      createdById: user.id,
      blocks: [newBlock("p", "")] as never,
    },
  });

  revalidatePath(`/p/${projectId}/notas`);
  return { id: note.id };
}

/**
 * Salva o documento.
 *
 * Os blocos passam pela normalização antes de entrar no banco: tipo
 * desconhecido vira parágrafo, texto é limitado e campo estranho some. O que o
 * editor manda é sugestão; o que o documento é, decidimos aqui.
 */
export async function saveNote(
  noteId: string,
  input: { title?: string; icon?: string | null; blocks?: unknown },
) {
  const note = await noteOf(noteId);

  await db.note.update({
    where: { id: note.id },
    data: {
      title: input.title?.trim().slice(0, 200) || undefined,
      icon: input.icon === undefined ? undefined : input.icon,
      blocks: input.blocks === undefined ? undefined : (sanitizeBlocks(input.blocks) as never),
    },
  });

  revalidatePath(`/p/${note.projectId}/notas`);
}

export async function deleteNote(noteId: string) {
  const note = await noteOf(noteId);
  await db.note.delete({ where: { id: note.id } });
  revalidatePath(`/p/${note.projectId}/notas`);
  return { projectId: note.projectId };
}

async function publicUrl(token: string) {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}${withBase(`/nota/${token}`)}`;
}

/**
 * Liga o link público. Idempotente: chamar de novo devolve o mesmo endereço,
 * em vez de invalidar um link que já foi enviado para alguém.
 */
export async function shareNote(noteId: string) {
  const user = await requireUser();
  const note = await noteOf(noteId);

  const existente = await db.noteShare.findUnique({ where: { noteId: note.id } });
  if (existente) return { url: await publicUrl(existente.token) };

  const share = await db.noteShare.create({
    data: {
      noteId: note.id,
      token: randomBytes(32).toString("base64url"),
      createdById: user.id,
    },
  });

  revalidatePath(`/p/${note.projectId}/notas`);
  return { url: await publicUrl(share.token) };
}

export async function revokeNoteShare(noteId: string) {
  const note = await noteOf(noteId);
  await db.noteShare.deleteMany({ where: { noteId: note.id } });
  revalidatePath(`/p/${note.projectId}/notas`);
}

/** Leitura pelo link público — sem sessão, e só o necessário para exibir. */
export async function loadPublicNote(token: string) {
  const share = await db.noteShare.findUnique({
    where: { token },
    include: {
      note: {
        include: {
          project: { select: { name: true, key: true, color: true } },
          createdBy: { select: { name: true } },
        },
      },
    },
  });

  if (!share) return null;
  if (share.expiresAt && share.expiresAt < new Date()) return null;

  return {
    title: share.note.title,
    icon: share.note.icon,
    blocks: sanitizeBlocks(share.note.blocks),
    updatedAt: share.note.updatedAt.toISOString(),
    author: share.note.createdBy?.name ?? null,
    project: share.note.project,
  };
}

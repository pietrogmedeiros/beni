"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { currentWorkspace, requireUser } from "@/lib/auth";
import { generateToken } from "@/server/api-auth";

export type ApiTokenDTO = {
  id: string;
  name: string;
  hint: string;
  createdAt: string;
  lastUsedAt: string | null;
};

export async function listApiTokens(): Promise<ApiTokenDTO[]> {
  const user = await requireUser();
  const workspace = await currentWorkspace();

  const tokens = await db.apiToken.findMany({
    where: { workspaceId: workspace.id, userId: user.id, revokedAt: null },
    orderBy: { createdAt: "desc" },
  });

  return tokens.map((t) => ({
    id: t.id,
    name: t.name,
    hint: t.hint,
    createdAt: t.createdAt.toISOString(),
    lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
  }));
}

/**
 * Cria a chave e devolve o valor completo **uma única vez**.
 *
 * Guardamos só o hash, então não existe "ver de novo" — se a pessoa perder,
 * revoga e cria outra. É a diferença entre um vazamento custar uma chave ou
 * custar todas.
 */
export async function createApiToken(name: string) {
  const user = await requireUser();
  const workspace = await currentWorkspace();

  const { raw, hash, hint } = generateToken();

  await db.apiToken.create({
    data: {
      workspaceId: workspace.id,
      userId: user.id,
      name: name.trim().slice(0, 60) || "Integração",
      tokenHash: hash,
      hint,
    },
  });

  revalidatePath("/settings");
  return { token: raw };
}

export async function revokeApiToken(id: string) {
  const user = await requireUser();
  const workspace = await currentWorkspace();

  await db.apiToken.updateMany({
    where: { id, workspaceId: workspace.id, userId: user.id },
    data: { revokedAt: new Date() },
  });

  revalidatePath("/settings");
}

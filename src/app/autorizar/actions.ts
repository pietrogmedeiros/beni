"use server";

import { redirect } from "next/navigation";
import { currentWorkspace, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAuthorizationCode } from "@/server/oauth";

/**
 * Concede o acesso e devolve a pessoa ao cliente com o código.
 *
 * A sessão é lida aqui de novo, no servidor: o formulário diz o que se quer
 * autorizar, mas quem autoriza é sempre quem está logado — nunca um campo
 * escondido no HTML.
 */
export async function autorizar(formData: FormData) {
  const user = await requireUser();
  const workspace = await currentWorkspace();

  const clientId = String(formData.get("client_id") ?? "");
  const redirectUri = String(formData.get("redirect_uri") ?? "");
  const state = String(formData.get("state") ?? "");
  const codeChallenge = String(formData.get("code_challenge") ?? "");
  const scope = String(formData.get("scope") ?? "beni");

  const client = await db.oAuthClient.findUnique({ where: { clientId } });
  if (!client || !client.redirectUris.includes(redirectUri)) {
    throw new Error("Pedido de autorização inválido");
  }

  const code = await createAuthorizationCode({
    clientId,
    userId: user.id,
    workspaceId: workspace.id,
    redirectUri,
    codeChallenge,
    scope,
  });

  const destino = new URL(redirectUri);
  destino.searchParams.set("code", code);
  if (state) destino.searchParams.set("state", state);
  redirect(destino.toString());
}

/** Recusa: o cliente precisa saber que foi negado, não ficar esperando. */
export async function recusar(formData: FormData) {
  const redirectUri = String(formData.get("redirect_uri") ?? "");
  const state = String(formData.get("state") ?? "");

  const destino = new URL(redirectUri);
  destino.searchParams.set("error", "access_denied");
  if (state) destino.searchParams.set("state", state);
  redirect(destino.toString());
}

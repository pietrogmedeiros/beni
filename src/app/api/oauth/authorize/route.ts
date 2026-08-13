import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Início da autorização.
 *
 * Não decide nada sozinho: confere o pedido, garante que há alguém logado e
 * leva para a tela de consentimento. Quem autoriza é a pessoa, vendo o nome do
 * cliente e o que ele vai poder fazer.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const p = url.searchParams;

  const clientId = p.get("client_id") ?? "";
  const redirectUri = p.get("redirect_uri") ?? "";
  const state = p.get("state") ?? "";
  const challenge = p.get("code_challenge") ?? "";
  const method = p.get("code_challenge_method") ?? "";

  const erro = (motivo: string) =>
    NextResponse.json({ error: "invalid_request", error_description: motivo }, { status: 400 });

  if (p.get("response_type") !== "code") return erro("response_type deve ser code");
  if (!challenge || method !== "S256") return erro("PKCE com S256 é obrigatório");

  const client = await db.oAuthClient.findUnique({ where: { clientId } });
  if (!client) return erro("client_id desconhecido");
  if (!client.redirectUris.includes(redirectUri)) return erro("redirect_uri não registrada");

  const session = await getSession();
  if (!session) {
    // sem sessão não há em nome de quem autorizar; volta para cá depois do login
    redirect(`/login?next=${encodeURIComponent(url.pathname + url.search)}`);
  }

  redirect(
    `/autorizar?${new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      code_challenge: challenge,
      scope: p.get("scope") ?? "beni",
    }).toString()}`,
  );
}

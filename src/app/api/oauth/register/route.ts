import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newOpaque } from "@/server/oauth";

export const dynamic = "force-dynamic";

/**
 * Registro dinâmico de cliente (RFC 7591).
 *
 * O conector do Claude não tem cadastro prévio aqui: ele se apresenta, recebe
 * um `client_id` e segue. Aceitamos qualquer um que peça — o que autoriza de
 * fato é a pessoa, na tela seguinte, com a sessão dela. Sem isso, conectar
 * exigiria cadastrar credenciais à mão dos dois lados.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const redirectUris: string[] = Array.isArray(body.redirect_uris) ? body.redirect_uris : [];

  if (redirectUris.length === 0) {
    return NextResponse.json(
      { error: "invalid_redirect_uri", error_description: "Informe redirect_uris" },
      { status: 400 },
    );
  }

  const clientId = `beni-client-${newOpaque(12)}`;
  const client = await db.oAuthClient.create({
    data: {
      clientId,
      name: String(body.client_name ?? "Cliente MCP").slice(0, 80),
      redirectUris,
      clientSecret: null,
    },
  });

  return NextResponse.json(
    {
      client_id: client.clientId,
      client_name: client.name,
      redirect_uris: client.redirectUris,
      grant_types: ["authorization_code"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
    },
    { status: 201 },
  );
}

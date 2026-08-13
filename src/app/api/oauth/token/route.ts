import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateToken } from "@/server/api-auth";
import { consumeAuthorizationCode, pruneCodes, verifyPkce } from "@/server/oauth";

export const dynamic = "force-dynamic";

/**
 * Troca do código por token.
 *
 * O token emitido é um `ApiToken` normal: aparece em Configurações → Chaves de
 * acesso e revogar ali derruba o conector. Sem essa ligação, um acesso
 * concedido pela web viveria num canto que ninguém enxerga.
 */
export async function POST(request: Request) {
  void pruneCodes();

  const form = await request
    .formData()
    .then((f) => Object.fromEntries(f) as Record<string, string>)
    .catch(async () => (await request.json().catch(() => ({}))) as Record<string, string>);

  if (form.grant_type !== "authorization_code") {
    return NextResponse.json({ error: "unsupported_grant_type" }, { status: 400 });
  }

  try {
    const registro = await consumeAuthorizationCode(String(form.code ?? ""));

    if (registro.clientId !== form.client_id) throw new Error("invalid_grant");
    if (registro.redirectUri !== form.redirect_uri) throw new Error("invalid_grant");
    if (!verifyPkce(String(form.code_verifier ?? ""), registro.codeChallenge)) {
      throw new Error("invalid_grant");
    }

    const cliente = await db.oAuthClient.findUnique({ where: { clientId: registro.clientId } });
    const { raw, hash, hint } = generateToken();

    await db.apiToken.create({
      data: {
        workspaceId: registro.workspaceId,
        userId: registro.userId,
        name: cliente?.name ?? "Conector MCP",
        tokenHash: hash,
        hint,
      },
    });

    return NextResponse.json(
      { access_token: raw, token_type: "Bearer", scope: registro.scope ?? "beni" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "invalid_grant" }, { status: 400 });
  }
}

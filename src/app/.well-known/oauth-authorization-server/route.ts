import { NextResponse } from "next/server";
import { issuer } from "@/server/oauth";

export const dynamic = "force-dynamic";

/**
 * Metadados do servidor de autorização (RFC 8414).
 *
 * É o primeiro lugar que o conector consulta: daqui ele descobre onde
 * registrar-se, para onde mandar a pessoa autorizar e onde trocar o código.
 */
export async function GET() {
  const base = await issuer();
  return NextResponse.json(
    {
      issuer: base,
      authorization_endpoint: `${base}/api/oauth/authorize`,
      token_endpoint: `${base}/api/oauth/token`,
      registration_endpoint: `${base}/api/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none", "client_secret_post"],
      scopes_supported: ["beni"],
      service_documentation: `${base}`,
      logo_uri: `${base}/beni.png`,
    },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}

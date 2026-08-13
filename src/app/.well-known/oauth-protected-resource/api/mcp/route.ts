import { NextResponse } from "next/server";
import { issuer } from "@/server/oauth";

export const dynamic = "force-dynamic";

/**
 * Metadados do recurso protegido (RFC 9728) — diz ao cliente qual servidor de
 * autorização vale para o endereço do MCP.
 */
export async function GET() {
  const base = await issuer();
  return NextResponse.json(
    {
      resource: `${base}/api/mcp`,
      authorization_servers: [base],
      bearer_methods_supported: ["header"],
      resource_name: "Beni",
      resource_documentation: base,
    },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}

import { NextResponse } from "next/server";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { ApiAuthError, authenticateRequest } from "@/server/api-auth";
import { buildMcpServer, runMcpRequest } from "@/server/mcp-server";
import { issuer } from "@/server/oauth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Endereço do servidor MCP remoto — é o que se cadastra como conector no
 * Claude da web.
 *
 * Sem sessão entre requisições: cada POST traz uma mensagem JSON-RPC, é
 * respondido e acabou. Isso serve bem a um app que pode ter mais de uma
 * réplica e reiniciar a cada implantação, situações em que guardar sessão em
 * memória quebraria no meio de uma conversa.
 *
 * A chave pode vir no cabeçalho `Authorization: Bearer` ou como `?token=` na
 * própria URL — alguns clientes de conector não deixam configurar cabeçalho.
 */
async function autenticar(request: Request) {
  const url = new URL(request.url);
  const naUrl = url.searchParams.get("token");

  if (naUrl && !request.headers.get("authorization")) {
    const copia = new Request(request.url, {
      method: request.method,
      headers: { ...Object.fromEntries(request.headers), authorization: `Bearer ${naUrl}` },
    });
    return authenticateRequest(copia);
  }
  return authenticateRequest(request);
}

export async function POST(request: Request) {
  let caller;
  try {
    caller = await autenticar(request);
  } catch (error) {
    const status = error instanceof ApiAuthError ? error.status : 401;
    const base = await issuer();
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        error: {
          code: -32001,
          message: error instanceof Error ? error.message : "Não autorizado",
        },
        id: null,
      },
      {
        status,
        headers: {
          // é por este cabeçalho que o cliente descobre que existe OAuth aqui e
          // onde encontrá-lo; sem ele, o conector só vê um 401 e desiste
          "WWW-Authenticate": `Bearer resource_metadata="${base}/.well-known/oauth-protected-resource/api/mcp"`,
        },
      },
    );
  }

  let body: JSONRPCMessage | JSONRPCMessage[];
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { jsonrpc: "2.0", error: { code: -32700, message: "JSON inválido" }, id: null },
      { status: 400 },
    );
  }

  const mensagens = Array.isArray(body) ? body : [body];
  const respostas: JSONRPCMessage[] = [];
  const base = await issuer();

  for (const mensagem of mensagens) {
    const server = buildMcpServer(caller, base);
    respostas.push(...(await runMcpRequest(server, mensagem)));
  }

  // notificação não gera resposta: 202 sem corpo é o que o protocolo espera
  if (respostas.length === 0) return new NextResponse(null, { status: 202 });

  return NextResponse.json(Array.isArray(body) ? respostas : respostas[0]);
}

/**
 * O transporte HTTP prevê um GET que abre fluxo de eventos para o servidor
 * empurrar mensagens. Aqui não há nada a empurrar — as ferramentas só
 * respondem quando perguntadas —, então recusamos explicitamente em vez de
 * deixar o cliente esperando uma conexão que nunca falaria.
 */
export function GET() {
  return NextResponse.json(
    { jsonrpc: "2.0", error: { code: -32000, message: "Este servidor não usa fluxo de eventos" }, id: null },
    { status: 405 },
  );
}

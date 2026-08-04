import { getSession } from "@/lib/auth";
import { subscribe } from "@/server/chat-bus";

export const dynamic = "force-dynamic";

/**
 * Fluxo de eventos do chat (Server-Sent Events).
 *
 * Mantém a interface aberta em tempo real sem WebSocket: o cliente recebe um
 * aviso do que mudou e recarrega só o que precisa via Server Action.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // conexão já fechada
        }
      };

      send({ type: "ready" });
      const unsubscribe = subscribe(send);

      // comentário periódico evita que proxies derrubem a conexão ociosa
      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          /* ignora */
        }
      }, 25_000);

      request.signal.addEventListener("abort", () => {
        clearInterval(keepAlive);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* já fechado */
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

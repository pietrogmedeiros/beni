import "server-only";
import { EventEmitter } from "node:events";

/**
 * Barramento de eventos do chat em memória.
 *
 * Suficiente para uma instância (é como o app roda no Docker Compose). Para
 * rodar várias réplicas, troque por LISTEN/NOTIFY do Postgres ou Redis pub/sub
 * mantendo a mesma interface `publish`/`subscribe`.
 */
export type ChatEvent =
  | { type: "message"; channelId: string; messageId: string; parentId: string | null }
  | { type: "message.updated"; channelId: string; messageId: string }
  | { type: "message.deleted"; channelId: string; messageId: string }
  | { type: "reaction"; channelId: string; messageId: string }
  | { type: "channel"; channelId: string };

const globalForBus = globalThis as unknown as { chatBus?: EventEmitter };

const bus =
  globalForBus.chatBus ??
  (() => {
    const emitter = new EventEmitter();
    // muitos assinantes: cada aba aberta mantém um SSE
    emitter.setMaxListeners(0);
    globalForBus.chatBus = emitter;
    return emitter;
  })();

export function publish(event: ChatEvent) {
  bus.emit("event", event);
}

export function subscribe(listener: (event: ChatEvent) => void) {
  bus.on("event", listener);
  return () => bus.off("event", listener);
}

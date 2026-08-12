"use client";

import { useEffect, useRef } from "react";
import { withBase } from "@/lib/base-path";

/**
 * Uma única conexão SSE por aba, compartilhada por quem precisar.
 *
 * Antes cada componente interessado abria a sua: a barra do topo, o painel
 * lateral, a casca do app e a tela de chat — três conexões permanentes numa
 * aba comum. O navegador limita conexões simultâneas por host (seis, em
 * HTTP/1.1), então **duas abas abertas já esgotavam o limite** e tudo o mais
 * ficava pendurado esperando uma vaga que não abria: navegação, ações,
 * qualquer coisa. Foi assim que o app apareceu "travado" com requisições
 * eternamente em `(pending)`.
 *
 * Com uma conexão só, quatro abas cabem no mesmo orçamento que antes mal
 * segurava duas.
 */
type Listener = (data: unknown) => void;

let source: EventSource | null = null;
const listeners = new Set<Listener>();

function ensureConnection() {
  if (source) return;

  source = new EventSource(withBase("/api/chat/stream"));
  source.onmessage = (event) => {
    let data: unknown = null;
    try {
      data = JSON.parse(event.data);
    } catch {
      return;
    }

    // O servidor manda `ready` só para confirmar que a conexão subiu. Tratar
    // isso como novidade fazia cada ouvinte recarregar seus dados na abertura
    // — uma rodada inteira de consultas ao servidor a troco de nada.
    if ((data as { type?: string })?.type === "ready") return;

    for (const listener of listeners) listener(data);
  };

  source.onerror = () => {
    // o EventSource reconecta sozinho; derrubar aqui impediria a retomada
  };
}

function release() {
  if (listeners.size > 0) return;
  source?.close();
  source = null;
}

export type ChatEvent = { type: string; channelId?: string };

/**
 * Ouve o fluxo do chat.
 *
 * Os avisos são agrupados por um curto intervalo e entregues em lote: uma
 * rajada de mensagens dispararia uma consulta por evento, e o que interessa a
 * quem ouve é o estado final. O lote preserva todos os eventos do intervalo —
 * agrupar guardando só o último faria uma mensagem no canal aberto sumir
 * quando outra chegasse logo atrás em canal diferente.
 */
export function useChatStream(
  onEvents: (events: ChatEvent[]) => void,
  debounceMs = 250,
) {
  const callback = useRef(onEvents);
  // manter a referência fresca sem reassinar o fluxo a cada render
  useEffect(() => {
    callback.current = onEvents;
  }, [onEvents]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let pending: ChatEvent[] = [];

    const listener: Listener = (data) => {
      pending.push(data as ChatEvent);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const batch = pending;
        pending = [];
        callback.current(batch);
      }, debounceMs);
    };

    listeners.add(listener);
    ensureConnection();

    return () => {
      if (timer) clearTimeout(timer);
      listeners.delete(listener);
      release();
    };
  }, [debounceMs]);
}

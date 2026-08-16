"use client";

import { useEffect } from "react";
import { registrarVisao } from "@/server/actions/telemetria";
import type { Evento } from "@/server/telemetria";

/**
 * Marca que esta tela foi vista.
 *
 * Componente sem aparência, colocado dentro de cada visão. Registra uma vez
 * por aba e por dia: para decidir preço interessa *quem usou o quê*, não
 * quantas vezes alternou entre abas — e gravar cada alternância encheria a
 * tabela de ruído com custo real de banco.
 */
export function RegistrarVisao({ evento }: { evento: Evento }) {
  useEffect(() => {
    const chave = `beni:tel:${evento}:${new Date().toISOString().slice(0, 10)}`;
    if (sessionStorage.getItem(chave)) return;
    sessionStorage.setItem(chave, "1");
    void registrarVisao(evento);
  }, [evento]);

  return null;
}

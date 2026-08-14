"use client";

import { useEffect, useState } from "react";
import { Apple } from "lucide-react";
import { DOWNLOAD_MAC } from "@/lib/constants";

/**
 * Link discreto para o app de Mac, na entrada.
 *
 * Aqui a pessoa ainda não tem conta, então isto é convite, não ferramenta —
 * daí ser uma linha de texto e não um cartão com botão como na página inicial.
 *
 * Mesma regra de sempre: só aparece em Mac, no navegador, fora do próprio app.
 * Como a decisão depende do navegador, nasce oculto — renderizar no servidor
 * mostraria a linha por um quadro para quem ela não serve.
 */
export function DesktopDownloadLink() {
  const [mostrar, setMostrar] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    // o agente é a fonte: `navigator.platform` está obsoleto e, em navegador
    // controlado por automação, não acompanha o agente — o que fez um teste de
    // Windows passar como Mac
    // sincronização com fonte externa (navegador) — intencional
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMostrar(/Mac(intosh)?/i.test(ua) && !ua.includes("BeniDesktop"));
  }, []);

  if (!mostrar) return null;

  return (
    <a
      href={DOWNLOAD_MAC}
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground"
    >
      <Apple className="size-3.5" />
      Baixar o app para Mac
    </a>
  );
}

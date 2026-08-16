"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { BeniMascote } from "@/components/logo";
import { DOWNLOAD_MAC } from "@/lib/constants";

/**
 * Convite para o app de Mac, na entrada.
 *
 * Tem peso de botão e não de link solto: é a única oferta da tela além de
 * entrar, e uma linha de texto miúda ao pé da página passava despercebida.
 *
 * Só aparece em Mac, no navegador, fora do próprio app. Como a decisão depende
 * do navegador, nasce oculto — renderizar no servidor mostraria o convite por
 * um quadro para quem ele não serve.
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
      className="group flex items-center gap-3 rounded-xl border bg-card p-3 transition hover:border-primary/50 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 transition group-hover:bg-primary/15">
        <BeniMascote pose="beni" pequeno className="h-9 w-auto" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">
          Baixar o app para Mac
        </span>
        <span className="block text-[11px] leading-tight text-muted-foreground">
          Janela própria · Intel e Apple Silicon
        </span>
      </span>

      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border text-muted-foreground transition group-hover:border-primary/40 group-hover:bg-primary group-hover:text-primary-foreground">
        <Download className="size-4" />
      </span>
    </a>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Apple, Download, X } from "lucide-react";
import { BeniMascote } from "@/components/logo";
import { DOWNLOAD_MAC } from "@/lib/constants";

const DISPENSADO = "beni:download-mac-dispensado";

/**
 * Convite para baixar o app de macOS.
 *
 * Aparece só para quem pode usar: em Mac, no navegador, fora do próprio app.
 * Oferecer download do app de Mac para quem está no Windows — ou, pior, para
 * quem já está dentro do app — é ruído com cara de propaganda.
 *
 * A decisão de esconder depende do navegador, então nasce oculto e aparece
 * depois da montagem: renderizar no servidor mostraria o convite por um quadro
 * para todo mundo, inclusive para quem ele não serve.
 */
export function DesktopDownload() {
  const [mostrar, setMostrar] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const noApp = ua.includes("BeniDesktop");
    // o agente, e não `navigator.platform`, que está obsoleto
    const ehMac = /Mac(intosh)?/i.test(ua);
    const dispensado = localStorage.getItem(DISPENSADO) === "1";
    // sincronização com fonte externa (navegador, localStorage) — intencional
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMostrar(ehMac && !noApp && !dispensado);
  }, []);

  if (!mostrar) return null;

  return (
    <section className="relative mb-5 overflow-hidden rounded-xl border bg-linear-to-r from-amber-50 to-card p-4 dark:from-amber-950/25">
      <button
        type="button"
        aria-label="Dispensar"
        onClick={() => {
          localStorage.setItem(DISPENSADO, "1");
          setMostrar(false);
        }}
        className="absolute top-2 right-2 rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>

      <div className="flex items-center gap-4">
        <BeniMascote pose="beni" pequeno className="h-20 w-auto shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Apple className="size-3.5" />
            Beni para Mac
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            O mesmo Beni numa janela própria, fora do navegador — com ícone no
            Dock e atalho de teclado. Universal, para Intel e Apple Silicon.
          </p>
        </div>
        <a
          href={DOWNLOAD_MAC}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition hover:opacity-90"
        >
          <Download className="size-3.5" />
          Baixar
        </a>
      </div>
    </section>
  );
}

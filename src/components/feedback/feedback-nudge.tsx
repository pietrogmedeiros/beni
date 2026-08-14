"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { BeniMascote } from "@/components/logo";
import { dispensarConvite } from "@/server/actions/feedback";

/**
 * O convite único.
 *
 * Botão passivo em produto novo recebe pouquíssimo envio: quem trava nos
 * primeiros minutos vai embora sem clicar em nada. Este convite existe para
 * perguntar uma vez, a quem já usou de verdade — e sumir para sempre depois,
 * tenha a pessoa respondido ou não. Perguntar duas vezes é praga; perguntar
 * nenhuma é ficar sem saber.
 */
export function FeedbackNudge({ onAbrir }: { onAbrir: () => void }) {
  const [visivel, setVisivel] = useState(false);
  const [saindo, setSaindo] = useState(false);

  // um respiro antes de aparecer: surgir junto com a tela faz o convite ser
  // dispensado no reflexo, sem ser lido
  useEffect(() => {
    const t = setTimeout(() => setVisivel(true), 2500);
    return () => clearTimeout(t);
  }, []);

  function fechar(abrindo: boolean) {
    setSaindo(true);
    // marca no servidor antes de qualquer coisa: se a pessoa fechar a aba
    // agora, o convite não volta na próxima visita
    void dispensarConvite();
    setTimeout(() => setVisivel(false), 200);
    if (abrindo) onAbrir();
  }

  if (!visivel) return null;

  // sobe acima da faixa dos avisos: o sonner desenha no mesmo canto, e um
  // aviso passando por cima escondia justamente os botões daqui
  return (
    <div
      role="dialog"
      aria-label="Convite para dar feedback"
      className={`fixed right-4 bottom-24 z-40 w-[min(21rem,calc(100vw-2rem))] rounded-xl border bg-popover p-4 text-popover-foreground shadow-lg transition duration-200 ${
        saindo ? "translate-y-2 opacity-0" : "translate-y-0 opacity-100"
      }`}
    >
      <button
        type="button"
        aria-label="Dispensar"
        onClick={() => fechar(false)}
        className="absolute top-2 right-2 rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>

      <div className="flex items-start gap-2.5">
        <BeniMascote pose="prancheta" pequeno className="-mt-1 h-16 w-auto shrink-0" />
        <div className="flex flex-col gap-2 pr-4">
          <p className="text-sm font-medium">Como está sendo usar o Beni?</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            O produto é novo e está sendo construído com quem usa. Se tiver dois
            minutos, conta o que travou — ou o que já está bom.
          </p>
          <div className="flex items-center gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => fechar(true)}
              className="rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground transition hover:opacity-90"
            >
              Quero contar
            </button>
            <button
              type="button"
              onClick={() => fechar(false)}
              className="rounded-md px-2 py-1.5 text-xs text-muted-foreground transition hover:text-foreground"
            >
              Agora não
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

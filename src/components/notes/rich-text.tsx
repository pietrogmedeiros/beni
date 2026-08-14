import { Fragment } from "react";

/**
 * Formatação dentro da linha: **negrito**, *itálico*, `código` e [link](url).
 *
 * O texto é quebrado em pedaços e cada pedaço vira um elemento que **nós**
 * escolhemos — nunca `dangerouslySetInnerHTML`. Assim uma anotação publicada
 * por link aberto não tem como carregar script junto, por mais criativo que
 * seja quem escreveu.
 */
const PADRAO = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;

/** Só http(s) e caminhos internos viram link clicável. */
function linkSeguro(href: string) {
  const limpo = href.trim();
  if (/^https?:\/\//i.test(limpo)) return limpo;
  if (limpo.startsWith("/")) return limpo;
  return null;
}

export function RichText({ text }: { text: string }) {
  if (!text) return null;

  const pedacos = text.split(PADRAO).filter(Boolean);

  return (
    <>
      {pedacos.map((pedaco, i) => {
        const key = `${i}-${pedaco.slice(0, 8)}`;

        if (pedaco.startsWith("**") && pedaco.endsWith("**") && pedaco.length > 4) {
          return <strong key={key}>{pedaco.slice(2, -2)}</strong>;
        }
        if (pedaco.startsWith("*") && pedaco.endsWith("*") && pedaco.length > 2) {
          return <em key={key}>{pedaco.slice(1, -1)}</em>;
        }
        if (pedaco.startsWith("`") && pedaco.endsWith("`") && pedaco.length > 2) {
          return (
            <code key={key} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">
              {pedaco.slice(1, -1)}
            </code>
          );
        }

        const link = pedaco.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
        if (link) {
          const href = linkSeguro(link[2]);
          if (!href) return <Fragment key={key}>{link[1]}</Fragment>;
          return (
            <a
              key={key}
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              className="text-primary-strong underline underline-offset-2"
            >
              {link[1]}
            </a>
          );
        }

        return <Fragment key={key}>{pedaco}</Fragment>;
      })}
    </>
  );
}

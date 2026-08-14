import { Fragment } from "react";

/**
 * Formatação dentro da linha: **negrito**, *itálico*, `código` e [link](url).
 *
 * O texto é quebrado em pedaços e cada pedaço vira um elemento que **nós**
 * escolhemos — nunca `dangerouslySetInnerHTML`. Assim uma anotação publicada
 * por link aberto não tem como carregar script junto, por mais criativo que
 * seja quem escreveu.
 */
/**
 * Domínios que reconhecemos sem `http://` na frente.
 *
 * A lista existe para não transformar `config.json` ou `main.js` em link —
 * numa anotação técnica isso aconteceria o tempo todo. Endereço com esquema
 * (`https://`) ou com `www.` é reconhecido sem depender desta lista.
 */
const TLDS =
  "com|br|net|org|io|dev|app|co|me|ai|space|info|tech|site|online|xyz|gov|edu|blog|cloud|store";

const URL_SOLTA =
  `https?:\\/\\/[^\\s<>()\\[\\]]+` +
  `|www\\.[^\\s<>()\\[\\]]+` +
  `|(?:[a-zA-Z0-9-]+\\.)+(?:${TLDS})(?:\\.[a-z]{2})?(?:\\/[^\\s<>()\\[\\]]*)?` +
  `|\\d{1,3}(?:\\.\\d{1,3}){3}(?:\\/[^\\s<>()\\[\\]]*)?`;

const PADRAO = new RegExp(
  `(\\*\\*[^*]+\\*\\*|\\*[^*]+\\*|\`[^\`]+\`|\\[[^\\]]+\\]\\([^)\\s]+\\)|${URL_SOLTA})`,
  "g",
);

/** Pontuação final não faz parte do endereço: "veja beni.space." */
function separarPontuacao(texto: string): [string, string] {
  const m = texto.match(/[.,;:!?)\]]+$/);
  if (!m) return [texto, ""];
  return [texto.slice(0, -m[0].length), m[0]];
}

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

        // endereço escrito solto no texto vira link clicável
        const ehEndereco =
          /^(https?:\/\/|www\.)/i.test(pedaco) ||
          /^[\w.-]+\.[a-z]{2,}/i.test(pedaco) ||
          /^\d{1,3}(\.\d{1,3}){3}([/:]|$)/.test(pedaco);

        if (ehEndereco) {
          const [endereco, pontuacao] = separarPontuacao(pedaco);
          // endereço de máquina interna costuma não ter TLS; o resto assume https
          const ehIp = /^\d{1,3}(\.\d{1,3}){3}/.test(endereco);
          const href = /^https?:\/\//i.test(endereco)
            ? endereco
            : `${ehIp ? "http" : "https"}://${endereco}`;
          return (
            <Fragment key={key}>
              <a
                href={href}
                target="_blank"
                rel="noreferrer noopener"
                className="text-primary-strong underline underline-offset-2"
              >
                {endereco}
              </a>
              {pontuacao}
            </Fragment>
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

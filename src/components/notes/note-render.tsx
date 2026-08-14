import { CheckSquare, Square } from "lucide-react";
import type { Block } from "@/lib/notes";
import { RichText } from "@/components/notes/rich-text";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/utils";

/**
 * Exibe a anotação em modo leitura.
 *
 * A mesma peça serve a tela do time e a página pública — o que quem recebe o
 * link vê é exatamente o que está no documento, sem uma segunda implementação
 * para divergir com o tempo.
 *
 * `tokenImagem` existe porque a imagem vem de uma rota protegida: na página
 * pública ela precisa carregar o token do compartilhamento na URL, já que
 * `<img>` não manda cabeçalho.
 */
export function NoteRender({
  blocks,
  tokenImagem,
  className,
}: {
  blocks: Block[];
  tokenImagem?: string;
  className?: string;
}) {
  const src = (id: string) =>
    withBase(`/api/attachments/${id}${tokenImagem ? `?token=${encodeURIComponent(tokenImagem)}` : ""}`);

  return (
    <div className={cn("space-y-2", className)}>
      {blocks.map((b, i) => {
        switch (b.type) {
          case "h1":
            return (
              <h2 key={b.id} className="pt-4 text-2xl font-semibold tracking-tight first:pt-0">
                <RichText text={b.text} />
              </h2>
            );
          case "h2":
            return (
              <h3 key={b.id} className="pt-3 text-xl font-semibold tracking-tight first:pt-0">
                <RichText text={b.text} />
              </h3>
            );
          case "h3":
            return (
              <h4 key={b.id} className="pt-2 text-base font-semibold first:pt-0">
                <RichText text={b.text} />
              </h4>
            );
          case "bullet":
            return (
              <div key={b.id} className="flex gap-2 pl-1">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-foreground/60" />
                <p className="flex-1">
                  <RichText text={b.text} />
                </p>
              </div>
            );
          case "number": {
            // numeração contínua enquanto a lista não é interrompida
            let n = 1;
            for (let j = i - 1; j >= 0 && blocks[j].type === "number"; j -= 1) n += 1;
            return (
              <div key={b.id} className="flex gap-2 pl-1">
                <span className="w-4 shrink-0 text-right text-sm text-muted-foreground">{n}.</span>
                <p className="flex-1">
                  <RichText text={b.text} />
                </p>
              </div>
            );
          }
          case "todo":
            return (
              <div key={b.id} className="flex items-start gap-2 pl-1">
                {b.checked ? (
                  <CheckSquare className="mt-0.5 size-4 shrink-0 text-primary-strong" />
                ) : (
                  <Square className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                )}
                <p className={cn("flex-1", b.checked && "text-muted-foreground line-through")}>
                  <RichText text={b.text} />
                </p>
              </div>
            );
          case "quote":
            return (
              <blockquote
                key={b.id}
                className="border-l-2 border-primary/50 py-0.5 pl-3 text-foreground/90 italic"
              >
                <RichText text={b.text} />
              </blockquote>
            );
          case "code":
            return (
              <pre
                key={b.id}
                className="thin-scrollbar overflow-x-auto rounded-lg bg-muted px-3 py-2 font-mono text-xs"
              >
                <code>{b.text}</code>
              </pre>
            );
          case "divider":
            return <hr key={b.id} className="my-4" />;
          case "image":
            return (
              <figure key={b.id} className="my-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src(b.attachmentId!)}
                  alt={b.caption || ""}
                  loading="lazy"
                  className="max-h-[70vh] w-auto max-w-full rounded-lg border"
                />
                {b.caption && (
                  <figcaption className="mt-1 text-xs text-muted-foreground">{b.caption}</figcaption>
                )}
              </figure>
            );
          default:
            return b.text.trim() ? (
              <p key={b.id} className="leading-relaxed">
                <RichText text={b.text} />
              </p>
            ) : (
              <p key={b.id} className="h-3" />
            );
        }
      })}
    </div>
  );
}

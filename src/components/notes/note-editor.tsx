"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CheckSquare, GripVertical, Loader2, Plus, Square, Trash2, X } from "lucide-react";
import { newBlock, SHORTCUTS, type Block, type BlockType } from "@/lib/notes";
import { RichText } from "@/components/notes/rich-text";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/utils";

/**
 * Editor de anotações em blocos.
 *
 * Cada linha é um bloco com seu próprio campo de texto. Enter cria o próximo,
 * Backspace no começo junta com o anterior, e prefixos de Markdown (`# `,
 * `- `, `[] `, `> `) trocam o tipo enquanto se digita — o hábito do Notion,
 * sem a máquina do Notion.
 *
 * Campos de texto simples, e não uma área editável de HTML: assim o que é
 * digitado nunca vira marcação, e o documento continua sendo dado. É o que
 * permite publicá-lo por link aberto sem medo.
 */

/** Posição na lista numerada: conta para trás até a lista ser interrompida. */
function ordinal(blocks: Block[], index: number) {
  let n = 1;
  for (let i = index - 1; i >= 0 && blocks[i].type === "number"; i -= 1) n += 1;
  return n;
}

const PLACEHOLDER: Partial<Record<BlockType, string>> = {
  p: "Escreva algo, ou cole um print…",
  h1: "Título",
  h2: "Subtítulo",
  h3: "Seção",
  bullet: "Item",
  number: "Item",
  todo: "A fazer",
  quote: "Citação",
  code: "Código",
};

export function NoteEditor({
  noteId,
  initialBlocks,
  onChange,
}: {
  noteId: string;
  initialBlocks: Block[];
  onChange: (blocks: Block[]) => void;
}) {
  const [blocks, setBlocks] = useState<Block[]>(
    initialBlocks.length ? initialBlocks : [newBlock()],
  );
  const [enviando, setEnviando] = useState(false);
  const [focado, setFocado] = useState<string | null>(null);
  const refs = useRef(new Map<string, HTMLTextAreaElement>());
  const focarDepois = useRef<string | null>(null);
  /** Onde deixar o cursor quando o campo aparecer. */
  const cursorAlvo = useRef<number | null>(null);

  const atualizar = useCallback(
    (proximos: Block[]) => {
      setBlocks(proximos);
      onChange(proximos);
    },
    [onChange],
  );

  // bloco recém-criado entra em edição (para o botão "adicionar", que não
  // passa pelo teclado)
  useEffect(() => {
    if (!focarDepois.current) return;
    const id = focarDepois.current;
    focarDepois.current = null;
    setFocado(id);
  }, [blocks]);

  /**
   * Põe o cursor no campo assim que ele aparece.
   *
   * Um bloco fora de foco é texto exibido, e o campo só existe depois que o
   * React monta a troca. Tentar focar antes disso — no mesmo quadro do clique —
   * não funcionava: o elemento ainda não existia, e o que era digitado se
   * perdia no documento.
   */
  useLayoutEffect(() => {
    if (!focado) return;
    const el = refs.current.get(focado);
    if (!el) return;
    el.focus();
    const pos = cursorAlvo.current ?? el.value.length;
    cursorAlvo.current = null;
    el.setSelectionRange(pos, pos);
  }, [focado]);

  /**
   * Entra em edição no ponto clicado.
   *
   * Um bloco fora de foco é texto exibido — é o que permite ver link,
   * negrito e código de verdade. Ao clicar, ele vira campo; sem esta conta o
   * cursor cairia sempre no fim, e corrigir uma palavra no meio viraria uma
   * caçada.
   */
  function editarNoPonto(bloco: Block, e: React.MouseEvent<HTMLDivElement>) {
    const alvo = e.target as HTMLElement;
    if (alvo.closest("a")) return; // clicar num link abre o link

    let posicao = bloco.text.length;
    const range = document.caretRangeFromPoint?.(e.clientX, e.clientY);
    if (range) {
      const medida = range.cloneRange();
      medida.selectNodeContents(e.currentTarget);
      medida.setEnd(range.startContainer, range.startOffset);
      posicao = Math.min(medida.toString().length, bloco.text.length);
    }

    cursorAlvo.current = posicao;
    setFocado(bloco.id);
  }

  function alterarTexto(id: string, text: string) {
    const bloco = blocks.find((b) => b.id === id);
    if (!bloco) return;

    // Atalho de Markdown: troca o tipo e some com o prefixo. Vale em qualquer
    // bloco de texto — antes só valia em parágrafo e listas, e digitar ">"
    // logo depois de uma caixa de tarefa não virava citação.
    if (bloco.type !== "code") {
      for (const { pattern, type } of SHORTCUTS) {
        if (pattern.test(text)) {
          const semPrefixo = text.replace(pattern, "");
          atualizar(
            blocks.map((b) =>
              b.id === id
                ? { ...b, type, text: type === "divider" ? "" : semPrefixo }
                : b,
            ),
          );
          return;
        }
      }
    }

    atualizar(blocks.map((b) => (b.id === id ? { ...b, text } : b)));
  }

  function aoTeclar(e: React.KeyboardEvent<HTMLTextAreaElement>, index: number) {
    const bloco = blocks[index];
    const el = e.currentTarget;

    if (e.key === "Enter" && !e.shiftKey && bloco.type !== "code") {
      e.preventDefault();
      // listas continuam no mesmo tipo; o resto volta a parágrafo
      const herda = ["bullet", "number", "todo"].includes(bloco.type);
      const novo = newBlock(herda ? bloco.type : "p");
      // o foco muda no mesmo passo da criação: adiar isso deixava o campo
      // anterior recebendo as teclas seguintes, e a letra da próxima linha
      // grudava no fim da anterior
      cursorAlvo.current = 0;
      setFocado(novo.id);
      atualizar([...blocks.slice(0, index + 1), novo, ...blocks.slice(index + 1)]);
      return;
    }

    if (e.key === "Backspace" && el.selectionStart === 0 && el.selectionEnd === 0) {
      if (bloco.type !== "p" && bloco.text) {
        e.preventDefault();
        atualizar(blocks.map((b) => (b.id === bloco.id ? { ...b, type: "p" } : b)));
        return;
      }
      if (index > 0) {
        e.preventDefault();
        const anterior = blocks[index - 1];
        cursorAlvo.current = anterior.text.length;
        setFocado(anterior.id);
        atualizar([
          ...blocks.slice(0, index - 1),
          { ...anterior, text: anterior.text + bloco.text },
          ...blocks.slice(index + 1),
        ]);
      }
      return;
    }

    if (e.key === "ArrowUp" && el.selectionStart === 0 && index > 0) {
      e.preventDefault();
      refs.current.get(blocks[index - 1].id)?.focus();
    }
    if (e.key === "ArrowDown" && el.selectionStart === el.value.length && index < blocks.length - 1) {
      e.preventDefault();
      refs.current.get(blocks[index + 1].id)?.focus();
    }
  }

  /** Colar imagem vira bloco de imagem; texto com quebras vira vários blocos. */
  async function aoColar(e: React.ClipboardEvent<HTMLTextAreaElement>, index: number) {
    const arquivos = Array.from(e.clipboardData.files).filter((f) =>
      f.type.startsWith("image/"),
    );

    if (arquivos.length > 0) {
      e.preventDefault();
      setEnviando(true);
      const novos: Block[] = [];

      for (const arquivo of arquivos) {
        try {
          const body = new FormData();
          body.append("noteId", noteId);
          body.append("file", arquivo);
          const r = await fetch(withBase("/api/attachments"), { method: "POST", body });
          if (!r.ok) {
            const { error } = await r.json().catch(() => ({ error: "Falha no envio" }));
            toast.error(error);
            continue;
          }
          const { id } = (await r.json()) as { id: string };
          novos.push({ ...newBlock("image"), attachmentId: id });
        } catch {
          toast.error("Não consegui enviar a imagem");
        }
      }

      setEnviando(false);
      if (novos.length) {
        const seguinte = newBlock();
        focarDepois.current = seguinte.id;
        atualizar([
          ...blocks.slice(0, index + 1),
          ...novos,
          seguinte,
          ...blocks.slice(index + 1),
        ]);
      }
      return;
    }

    const texto = e.clipboardData.getData("text/plain");
    if (texto.includes("\n")) {
      e.preventDefault();
      const linhas = texto.split(/\r?\n/);
      const novos = linhas.map((linha) => {
        for (const { pattern, type } of SHORTCUTS) {
          if (pattern.test(linha)) return newBlock(type, linha.replace(pattern, ""));
        }
        return newBlock("p", linha);
      });
      atualizar([...blocks.slice(0, index), ...novos, ...blocks.slice(index + 1)]);
    }
  }

  function remover(id: string) {
    if (blocks.length === 1) {
      atualizar([newBlock()]);
      return;
    }
    atualizar(blocks.filter((b) => b.id !== id));
  }

  return (
    <div className="space-y-0.5">
      {enviando && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          enviando imagem…
        </p>
      )}

      {blocks.map((bloco, index) => (
        <div key={bloco.id} className="group relative flex items-start gap-1">
          <div className="flex w-6 shrink-0 justify-end pt-1.5 opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100">
            <button
              type="button"
              onClick={() => remover(bloco.id)}
              aria-label="Remover bloco"
              className="text-muted-foreground hover:text-destructive"
            >
              {bloco.type === "image" || bloco.type === "divider" ? (
                <Trash2 className="size-3.5" />
              ) : (
                <GripVertical className="size-3.5" />
              )}
            </button>
          </div>

          {bloco.type === "todo" && (
            <button
              type="button"
              className="mt-1.5 shrink-0"
              aria-label={bloco.checked ? "Desmarcar" : "Marcar"}
              onClick={() =>
                atualizar(
                  blocks.map((b) => (b.id === bloco.id ? { ...b, checked: !b.checked } : b)),
                )
              }
            >
              {bloco.checked ? (
                <CheckSquare className="size-4 text-primary-strong" />
              ) : (
                <Square className="size-4 text-muted-foreground" />
              )}
            </button>
          )}

          {bloco.type === "bullet" && (
            <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-foreground/60" />
          )}
          {bloco.type === "number" && (
            <span className="mt-1 w-4 shrink-0 text-right text-sm text-muted-foreground">
              {ordinal(blocks, index)}.
            </span>
          )}

          {bloco.type === "divider" ? (
            <div className="flex-1 py-3">
              <hr />
            </div>
          ) : bloco.type === "image" ? (
            <figure className="flex-1 py-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={withBase(`/api/attachments/${bloco.attachmentId}`)}
                alt={bloco.caption ?? ""}
                className="max-h-[60vh] w-auto max-w-full rounded-lg border"
              />
              <input
                value={bloco.caption ?? ""}
                onChange={(e) =>
                  atualizar(
                    blocks.map((b) =>
                      b.id === bloco.id ? { ...b, caption: e.target.value } : b,
                    ),
                  )
                }
                placeholder="Legenda (opcional)"
                className="mt-1 w-full bg-transparent text-xs text-muted-foreground outline-none"
              />
            </figure>
          ) : focado !== bloco.id ? (
            <div
              role="textbox"
              tabIndex={0}
              onClick={(e) => editarNoPonto(bloco, e)}
              onFocus={() => setFocado(bloco.id)}
              className={cn(
                "flex-1 cursor-text leading-relaxed whitespace-pre-wrap outline-none",
                bloco.type === "h1" && "pt-3 text-2xl font-semibold tracking-tight",
                bloco.type === "h2" && "pt-2 text-xl font-semibold tracking-tight",
                bloco.type === "h3" && "pt-1 text-base font-semibold",
                bloco.type === "quote" &&
                  "border-l-2 border-primary/50 pl-3 text-foreground/90 italic",
                bloco.type === "code" && "rounded-lg bg-muted px-3 py-2 font-mono text-xs",
                bloco.type === "todo" && bloco.checked && "text-muted-foreground line-through",
                !bloco.text && "text-muted-foreground/60",
              )}
            >
              {bloco.text ? (
                bloco.type === "code" ? (
                  bloco.text
                ) : (
                  <RichText text={bloco.text} />
                )
              ) : (
                (PLACEHOLDER[bloco.type] ?? "")
              )}
            </div>
          ) : (
            <textarea
              ref={(el) => {
                if (el) refs.current.set(bloco.id, el);
                else refs.current.delete(bloco.id);
              }}
              value={bloco.text}
              onChange={(e) => alterarTexto(bloco.id, e.target.value)}
              onKeyDown={(e) => aoTeclar(e, index)}
              onPaste={(e) => void aoColar(e, index)}
              onBlur={() => setFocado((atual) => (atual === bloco.id ? null : atual))}
              placeholder={PLACEHOLDER[bloco.type]}
              rows={1}
              className={cn(
                "flex-1 resize-none bg-transparent leading-relaxed outline-none placeholder:text-muted-foreground/60",
                "field-sizing-content",
                bloco.type === "h1" && "pt-3 text-2xl font-semibold tracking-tight",
                bloco.type === "h2" && "pt-2 text-xl font-semibold tracking-tight",
                bloco.type === "h3" && "pt-1 text-base font-semibold",
                bloco.type === "quote" &&
                  "border-l-2 border-primary/50 pl-3 text-foreground/90 italic",
                bloco.type === "code" &&
                  "rounded-lg bg-muted px-3 py-2 font-mono text-xs",
                bloco.type === "todo" && bloco.checked && "text-muted-foreground line-through",
              )}
            />
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={() => {
          const novo = newBlock();
          focarDepois.current = novo.id;
          atualizar([...blocks, novo]);
        }}
        className="ml-7 flex items-center gap-1.5 py-2 text-xs text-muted-foreground transition hover:text-foreground"
      >
        <Plus className="size-3.5" />
        Adicionar bloco
      </button>
    </div>
  );
}

/** Ajuda com os atalhos — some do caminho depois de lida. */
export function NoteHints({ onClose }: { onClose: () => void }) {
  return (
    <div className="relative rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar dica"
        className="absolute right-2 top-2 hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
      <p className="pr-6">
        Digite <code>#</code> para título, <code>-</code> para lista, <code>[]</code> para
        caixa, <code>&gt;</code> para citação, <code>```</code> para código e{" "}
        <code>---</code> para uma linha. Cole um print direto no texto.{" "}
        <RichText text="Dentro da linha valem **negrito**, *itálico*, `código` e [links](https://exemplo.com)." />
      </p>
    </div>
  );
}

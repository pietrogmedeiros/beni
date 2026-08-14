"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { ImagePlus, Loader2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  FEEDBACK_KINDS,
  MAX_FEEDBACK_IMAGES,
  MAX_FEEDBACK_LENGTH,
  type FeedbackKindValue,
} from "@/lib/feedback";
import { enviarFeedback } from "@/server/actions/feedback";
import { cn } from "@/lib/utils";

type Print = { id: string; preview: string; name: string };

/**
 * Formulário de feedback.
 *
 * Duas decisões que valem mais que o resto: a pessoa não descreve onde estava
 * (a página, o build e o navegador vão sozinhos) e o print entra colando
 * Cmd+V. Cada campo a menos aqui é um relato a mais chegando.
 */
export function FeedbackDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [kind, setKind] = useState<FeedbackKindValue>("PROBLEMA");
  const [texto, setTexto] = useState("");
  const [prints, setPrints] = useState<Print[]>([]);
  const [subindo, setSubindo] = useState(false);
  const [enviando, startEnvio] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (open) return;
    // sincronização com fonte externa (o diálogo fechou) — intencional
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTexto("");
    setPrints([]);
    setKind("PROBLEMA");
  }, [open]);

  async function subirArquivo(file: File) {
    if (prints.length >= MAX_FEEDBACK_IMAGES) {
      toast.error(`No máximo ${MAX_FEEDBACK_IMAGES} imagens.`);
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Só imagem por aqui.");
      return;
    }

    setSubindo(true);
    try {
      const menor = await reduzir(file);
      const form = new FormData();
      form.append("file", menor);
      form.append("solto", "1");

      const resposta = await fetch("/api/attachments", { method: "POST", body: form });
      if (!resposta.ok) {
        const { error } = await resposta.json().catch(() => ({ error: null }));
        throw new Error(error ?? "Não deu para anexar a imagem.");
      }
      const { id } = (await resposta.json()) as { id: string };
      setPrints((p) => [
        ...p,
        { id, preview: URL.createObjectURL(menor), name: menor.name },
      ]);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSubindo(false);
    }
  }

  function enviar() {
    if (texto.trim().length < 3) {
      toast.error("Escreva pelo menos uma frase.");
      return;
    }
    startEnvio(async () => {
      const r = await enviarFeedback({
        kind,
        message: texto.trim(),
        anexos: prints.map((p) => p.id),
        // caminho, não URL inteira: não faz sentido guardar o domínio, e
        // parâmetro de busca pode carregar coisa que a pessoa não quis mandar
        pageUrl: pathname,
        userAgent: navigator.userAgent.slice(0, 300),
      });
      if (!r.ok) {
        toast.error(r.erro);
        return;
      }
      onOpenChange(false);
      toast.success("Recebido. Te aviso quando isso andar.");
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Como está sendo usar o Beni?</DialogTitle>
          <DialogDescription>
            Vai direto para quem faz o produto. Não precisa dizer em que tela você
            estava — isso vai junto.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          {FEEDBACK_KINDS.map((k) => (
            <button
              key={k.value}
              type="button"
              onClick={() => setKind(k.value)}
              aria-pressed={kind === k.value}
              className={cn(
                "flex flex-col items-start gap-0.5 rounded-lg border p-2.5 text-left transition",
                "hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                kind === k.value
                  ? "border-primary/60 bg-primary/5"
                  : "border-input/60",
              )}
            >
              <span className="text-sm font-medium text-foreground">
                <span aria-hidden className="mr-1.5">
                  {k.emoji}
                </span>
                {k.label}
              </span>
              <span className="text-[11px] leading-tight text-muted-foreground">
                {k.hint}
              </span>
            </button>
          ))}
        </div>

        <Textarea
          autoFocus
          value={texto}
          maxLength={MAX_FEEDBACK_LENGTH}
          onChange={(e) => setTexto(e.target.value)}
          onPaste={(e) => {
            const arquivo = [...e.clipboardData.items]
              .find((i) => i.type.startsWith("image/"))
              ?.getAsFile();
            if (arquivo) {
              e.preventDefault();
              void subirArquivo(arquivo);
            }
          }}
          placeholder={
            kind === "PROBLEMA"
              ? "O que você tentou fazer e o que aconteceu?"
              : kind === "IDEIA"
                ? "O que faltou? Se puder, conte o que você estava tentando resolver."
                : kind === "ELOGIO"
                  ? "O que funcionou bem?"
                  : "O que você procurou e não achou?"
          }
          className="min-h-32 resize-y"
        />

        {prints.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {prints.map((p) => (
              <div key={p.id} className="group relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.preview}
                  alt={p.name}
                  className="size-16 rounded-md border object-cover"
                />
                <button
                  type="button"
                  aria-label="Remover imagem"
                  onClick={() => setPrints((atual) => atual.filter((i) => i.id !== p.id))}
                  className="absolute -top-1.5 -right-1.5 rounded-full bg-foreground p-0.5 text-background opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={subindo || prints.length >= MAX_FEEDBACK_IMAGES}
            className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 transition hover:text-foreground disabled:opacity-50"
          >
            {subindo ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <ImagePlus className="size-3.5" />
            )}
            Colar ou escolher um print
          </button>
          <span>
            {texto.length}/{MAX_FEEDBACK_LENGTH}
          </span>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void subirArquivo(f);
            e.target.value = "";
          }}
        />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Agora não
          </Button>
          <Button onClick={enviar} disabled={enviando || subindo}>
            {enviando && <Loader2 className="size-4 animate-spin" />}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Encolhe a imagem antes de subir.
 *
 * Print de tela cheia em retina passa de 2 MB, e anexo mora dentro do
 * Postgres — cada print desses entra também em todo backup. 1600px de largura
 * ainda deixa ler qualquer texto de interface.
 */
async function reduzir(file: File): Promise<File> {
  const LARGURA = 1600;
  try {
    const bitmap = await createImageBitmap(file);
    if (bitmap.width <= LARGURA && file.size < 400_000) return file;

    const escala = Math.min(1, LARGURA / bitmap.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.9),
    );
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], `print-${Date.now()}.webp`, { type: "image/webp" });
  } catch {
    // navegador sem createImageBitmap ou imagem que não decodifica: sobe como veio
    return file;
  }
}

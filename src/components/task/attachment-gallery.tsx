"use client";

import { useState } from "react";
import { Download, FileText, Music, Play, X } from "lucide-react";
import type { AttachmentDTO } from "@/server/actions/attachments";
import { cn, formatBytes } from "@/lib/utils";
import { withBase } from "@/lib/base-path";

/**
 * Galeria de anexos em modo leitura.
 *
 * A mesma peça serve o time e quem chega pelo link público — o aprovador vê
 * exatamente o que o time vê, sem conta e sem baixar nada: imagem abre em tela
 * cheia, vídeo toca ali mesmo.
 */
export function AttachmentGallery({
  attachments,
  onDelete,
  className,
}: {
  attachments: AttachmentDTO[];
  onDelete?: (id: string) => void;
  className?: string;
}) {
  const [lightbox, setLightbox] = useState<AttachmentDTO | null>(null);

  if (attachments.length === 0) return null;

  const visuals = attachments.filter(
    (a) => a.kind === "image" || a.kind === "video",
  );
  const others = attachments.filter(
    (a) => a.kind !== "image" && a.kind !== "video",
  );

  return (
    <div className={cn("space-y-3", className)}>
      {visuals.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {visuals.map((a) => (
            <figure
              key={a.id}
              className="group relative overflow-hidden rounded-lg border bg-muted/40"
            >
              {a.kind === "image" ? (
                <button
                  type="button"
                  onClick={() => setLightbox(a)}
                  className="block w-full"
                  aria-label={`Ampliar ${a.name}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={withBase(a.url)}
                    alt={a.name}
                    loading="lazy"
                    className="aspect-video w-full object-cover transition group-hover:scale-[1.02]"
                  />
                </button>
              ) : (
                <video
                  src={withBase(a.url)}
                  controls
                  preload="metadata"
                  className="aspect-video w-full bg-black object-contain"
                />
              )}

              <figcaption className="flex items-center gap-1.5 px-2 py-1.5 text-[11px] text-muted-foreground">
                {a.kind === "video" && <Play className="size-3 shrink-0" />}
                <span className="min-w-0 flex-1 truncate" title={a.name}>
                  {a.name}
                </span>
                <span className="shrink-0">{formatBytes(a.size)}</span>
              </figcaption>

              {onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(a.id)}
                  className="absolute right-1.5 top-1.5 rounded-md bg-background/90 p-1 opacity-0 shadow-sm transition group-hover:opacity-100 hover:text-destructive"
                  aria-label={`Remover ${a.name}`}
                >
                  <X className="size-3.5" />
                </button>
              )}
            </figure>
          ))}
        </div>
      )}

      {others.length > 0 && (
        <ul className="space-y-1.5">
          {others.map((a) => (
            <li
              key={a.id}
              className="group flex items-center gap-2 rounded-lg border px-2.5 py-2 text-sm"
            >
              {a.kind === "audio" ? (
                <Music className="size-4 shrink-0 text-muted-foreground" />
              ) : (
                <FileText className="size-4 shrink-0 text-muted-foreground" />
              )}
              <a
                href={withBase(a.url)}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 truncate hover:underline"
              >
                {a.name}
              </a>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatBytes(a.size)}
              </span>
              <a
                href={withBase(a.url)}
                download={a.name}
                className="shrink-0 text-muted-foreground hover:text-foreground"
                aria-label={`Baixar ${a.name}`}
              >
                <Download className="size-4" />
              </a>
              {onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(a.id)}
                  className="shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-destructive"
                  aria-label={`Remover ${a.name}`}
                >
                  <X className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-100 flex items-center justify-center bg-black/85 p-6"
          onClick={() => setLightbox(null)}
          role="presentation"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={withBase(lightbox.url)}
            alt={lightbox.name}
            className="max-h-full max-w-full rounded-lg object-contain"
          />
          <button
            type="button"
            className="absolute right-4 top-4 rounded-lg bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="Fechar"
          >
            <X className="size-5" />
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Paperclip, Upload } from "lucide-react";
import {
  deleteAttachment,
  listAttachments,
  type AttachmentDTO,
} from "@/server/actions/attachments";
import { AttachmentGallery } from "@/components/task/attachment-gallery";
import { Button } from "@/components/ui/button";
import { withBase } from "@/lib/base-path";
import { cn } from "@/lib/utils";

/**
 * Anexos da tarefa: enviar, ver e remover.
 *
 * O envio vai por uma rota própria em vez de Server Action porque estas têm
 * teto de 1 MB de corpo — um vídeo de tela estoura isso antes do primeiro
 * segundo.
 */
export function AttachmentsPanel({
  taskId,
  onCountChange,
}: {
  taskId: string;
  onCountChange?: (n: number) => void;
}) {
  const [items, setItems] = useState<AttachmentDTO[] | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    listAttachments(taskId).then((rows) => {
      if (!alive) return;
      setItems(rows);
      onCountChange?.(rows.length);
    });
    return () => {
      alive = false;
    };
    // onCountChange muda de identidade a cada render do pai; seguir só a tarefa
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  async function upload(files: FileList | File[]) {
    for (const file of Array.from(files)) {
      setUploading(file.name);
      try {
        const body = new FormData();
        body.append("taskId", taskId);
        body.append("file", file);

        const response = await fetch(withBase("/api/attachments"), {
          method: "POST",
          body,
        });

        if (!response.ok) {
          const { error } = await response
            .json()
            .catch(() => ({ error: "Falha no envio" }));
          toast.error(`${file.name}: ${error}`);
          continue;
        }
        toast.success(`${file.name} anexado`);
      } catch {
        toast.error(`Não consegui enviar ${file.name}`);
      } finally {
        setUploading(null);
      }
    }

    const rows = await listAttachments(taskId);
    setItems(rows);
    onCountChange?.(rows.length);
  }

  async function remove(id: string) {
    const previous = items ?? [];
    setItems(previous.filter((a) => a.id !== id));
    onCountChange?.(Math.max(previous.length - 1, 0));
    try {
      await deleteAttachment(id);
      toast.success("Anexo removido");
    } catch {
      setItems(previous);
      onCountChange?.(previous.length);
      toast.error("Não consegui remover o anexo");
    }
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files.length) void upload(e.dataTransfer.files);
        }}
        className={cn(
          "rounded-lg border border-dashed px-4 py-6 text-center transition",
          dragging ? "border-primary bg-primary/5" : "border-border",
        )}
      >
        <Paperclip className="mx-auto size-5 text-muted-foreground" />
        <p className="mt-2 text-sm">
          Arraste imagens, vídeos ou documentos aqui
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Quem receber o link de aprovação vê tudo isto sem precisar de conta.
        </p>

        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void upload(e.target.files);
            e.target.value = "";
          }}
        />

        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          disabled={!!uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Upload className="size-4" />
          )}
          {uploading ? `Enviando ${uploading}…` : "Escolher arquivos"}
        </Button>
      </div>

      {items === null ? (
        <div className="flex justify-center py-6">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <p className="py-2 text-center text-sm text-muted-foreground">
          Nenhum anexo ainda.
        </p>
      ) : (
        <AttachmentGallery attachments={items} onDelete={remove} />
      )}
    </div>
  );
}

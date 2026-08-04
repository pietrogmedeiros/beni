"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Copy, Link2, Loader2, MessageSquare, Share2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  findProjectShare,
  getOrCreateProjectShare,
  revokeProjectShare,
  setShareComments,
} from "@/server/actions/share";
import { formatDate } from "@/lib/utils";

type Share = {
  id: string;
  token: string;
  allowComments: boolean;
  expiresAt: string | null;
  url: string;
};

/** Gera e administra o link público do cronograma. */
export function ShareGanttButton({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [share, setShare] = useState<Share | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [pending, startTransition] = useTransition();

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next && !loaded) {
      startTransition(async () => {
        setShare(await findProjectShare(projectId));
        setLoaded(true);
      });
    }
  }

  function copy(url: string) {
    navigator.clipboard.writeText(url);
    toast.success("Link copiado");
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-sm font-medium transition hover:bg-muted">
        <Share2 className="size-3.5" />
        Compartilhar
      </PopoverTrigger>

      <PopoverContent className="w-96" align="end">
        <p className="text-sm font-semibold">Compartilhar cronograma</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Qualquer pessoa com o link vê o Gantt em modo leitura. Para comentar,
          ela informa nome e e-mail — não precisa de conta.
        </p>

        {!loaded ? (
          <div className="flex justify-center py-6">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : share ? (
          <div className="mt-3 space-y-3">
            <div className="flex gap-2">
              <Input
                readOnly
                value={share.url}
                className="h-8 font-mono text-[11px]"
                onFocus={(e) => e.currentTarget.select()}
              />
              <Button
                size="sm"
                variant="outline"
                className="h-8 shrink-0"
                onClick={() => copy(share.url)}
              >
                <Copy className="size-3.5" />
                Copiar
              </Button>
            </div>

            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <Label
                htmlFor="allow-comments"
                className="flex cursor-pointer items-center gap-2 text-sm font-normal"
              >
                <MessageSquare className="size-4 text-muted-foreground" />
                Permitir comentários
              </Label>
              <Switch
                id="allow-comments"
                checked={share.allowComments}
                onCheckedChange={(checked) => {
                  setShare({ ...share, allowComments: checked });
                  startTransition(async () => {
                    await setShareComments(share.id, checked);
                  });
                }}
              />
            </div>

            {share.expiresAt && (
              <p className="text-[11px] text-muted-foreground">
                O link expira em {formatDate(share.expiresAt)}.
              </p>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="w-full text-destructive hover:text-destructive"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await revokeProjectShare(share.id);
                  setShare(null);
                  toast.success("Link revogado");
                })
              }
            >
              <Trash2 className="size-3.5" />
              Revogar link
            </Button>
          </div>
        ) : (
          <Button
            className="mt-3 w-full"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const created = await getOrCreateProjectShare(projectId);
                setShare(created);
                copy(created.url);
              })
            }
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Link2 className="size-4" />
            )}
            Gerar link público
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

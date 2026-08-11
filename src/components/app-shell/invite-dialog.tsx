"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { withBase } from "@/lib/base-path";
import { Copy, Mail, UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inviteLink } from "@/server/actions/notifications";

/**
 * Convite por link: quem recebe cria a própria conta em /register.
 * Não há envio de e-mail no servidor, então o fluxo honesto é entregar o
 * link para a pessoa compartilhar como preferir.
 */
export function InviteDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [url, setUrl] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");

  useEffect(() => {
    if (!open) return;
    inviteLink().then(({ workspaceName: name, path }) => {
      setWorkspaceName(name);
      setUrl(`${window.location.origin}${withBase(path)}`);
    });
  }, [open]);

  function copy() {
    navigator.clipboard.writeText(url);
    toast.success("Link de convite copiado");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-4" />
            Convidar para o Beni
          </DialogTitle>
          <DialogDescription>
            Envie o link abaixo. Quem receber cria a conta e já entra
            {workspaceName ? ` trabalhando ao seu lado.` : "."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="invite-url">Link de cadastro</Label>
          <div className="flex gap-2">
            <Input
              id="invite-url"
              readOnly
              value={url}
              className="font-mono text-xs"
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button variant="outline" className="shrink-0" onClick={copy}>
              <Copy className="size-4" />
              Copiar
            </Button>
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            variant="ghost"
            render={
              <a
                href={`mailto:?subject=${encodeURIComponent(
                  "Convite para o Beni",
                )}&body=${encodeURIComponent(
                  `Crie sua conta no Beni para acompanharmos os projetos juntos: ${url}`,
                )}`}
              />
            }
            nativeButton={false}
          >
            <Mail className="size-4" />
            Enviar por e-mail
          </Button>
          <Button onClick={() => onOpenChange(false)}>Pronto</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

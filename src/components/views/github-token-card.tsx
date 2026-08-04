"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, KeyRound, Loader2, Trash2 } from "lucide-react";
import { GithubIcon } from "@/components/github-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setGithubToken } from "@/server/actions/github";

/**
 * Token do GitHub do workspace. Só é necessário para repositórios privados
 * (e para elevar o limite de requisições). Guardado cifrado no banco e nunca
 * devolvido ao navegador — a tela mostra apenas os últimos 4 caracteres.
 */
export function GithubTokenCard({ preview }: { preview: string | null }) {
  const [saved, setSaved] = useState(preview);
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <GithubIcon className="size-4" />
        GitHub
      </h2>
      <p className="mb-4 text-xs text-muted-foreground">
        Repositórios públicos funcionam sem token. Para repositórios privados,
        gere um <em>personal access token</em> com escopo <code>repo</code> em{" "}
        <a
          href="https://github.com/settings/tokens"
          target="_blank"
          rel="noreferrer noopener"
          className="text-primary-strong hover:underline"
        >
          github.com/settings/tokens
        </a>
        .
      </p>

      {saved ? (
        <div className="flex items-center gap-3 rounded-lg border border-success/40 bg-success/8 px-3 py-2.5">
          <Check className="size-4 shrink-0 text-success" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Token configurado</p>
            <p className="font-mono text-xs text-muted-foreground">{saved}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await setGithubToken(null);
                setSaved(null);
                toast.success("Token removido");
              })
            }
          >
            <Trash2 className="size-3.5" />
            Remover
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="gh-token">Personal access token</Label>
          <div className="flex gap-2">
            <Input
              id="gh-token"
              type="password"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="ghp_…"
              className="flex-1 font-mono"
              autoComplete="off"
            />
            <Button
              variant="outline"
              disabled={pending || !value.trim()}
              onClick={() =>
                startTransition(async () => {
                  const masked = await setGithubToken(value);
                  setSaved(masked);
                  setValue("");
                  toast.success("Token salvo com segurança");
                })
              }
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <KeyRound className="size-4" />
              )}
              Salvar
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Guardado cifrado (AES-256-GCM) e nunca exibido de volta.
          </p>
        </div>
      )}
    </section>
  );
}

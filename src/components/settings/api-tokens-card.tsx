"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Copy, KeyRound, Loader2, Plus, Trash2 } from "lucide-react";
import {
  createApiToken,
  listApiTokens,
  revokeApiToken,
  type ApiTokenDTO,
} from "@/server/actions/api-tokens";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RelativeTime } from "@/components/relative-time";

/**
 * Chaves de acesso à API — é assim que o MCP (e qualquer integração) fala com
 * o Beni sem usar a senha de ninguém.
 */
export function ApiTokensCard() {
  const [tokens, setTokens] = useState<ApiTokenDTO[] | null>(null);
  const [name, setName] = useState("");
  const [novo, setNovo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let alive = true;
    listApiTokens().then((t) => alive && setTokens(t));
    return () => {
      alive = false;
    };
  }, []);

  function criar() {
    startTransition(async () => {
      const { token } = await createApiToken(name || "Claude (MCP)");
      setNovo(token);
      setName("");
      setTokens(await listApiTokens());
      toast.success("Chave criada — copie agora, ela não aparece de novo");
    });
  }

  function revogar(id: string) {
    startTransition(async () => {
      await revokeApiToken(id);
      setTokens(await listApiTokens());
      toast.success("Chave revogada");
    });
  }

  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <KeyRound className="size-4" />
        Chaves de acesso
      </h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Para integrações lerem e criarem tarefas em seu nome — o Claude usa uma
        destas. Revogar aqui corta o acesso na hora, sem trocar sua senha.
      </p>

      {novo && (
        <div className="mb-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
          <p className="mb-1.5 text-xs font-medium">
            Copie agora: esta chave não será mostrada de novo.
          </p>
          <div className="flex gap-2">
            <Input readOnly value={novo} className="font-mono text-xs" />
            <Button
              variant="outline"
              className="shrink-0"
              onClick={() => {
                navigator.clipboard.writeText(novo);
                toast.success("Chave copiada");
              }}
            >
              <Copy className="size-4" />
              Copiar
            </Button>
          </div>
        </div>
      )}

      <div className="mb-3 flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome da chave (ex.: Claude no meu Mac)"
          onKeyDown={(e) => e.key === "Enter" && criar()}
        />
        <Button className="shrink-0" disabled={pending} onClick={criar}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Criar chave
        </Button>
      </div>

      {tokens === null ? (
        <Loader2 className="mx-auto my-3 size-4 animate-spin text-muted-foreground" />
      ) : tokens.length === 0 ? (
        <p className="py-2 text-center text-xs text-muted-foreground">
          Nenhuma chave ativa.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {tokens.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{t.name}</p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-mono">beni_…{t.hint}</span> ·{" "}
                  {t.lastUsedAt ? (
                    <>
                      usada <RelativeTime date={t.lastUsedAt} />
                    </>
                  ) : (
                    "nunca usada"
                  )}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Revogar ${t.name}`}
                onClick={() => revogar(t.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { withBase } from "@/lib/base-path";

/**
 * Formulário de entrada.
 *
 * Envio **nativo** para `/api/session/login`, e não Server Action: o
 * gerenciador de senhas só oferece guardar quando vê um formulário com campo
 * de senha ser enviado e a página navegar em seguida. Com o envio
 * interceptado por fetch isso nunca acontecia, e todo mundo digitava a senha
 * de novo a cada visita.
 *
 * O preço é o erro voltar pela URL em vez de virar estado. Vale: entrar é a
 * tela mais repetida do app.
 */
export function LoginForm({
  next,
  demo,
  erro,
  email,
}: {
  next: string;
  demo: boolean;
  erro?: boolean;
  email?: string;
}) {
  const [enviando, setEnviando] = useState(false);

  return (
    <form
      method="post"
      action={withBase("/api/session/login")}
      onSubmit={() => setEnviando(true)}
      className="mt-8 space-y-4"
    >
      <input type="hidden" name="next" value={next} />

      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          placeholder="voce@empresa.com"
          defaultValue={email ?? (demo ? "admin@beni.app" : undefined)}
          required
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Senha</Label>
          <Link
            href="/esqueci"
            className="text-xs text-muted-foreground transition hover:text-foreground"
          >
            Esqueci a senha
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          defaultValue={demo ? "beni1234" : undefined}
          required
        />
      </div>

      {erro && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          E-mail ou senha incorretos
        </div>
      )}

      <Button type="submit" className="w-full" disabled={enviando}>
        {enviando && <Loader2 className="size-4 animate-spin" />}
        Entrar
      </Button>

      {demo && (
        <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          Demo: <strong>admin@beni.app</strong> / <strong>beni1234</strong>
        </p>
      )}
    </form>
  );
}

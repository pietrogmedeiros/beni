"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Loader2 } from "lucide-react";
import { loginAction, type AuthState } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      Entrar
    </Button>
  );
}

export function LoginForm({ next, demo }: { next: string; demo: boolean }) {
  const [state, formAction] = useActionState<AuthState, FormData>(
    loginAction,
    undefined,
  );

  return (
    <form action={formAction} className="mt-8 space-y-4">
      <input type="hidden" name="next" value={next} />

      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="voce@empresa.com"
          defaultValue={demo ? "admin@beni.app" : undefined}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Senha</Label>
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

      {state?.error && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {state.error}
        </div>
      )}

      <SubmitButton />

      {demo && (
        <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          Demo: <strong>admin@beni.app</strong> / <strong>beni1234</strong>
        </p>
      )}
    </form>
  );
}

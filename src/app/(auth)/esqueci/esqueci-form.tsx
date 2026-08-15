"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, MailQuestion } from "lucide-react";
import { pedirRecuperacao } from "@/server/actions/account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function EsqueciForm() {
  const [email, setEmail] = useState("");
  const [resposta, setResposta] = useState<{ ok: boolean; mensagem: string } | null>(
    null,
  );
  const [enviando, startEnvio] = useTransition();

  // A resposta é a mesma exista a conta ou não, então a tela também precisa
  // ser: dizer "não achei esse e-mail" aqui entregaria quem tem conta.
  if (resposta?.ok) {
    return (
      <div className="mt-8 flex flex-col items-center gap-3 rounded-xl border bg-card p-6 text-center">
        <CheckCircle2 className="size-6 text-success" />
        <p className="text-sm text-foreground">{resposta.mensagem}</p>
        <p className="text-xs text-muted-foreground">
          Confira também o spam. O link vale por uma hora.
        </p>
      </div>
    );
  }

  return (
    <form
      className="mt-8 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        startEnvio(async () => setResposta(await pedirRecuperacao(email)));
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="email">E-mail da conta</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@empresa.com"
          required
        />
      </div>

      {resposta && !resposta.ok && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <MailQuestion className="size-4 shrink-0" />
          {resposta.mensagem}
        </div>
      )}

      <Button type="submit" className="w-full" disabled={enviando}>
        {enviando && <Loader2 className="size-4 animate-spin" />}
        Enviar o link
      </Button>
    </form>
  );
}

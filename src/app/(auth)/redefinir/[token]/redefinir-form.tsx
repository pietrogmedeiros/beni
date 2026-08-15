"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { redefinirSenha } from "@/server/actions/account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RedefinirForm({ token }: { token: string }) {
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [repetida, setRepetida] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);
  const [salvando, startSalvar] = useTransition();

  if (pronto) {
    return (
      <div className="mt-8 flex flex-col items-center gap-3 rounded-xl border bg-card p-6 text-center">
        <CheckCircle2 className="size-6 text-success" />
        <p className="text-sm text-foreground">Senha trocada.</p>
        <p className="text-xs text-muted-foreground">
          As sessões que estavam abertas foram encerradas — entre de novo com a
          senha nova.
        </p>
        <Button className="mt-1" onClick={() => router.push("/login")}>
          Ir para a entrada
        </Button>
      </div>
    );
  }

  return (
    <form
      className="mt-8 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        // conferência das duas digitações é aqui mesmo: o servidor não tem o
        // que fazer com uma senha repetida errada além de recusar
        if (senha !== repetida) {
          setErro("As duas senhas não são iguais.");
          return;
        }
        startSalvar(async () => {
          const r = await redefinirSenha(token, senha);
          if (!r.ok) {
            setErro(r.erro);
            return;
          }
          setErro(null);
          setPronto(true);
        });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="senha">Nova senha</Label>
        <Input
          id="senha"
          type="password"
          autoComplete="new-password"
          autoFocus
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          placeholder="Pelo menos 8 caracteres"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="repetida">Repita a senha</Label>
        <Input
          id="repetida"
          type="password"
          autoComplete="new-password"
          value={repetida}
          onChange={(e) => setRepetida(e.target.value)}
          placeholder="••••••••"
          required
        />
      </div>

      {erro && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {erro}
        </div>
      )}

      <Button type="submit" className="w-full" disabled={salvando}>
        {salvando && <Loader2 className="size-4 animate-spin" />}
        Salvar a nova senha
      </Button>
    </form>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { aceitarConvite, entrarComConvite } from "@/server/actions/convidados";

/**
 * Dois caminhos no mesmo lugar.
 *
 * Quem já está logado só confirma. Quem não está cria a conta aqui, e o e-mail
 * vem travado do convite: deixar editar abriria a porta para usar o link de
 * outra pessoa.
 */
export function AceiteDoConvite({
  token,
  email,
  logadoComo,
}: {
  token: string;
  email: string;
  logadoComo: string | null;
}) {
  const router = useRouter();
  const [enviando, start] = useTransition();
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");

  const outraConta =
    logadoComo !== null && logadoComo.toLowerCase() !== email.toLowerCase();

  function entrar() {
    start(async () => {
      const r = await entrarComConvite(token);
      if (r.ok) router.push(`/p/${r.projectId}/list`);
      else toast.error(r.erro);
    });
  }

  function criar() {
    start(async () => {
      const r = await aceitarConvite({ token, nome, senha });
      if (r.ok) router.push(`/p/${r.projectId}/list`);
      else toast.error(r.erro);
    });
  }

  if (logadoComo && !outraConta) {
    return (
      <Button className="mt-6 w-full" onClick={entrar} disabled={enviando}>
        {enviando && <Loader2 className="size-3.5 animate-spin" />}
        Entrar no projeto
      </Button>
    );
  }

  if (outraConta) {
    return (
      <p className="mt-6 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-center text-xs leading-relaxed">
        Este convite é para <strong>{email}</strong>, e você está conectado como{" "}
        <strong>{logadoComo}</strong>. Saia da conta atual e abra o link de novo.
      </p>
    );
  }

  return (
    <div className="mt-6 space-y-3">
      <div>
        <Label className="mb-1 block text-xs text-muted-foreground">E-mail</Label>
        <Input value={email} readOnly disabled />
      </div>
      <div>
        <Label className="mb-1 block text-xs text-muted-foreground">Seu nome</Label>
        <Input
          autoFocus
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Como quer ser chamado"
        />
      </div>
      <div>
        <Label className="mb-1 block text-xs text-muted-foreground">Senha</Label>
        <Input
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          placeholder="Pelo menos 8 caracteres"
        />
      </div>
      <Button
        className="w-full"
        onClick={criar}
        disabled={enviando || !nome.trim() || senha.length < 8}
      >
        {enviando && <Loader2 className="size-3.5 animate-spin" />}
        Criar conta e entrar
      </Button>
    </div>
  );
}

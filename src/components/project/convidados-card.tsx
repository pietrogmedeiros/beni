"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Copy, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  convidarParaProjeto,
  listarConvidados,
  revogarConvidado,
  type ConvidadoDTO,
} from "@/server/actions/convidados";

/**
 * Convidados deste projeto.
 *
 * Convite por link em vez de e-mail: o servidor sabe mandar e-mail, mas link
 * copiado chega por onde a pessoa já conversa com o cliente. Quando a conta já
 * existe, o acesso é dado na hora e nem link aparece, porque não há nada para
 * a pessoa aceitar.
 */
/**
 * Copiar sem deixar o erro subir.
 *
 * `navigator.clipboard` só existe em contexto seguro e ainda pode ser negado
 * por permissão. Sem este `try`, a recusa vira exceção dentro da transição,
 * sobe até a fronteira de erro e **derruba o cartão inteiro**: a pessoa
 * convida alguém e a seção some da tela, parecendo que quebrou tudo.
 */
async function copiarParaAreaDeTransferencia(texto: string) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}

export function ConvidadosCard({ projectId }: { projectId: string }) {
  const [lista, setLista] = useState<ConvidadoDTO[] | null>(null);
  const [email, setEmail] = useState("");
  const [ultimoLink, setUltimoLink] = useState<string | null>(null);
  const [pendente, start] = useTransition();

  useEffect(() => {
    let vivo = true;
    listarConvidados(projectId).then((l) => vivo && setLista(l));
    return () => {
      vivo = false;
    };
  }, [projectId]);

  function convidar() {
    start(async () => {
      const r = await convidarParaProjeto({ projectId, email });
      if (!r.ok) {
        toast.error(r.erro);
        return;
      }
      setEmail("");
      setLista(await listarConvidados(projectId));
      if (r.link) {
        const url = `${window.location.origin}${r.link}`;
        setUltimoLink(url);
        toast.success(
          (await copiarParaAreaDeTransferencia(url))
            ? "Convite criado e link copiado"
            : "Convite criado. Copie o link abaixo.",
        );
      } else {
        toast.success("Pronto, essa pessoa já tem acesso ao projeto");
      }
    });
  }

  async function copiar(link: string) {
    const url = `${window.location.origin}${link}`;
    if (await copiarParaAreaDeTransferencia(url)) {
      toast.success("Link copiado");
    } else {
      setUltimoLink(url);
      toast.message("Não consegui copiar. O link está logo abaixo.");
    }
  }

  function revogar(c: ConvidadoDTO) {
    start(async () => {
      const r = await revogarConvidado(projectId, c.id, c.tipo);
      if (r.ok) {
        setLista(await listarConvidados(projectId));
        toast.success(c.tipo === "convite" ? "Convite cancelado" : "Acesso removido");
      } else {
        toast.error(r.erro);
      }
    });
  }

  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <UserPlus className="size-4" />
        Convidados deste projeto
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        Quem entra por aqui enxerga só este projeto. Trabalha nele como um
        membro: cria tarefa, move no quadro, comenta. Fora dele, nada existe.
      </p>

      <div className="mt-4 flex gap-2">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && email.trim() && convidar()}
          placeholder="email@doconvidado.com"
          className="h-9"
        />
        <Button onClick={convidar} disabled={pendente || !email.trim()} className="h-9">
          {pendente && <Loader2 className="size-3.5 animate-spin" />}
          Convidar
        </Button>
      </div>

      {ultimoLink && (
        <p className="mt-3 rounded-lg border bg-muted/40 p-2.5 font-mono text-[11px] break-all">
          {ultimoLink}
        </p>
      )}

      {lista === null ? (
        <p className="mt-4 text-xs text-muted-foreground">Carregando…</p>
      ) : lista.length === 0 ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Ninguém convidado ainda.
        </p>
      ) : (
        <ul className="mt-4 divide-y rounded-lg border">
          {lista.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{c.nome ?? c.email}</p>
                {c.nome && (
                  <p className="truncate text-xs text-muted-foreground">{c.email}</p>
                )}
              </div>

              {c.tipo === "convite" ? (
                <>
                  <span className="rounded-md bg-amber-500/12 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                    convite pendente
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    aria-label="Copiar link"
                    onClick={() => c.link && copiar(c.link)}
                  >
                    <Copy className="size-3.5" />
                  </Button>
                </>
              ) : (
                <span className="rounded-md bg-emerald-500/12 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                  com acesso
                </span>
              )}

              <Button
                size="icon"
                variant="ghost"
                className="size-7 text-muted-foreground"
                aria-label="Remover"
                disabled={pendente}
                onClick={() => revogar(c)}
              >
                <X className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

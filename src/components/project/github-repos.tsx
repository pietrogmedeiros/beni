"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ExternalLink,
  Lock,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { GithubIcon } from "@/components/github-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  connectRepository,
  disconnectRepository,
  listarRepositoriosDaConta,
} from "@/server/actions/github";
import type { RepoDaConta } from "@/server/github";

export type ProjectRepo = {
  id: string;
  owner: string;
  name: string;
  htmlUrl: string;
  description: string | null;
  defaultBranch: string;
  isPrivate: boolean;
};

export function GithubRepos({
  projectId,
  repositories,
}: {
  projectId: string;
  repositories: ProjectRepo[];
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [filtro, setFiltro] = useState("");
  const [daConta, setDaConta] = useState<RepoDaConta[]>([]);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // a lista chega depois da montagem: a tela de configurações não deve esperar
  // uma chamada ao GitHub para aparecer
  useEffect(() => {
    let vivo = true;
    listarRepositoriosDaConta().then((r) => {
      if (!vivo) return;
      setDaConta(r.repos);
      setErroLista(r.erro);
    });
    return () => {
      vivo = false;
    };
  }, []);

  const jaVinculado = useMemo(
    () => new Set(repositories.map((r) => `${r.owner}/${r.name}`.toLowerCase())),
    [repositories],
  );

  const visiveis = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    const lista = q
      ? daConta.filter((r) => r.fullName.toLowerCase().includes(q))
      : daConta;
    return lista.slice(0, 40);
  }, [daConta, filtro]);

  function connect(escolhido?: string) {
    const input = (escolhido ?? value).trim();
    if (!input) return;
    startTransition(async () => {
      try {
        const repo = await connectRepository(projectId, input);
        setValue("");
        setFiltro("");
        toast.success(`${repo.owner}/${repo.name} vinculado ao projeto`);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao vincular");
      }
    });
  }

  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <GithubIcon className="size-4" />
        GitHub
      </h2>
      <p className="mb-4 text-xs text-muted-foreground">
        Vincule repositórios ao projeto para conectar tarefas a issues e pull
        requests. Repositórios privados exigem um token configurado em{" "}
        <strong className="font-medium">Configurações → GitHub</strong>.
      </p>

      {repositories.length > 0 && (
        <ul className="mb-3 space-y-2">
          {repositories.map((repo) => (
            <li
              key={repo.id}
              className="group flex items-start gap-3 rounded-lg border p-3"
            >
              <GithubIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <a
                    href={repo.htmlUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="truncate hover:underline"
                  >
                    {repo.owner}/{repo.name}
                  </a>
                  {repo.isPrivate && (
                    <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
                      <Lock className="size-2.5" />
                      privado
                    </span>
                  )}
                  <a
                    href={repo.htmlUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-muted-foreground opacity-0 transition group-hover:opacity-100"
                    aria-label="Abrir no GitHub"
                  >
                    <ExternalLink className="size-3" />
                  </a>
                </p>
                {repo.description && (
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {repo.description}
                  </p>
                )}
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                  branch padrão: {repo.defaultBranch}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                aria-label="Desvincular repositório"
                onClick={() =>
                  startTransition(async () => {
                    await disconnectRepository(repo.id);
                    toast.success("Repositório desvinculado");
                    router.refresh();
                  })
                }
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {/*
        Escolher em vez de digitar. O nome no GitHub raramente é o nome que se
        fala, e digitado errado o erro só aparece depois de salvar. A lista só
        existe com token; sem ele, o campo de texto continua sendo o caminho.
      */}
      {daConta.length > 0 && (
        <div className="mb-2">
          <Input
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Procurar nos seus repositórios…"
            className="h-9"
          />
          <ul className="thin-scrollbar mt-2 max-h-56 space-y-1 overflow-y-auto rounded-lg border p-1">
            {visiveis.length === 0 ? (
              <li className="px-2 py-3 text-center text-xs text-muted-foreground">
                Nada com esse nome.
              </li>
            ) : (
              visiveis.map((r) => (
                <li key={r.fullName}>
                  <button
                    type="button"
                    disabled={pending || jaVinculado.has(r.fullName.toLowerCase())}
                    onClick={() => connect(r.fullName)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition hover:bg-muted disabled:opacity-40"
                  >
                    <span className="truncate font-medium">{r.fullName}</span>
                    {r.privado && (
                      <span className="shrink-0 rounded bg-muted px-1 text-[10px] text-muted-foreground">
                        privado
                      </span>
                    )}
                    {jaVinculado.has(r.fullName.toLowerCase()) && (
                      <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                        já vinculado
                      </span>
                    )}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}

      {erroLista && (
        <p className="mb-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs leading-relaxed">
          {erroLista} Você ainda pode vincular digitando o nome abaixo.
        </p>
      )}

      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && connect()}
          placeholder="dono/repositório ou https://github.com/dono/repositório"
          className="h-9 flex-1"
        />
        <Button variant="outline" disabled={pending || !value.trim()} onClick={() => connect()}>
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          Vincular
        </Button>
      </div>
    </section>
  );
}

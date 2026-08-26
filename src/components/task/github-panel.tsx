"use client";

import { useRouter } from "next/navigation";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  CircleDot,
  Copy,
  ExternalLink,
  GitMerge,
  GitPullRequest,
  Loader2,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import { GithubIcon } from "@/components/github-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  linkGithubItem,
  listOpenItemsForRepo,
  listRepositoriesForTask,
  syncGithubLinks,
  unlinkGithubItem,
} from "@/server/actions/github";
import { RelativeTime } from "@/components/relative-time";
import { cn, slugify } from "@/lib/utils";

export type GithubLinkDTO = {
  id: string;
  type: string;
  number: number;
  title: string;
  state: string;
  htmlUrl: string;
  author: string | null;
  syncedAt: string;
  repo: string;
};

type RepoOption = {
  id: string;
  owner: string;
  name: string;
  htmlUrl: string;
  defaultBranch: string;
};

const STATE_STYLE: Record<string, { label: string; className: string }> = {
  open: { label: "aberto", className: "bg-success/15 text-success" },
  draft: { label: "rascunho", className: "bg-muted text-muted-foreground" },
  closed: { label: "fechado", className: "bg-destructive/15 text-destructive" },
  merged: { label: "mesclado", className: "bg-primary/15 text-primary-strong" },
};

export function GithubPanel({
  projectId,
  onSair,
  taskId,
  taskKey,
  taskTitle,
  links,
  onRefresh,
}: {
  projectId: string;
  /** Fecha a folha da tarefa antes de sair dela. */
  onSair?: () => void;
  taskId: string;
  taskKey: string;
  taskTitle: string;
  links: GithubLinkDTO[];
  onRefresh: () => Promise<void>;
}) {
  const router = useRouter();
  const [repos, setRepos] = useState<RepoOption[] | null>(null);
  const [repoId, setRepoId] = useState("");
  const [reference, setReference] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    listRepositoriesForTask(taskId).then((list) => {
      if (!active) return;
      setRepos(list);
      setRepoId((current) => current || list[0]?.id || "");
    });
    return () => {
      active = false;
    };
  }, [taskId]);

  const branch = `feature/${taskKey.toLowerCase()}-${slugify(taskTitle).slice(0, 40)}`;

  function link(ref: string) {
    if (!repoId || !ref.trim()) return;
    startTransition(async () => {
      try {
        await linkGithubItem({ taskId, repoId, reference: ref });
        setReference("");
        toast.success("Vinculado ao GitHub");
        await onRefresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao vincular");
      }
    });
  }

  if (repos === null) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (repos.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <GithubIcon className="mx-auto mb-2 size-6 text-muted-foreground" />
        <p className="text-sm font-medium">Nenhum repositório vinculado</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Vincule um repositório ao projeto para conectar issues e pull requests
          às tarefas.
        </p>
        {/*
          Antes esta mensagem descrevia o caminho ("Configurar projeto →
          GitHub") e a pessoa tinha de encontrá-lo sozinha. Descrever um
          caminho é pedir que o outro faça o trajeto; o botão faz.
        */}
        {/*
          A tarefa vive numa folha sobreposta. Um link comum navegava a página
          de baixo e deixava a folha aberta por cima: a pessoa clicava e nada
          parecia acontecer. Fechar antes de navegar é o que faz o clique ter
          efeito visível.
        */}
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => {
            onSair?.();
            router.push(`/p/${projectId}/settings`);
          }}
        >
          Escolher repositório
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* itens vinculados */}
      {links.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Issues e pull requests
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const { updated } = await syncGithubLinks(taskId);
                  toast.success(`${updated} item(ns) atualizado(s)`);
                  await onRefresh();
                })
              }
            >
              <RefreshCw className={cn("size-3", pending && "animate-spin")} />
              Atualizar
            </Button>
          </div>

          {links.map((l) => {
            const style = STATE_STYLE[l.state] ?? {
              label: l.state,
              className: "bg-muted text-muted-foreground",
            };
            const Icon =
              l.state === "merged"
                ? GitMerge
                : l.type === "PULL_REQUEST"
                  ? GitPullRequest
                  : l.state === "closed"
                    ? CheckCircle2
                    : CircleDot;

            return (
              <div
                key={l.id}
                className="group flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm"
              >
                <Icon
                  className={cn(
                    "size-4 shrink-0",
                    l.state === "open" && "text-success",
                    l.state === "merged" && "text-primary-strong",
                    l.state === "closed" && "text-destructive",
                  )}
                />
                <a
                  href={l.htmlUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="min-w-0 flex-1 truncate hover:underline"
                  title={`${l.repo}#${l.number} — ${l.title}`}
                >
                  <span className="font-mono text-[11px] text-muted-foreground">
                    #{l.number}
                  </span>{" "}
                  {l.title}
                </a>
                <span
                  className={cn(
                    "shrink-0 rounded px-1.5 text-[10px] font-medium",
                    style.className,
                  )}
                >
                  {style.label}
                </span>
                <a
                  href={l.htmlUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100"
                  aria-label="Abrir no GitHub"
                >
                  <ExternalLink className="size-3.5" />
                </a>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 shrink-0 opacity-0 transition group-hover:opacity-100"
                  aria-label="Desvincular"
                  onClick={() =>
                    startTransition(async () => {
                      await unlinkGithubItem(l.id);
                      await onRefresh();
                    })
                  }
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            );
          })}
          <p className="text-[11px] text-muted-foreground">
            Sincronizado <RelativeTime date={links[0].syncedAt} />
          </p>
        </div>
      )}

      {/* vincular novo */}
      <div className="space-y-2 rounded-lg border p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Vincular issue ou pull request
        </p>

        <div className="flex gap-2">
          {repos.length > 1 && (
            <Select
              value={repoId}
              onValueChange={(v) => setRepoId(v ?? "")}
              items={Object.fromEntries(
                repos.map((r) => [r.id, `${r.owner}/${r.name}`]),
              )}
            >
              <SelectTrigger className="h-8 w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {repos.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.owner}/{r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && link(reference)}
            placeholder="#42 ou cole a URL"
            className="h-8 flex-1"
          />

          <Button
            size="sm"
            className="h-8"
            disabled={pending || !reference.trim()}
            onClick={() => link(reference)}
          >
            {pending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Plus className="size-3.5" />
            )}
            Vincular
          </Button>

          <BrowseOpenItems repoId={repoId} onPick={(n) => link(String(n))} />
        </div>
      </div>

      {/* nome de branch sugerido */}
      <div className="rounded-lg border border-dashed p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Branch sugerida
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 font-mono text-[11px]">
            {branch}
          </code>
          <Button
            variant="outline"
            size="sm"
            className="h-7 shrink-0"
            onClick={() => {
              navigator.clipboard.writeText(branch);
              toast.success("Nome da branch copiado");
            }}
          >
            <Copy className="size-3.5" />
            Copiar
          </Button>
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Use o identificador da tarefa no nome da branch e no título do PR para
          achar tudo depois.
        </p>
      </div>
    </div>
  );
}

/** Lista as issues/PRs abertas do repositório para escolher sem sair da tela. */
function BrowseOpenItems({
  repoId,
  onPick,
}: {
  repoId: string;
  onPick: (n: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<
    { number: number; title: string; type: string; state: string }[] | null
  >(null);

  useEffect(() => {
    if (!open || !repoId) return;
    // busca no GitHub — sincronização com fonte externa
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(null);
    listOpenItemsForRepo(repoId).then(setItems);
  }, [open, repoId]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-sm transition hover:bg-muted"
        aria-label="Procurar issues abertas"
      >
        <GithubIcon className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <Command>
          <CommandInput placeholder="Buscar issue ou PR aberta…" />
          <CommandList>
            {items === null ? (
              <div className="flex justify-center py-6">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <CommandEmpty>Nada aberto por aqui.</CommandEmpty>
                <CommandGroup>
                  {items.map((i) => (
                    <CommandItem
                      key={i.number}
                      value={`${i.number} ${i.title}`}
                      onSelect={() => {
                        onPick(i.number);
                        setOpen(false);
                      }}
                    >
                      {i.type === "PULL_REQUEST" ? (
                        <GitPullRequest className="size-3.5 text-success" />
                      ) : (
                        <CircleDot className="size-3.5 text-success" />
                      )}
                      <span className="font-mono text-[11px] text-muted-foreground">
                        #{i.number}
                      </span>
                      <span className="flex-1 truncate">{i.title}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

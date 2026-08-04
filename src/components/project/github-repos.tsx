"use client";

import { useState, useTransition } from "react";
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
} from "@/server/actions/github";

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
  const [pending, startTransition] = useTransition();

  function connect() {
    const input = value.trim();
    if (!input) return;
    startTransition(async () => {
      try {
        const repo = await connectRepository(projectId, input);
        setValue("");
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

      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && connect()}
          placeholder="dono/repositório ou https://github.com/dono/repositório"
          className="h-9 flex-1"
        />
        <Button variant="outline" disabled={pending || !value.trim()} onClick={connect}>
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

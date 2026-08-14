"use client";

import Link from "next/link";
import { AlertTriangle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { Progress } from "@/components/ui/progress";
import { DynamicIcon } from "@/components/dynamic-icon";
import { useApp } from "@/components/app-shell/app-context";
import { PROJECT_VIEWS } from "@/lib/constants";

type ProjectSummary = {
  id: string;
  name: string;
  key: string;
  color: string;
  icon: string;
  total: number;
  done: number;
  overdue: number;
  progress: number;
};

export function ProjectsView({ projects }: { projects: ProjectSummary[] }) {
  const { openNewProject, projects: ctxProjects } = useApp();

  return (
    <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl p-5">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Projetos</h1>
            <p className="text-sm text-muted-foreground">
              {projects.length}{" "}
              {projects.length === 1 ? "projeto ativo" : "projetos ativos"} no
              workspace
            </p>
          </div>
          <Button onClick={openNewProject}>
            <Plus className="size-4" />
            Novo projeto
          </Button>
        </div>

        {projects.length === 0 ? (
          <EmptyState
            pose="andando"
            titulo="Nenhum projeto por aqui ainda"
            descricao="Um projeto guarda as tarefas, o backlog e o prazo de uma entrega."
            acao={
              <Button onClick={openNewProject}>
                <Plus className="size-4" />
                Criar o primeiro
              </Button>
            }
            className="rounded-xl border border-dashed py-16"
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {projects.map((p) => {
              const description = ctxProjects.find(
                (c) => c.id === p.id,
              )?.description;
              return (
                <article
                  key={p.id}
                  className="group flex flex-col rounded-xl border bg-card p-4 transition hover:border-primary/40 hover:shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="flex size-10 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `${p.color}1f` }}
                    >
                      <DynamicIcon
                        name={p.icon}
                        className="size-5"
                        style={{ color: p.color }}
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/p/${p.id}/board`}
                        className="block truncate text-[15px] font-semibold hover:underline"
                      >
                        {p.name}
                      </Link>
                      <span
                        className="rounded px-1 font-mono text-[10px] font-medium"
                        style={{ backgroundColor: `${p.color}1f`, color: p.color }}
                      >
                        {p.key}
                      </span>
                    </div>
                    {p.overdue > 0 && (
                      <span className="inline-flex items-center gap-1 rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                        <AlertTriangle className="size-3" />
                        {p.overdue}
                      </span>
                    )}
                  </div>

                  {description && (
                    <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                      {description}
                    </p>
                  )}

                  <div className="mt-4 flex items-center gap-2">
                    <Progress value={p.progress} className="h-1.5 flex-1" />
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      {p.done}/{p.total}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1 border-t pt-3">
                    {PROJECT_VIEWS.slice(0, 4).map((view) => (
                      <Link
                        key={view.slug}
                        href={`/p/${p.id}/${view.slug}`}
                        className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-muted-foreground transition hover:bg-accent hover:text-foreground"
                      >
                        <DynamicIcon name={view.icon} className="size-3" />
                        {view.label}
                      </Link>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, CircleDot, ListTodo } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { BarList, ChartCard, StatTile } from "@/components/charts/primitives";
import { DynamicIcon } from "@/components/dynamic-icon";
import { UserAvatar } from "@/components/user-avatar";
import { useApp } from "@/components/app-shell/app-context";
import { PRIORITY_META, type PriorityValue } from "@/lib/constants";
import { isOverdue } from "@/lib/utils";
import type { TaskDTO } from "@/server/queries";

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

/** Visão consolidada do workspace: como cada projeto e cada pessoa estão. */
export function DashboardsView({
  userId,
  tasks,
  projects,
}: {
  userId: string;
  tasks: TaskDTO[];
  projects: ProjectSummary[];
}) {
  const { members } = useApp();
  const root = useMemo(() => tasks.filter((t) => !t.parentId), [tasks]);

  const done = root.filter((t) => t.statusCategory === "DONE");
  const inProgress = root.filter((t) => t.statusCategory === "IN_PROGRESS");
  const overdue = root.filter((t) =>
    isOverdue(t.dueDate, t.statusCategory === "DONE"),
  );

  const byProject = projects.map((p) => ({
    id: p.id,
    label: p.name,
    value: p.total - p.done,
    color: p.color,
    extra: `${p.progress}% concluído`,
  }));

  const byPerson = useMemo(() => {
    const rows = members
      .map((m) => {
        const items = root.filter((t) => t.assignee?.id === m.id);
        return {
          id: m.id,
          label: m.name,
          value: items.filter((t) => t.statusCategory !== "DONE").length,
          extra: `${items.filter((t) => t.statusCategory === "DONE").length} concluídas`,
          color: "var(--chart-1)",
        };
      })
      .filter((r) => r.value > 0);

    const none = root.filter(
      (t) => !t.assignee && t.statusCategory !== "DONE",
    ).length;
    if (none > 0) {
      rows.push({
        id: "none",
        label: "Sem responsável",
        value: none,
        extra: "",
        color: "var(--chart-4)",
      });
    }
    return rows.sort((a, b) => b.value - a.value);
  }, [members, root]);

  const byPriority = (["URGENT", "HIGH", "MEDIUM", "LOW", "NONE"] as const)
    .map((p) => ({
      id: p,
      label: PRIORITY_META[p as PriorityValue].label,
      value: root.filter((t) => t.priority === p && t.statusCategory !== "DONE")
        .length,
      color: PRIORITY_META[p as PriorityValue].color,
    }))
    .filter((p) => p.value > 0);

  return (
    <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl p-5">
        <div className="mb-5">
          <h1 className="text-2xl font-semibold tracking-tight">Painéis</h1>
          <p className="text-sm text-muted-foreground">
            Como está o trabalho em todos os projetos do workspace.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Tarefas no total"
            value={root.length}
            hint={`${done.length} concluídas`}
            accent="var(--chart-1)"
            icon={<ListTodo className="size-4" />}
          />
          <StatTile
            label="Em andamento"
            value={inProgress.length}
            hint="ativas agora"
            accent="var(--chart-3)"
            icon={<CircleDot className="size-4" />}
          />
          <StatTile
            label="Minhas em aberto"
            value={
              root.filter(
                (t) => t.assignee?.id === userId && t.statusCategory !== "DONE",
              ).length
            }
            hint="atribuídas a você"
            accent="var(--chart-2)"
            icon={<CheckCircle2 className="size-4" />}
          />
          <StatTile
            label="Atrasadas"
            value={overdue.length}
            hint={overdue.length ? "precisam de atenção" : "tudo em dia"}
            accent="var(--destructive)"
            icon={<AlertTriangle className="size-4" />}
          />
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <ChartCard
            title="Trabalho em aberto por projeto"
            description="Tarefas que ainda não foram concluídas"
          >
            <BarList items={byProject} emptyLabel="Tudo concluído 🎉" />
          </ChartCard>

          <ChartCard
            title="Carga por pessoa"
            description="Tarefas em aberto atribuídas a cada um"
          >
            <BarList items={byPerson} emptyLabel="Ninguém com pendências" />
          </ChartCard>

          <ChartCard
            title="Urgência do workspace"
            description="Tarefas em aberto por prioridade"
          >
            <BarList items={byPriority} emptyLabel="Nada pendente" />
          </ChartCard>

          <section className="rounded-xl border bg-card p-4">
            <h3 className="text-sm font-semibold">Progresso dos projetos</h3>
            <p className="mb-3 text-xs text-muted-foreground">
              Clique para abrir o painel detalhado de cada um
            </p>
            <div className="space-y-2">
              {projects.map((p) => (
                <Link
                  key={p.id}
                  href={`/p/${p.id}/dashboard`}
                  className="flex items-center gap-3 rounded-lg border p-2.5 transition hover:border-primary/40"
                >
                  <span
                    className="flex size-7 shrink-0 items-center justify-center rounded-md"
                    style={{ backgroundColor: `${p.color}26` }}
                  >
                    <DynamicIcon
                      name={p.icon}
                      className="size-3.5"
                      style={{ color: p.color }}
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{p.name}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <Progress value={p.progress} className="h-1.5 flex-1" />
                      <span className="text-[11px] tabular-nums text-muted-foreground">
                        {p.done}/{p.total}
                      </span>
                    </div>
                  </div>
                  {p.overdue > 0 && (
                    <span className="shrink-0 rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                      {p.overdue} atrasada{p.overdue > 1 ? "s" : ""}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </section>
        </div>

        <details className="mt-3 rounded-xl border bg-card p-4">
          <summary className="cursor-pointer text-sm font-semibold">
            Ver dados em tabela
          </summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-1.5 pr-4 font-medium">Pessoa</th>
                  <th className="py-1.5 pr-4 font-medium">Em aberto</th>
                  <th className="py-1.5 pr-4 font-medium">Concluídas</th>
                  <th className="py-1.5 font-medium">Atrasadas</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const items = root.filter((t) => t.assignee?.id === m.id);
                  if (items.length === 0) return null;
                  return (
                    <tr key={m.id} className="border-b border-border/50">
                      <td className="py-1.5 pr-4">
                        <span className="flex items-center gap-2">
                          <UserAvatar
                            user={m}
                            showTooltip={false}
                            className="size-5"
                          />
                          {m.name}
                        </span>
                      </td>
                      <td className="py-1.5 pr-4 tabular-nums">
                        {items.filter((t) => t.statusCategory !== "DONE").length}
                      </td>
                      <td className="py-1.5 pr-4 tabular-nums">
                        {items.filter((t) => t.statusCategory === "DONE").length}
                      </td>
                      <td className="py-1.5 tabular-nums">
                        {
                          items.filter((t) =>
                            isOverdue(t.dueDate, t.statusCategory === "DONE"),
                          ).length
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>
      </div>
    </div>
  );
}

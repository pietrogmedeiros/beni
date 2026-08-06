"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ListTodo,
  Plus,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatTile, ChartCard, BarList } from "@/components/charts/primitives";
import { DynamicIcon } from "@/components/dynamic-icon";
import { UserAvatar } from "@/components/user-avatar";
import {
  DueDate,
  PriorityFlag,
  StatusDot,
  TypeIcon,
} from "@/components/task/task-badges";
import { RelativeTime } from "@/components/relative-time";
import { useApp } from "@/components/app-shell/app-context";
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

type ActivityItem = {
  id: string;
  action: string;
  meta: Record<string, unknown> | null;
  createdAt: string;
  user: { id: string; name: string; avatarColor: string } | null;
  task: { id: string; number: number; title: string } | null;
  project: { id: string; name: string; key: string; color: string };
};

export function HomeView({
  userId,
  userName,
  tasks,
  projects,
  activity,
}: {
  userId: string;
  userName: string;
  tasks: TaskDTO[];
  projects: ProjectSummary[];
  activity: ActivityItem[];
}) {
  const { openTask, openNewTask, openNewProject } = useApp();

  const root = useMemo(() => tasks.filter((t) => !t.parentId), [tasks]);
  const mine = root.filter((t) => t.assignee?.id === userId);
  const open = mine.filter((t) => t.statusCategory !== "DONE");
  const overdue = open.filter((t) => isOverdue(t.dueDate, false));
  const dueSoon = open
    .filter((t) => t.dueDate && !isOverdue(t.dueDate, false))
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
    .slice(0, 6);

  const completedThisWeek = useMemo(() => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return root.filter(
      (t) => t.completedAt && new Date(t.completedAt) >= weekAgo,
    ).length;
  }, [root]);

  const workload = useMemo(
    () =>
      projects
        .map((p) => ({
          id: p.id,
          label: p.name,
          value: p.total - p.done,
          color: p.color,
          extra: `${p.progress}% concluído`,
        }))
        .filter((p) => p.value > 0),
    [projects],
  );

  const greeting = getGreeting();

  return (
    <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl p-5">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {greeting}, {userName.split(" ")[0]}
            </h1>
            <p className="text-sm text-muted-foreground">
              {open.length === 0
                ? "Você está sem tarefas em aberto. Bom trabalho!"
                : `Você tem ${open.length} ${open.length === 1 ? "tarefa aberta" : "tarefas abertas"}${
                    overdue.length ? ` · ${overdue.length} em atraso` : ""
                  }.`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={openNewProject}>
              <Plus className="size-4" />
              Projeto
            </Button>
            <Button onClick={() => openNewTask()}>
              <Plus className="size-4" />
              Nova tarefa
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Minhas tarefas abertas"
            value={open.length}
            hint={`${mine.length} atribuídas no total`}
            accent="var(--chart-1)"
            icon={<ListTodo className="size-4" />}
          />
          <StatTile
            label="Em atraso"
            value={overdue.length}
            hint={overdue.length ? "revise os prazos" : "tudo em dia"}
            accent="var(--destructive)"
            icon={<AlertTriangle className="size-4" />}
          />
          <StatTile
            label="Concluídas na semana"
            value={completedThisWeek}
            hint="por todo o workspace"
            accent="var(--chart-2)"
            icon={<CheckCircle2 className="size-4" />}
          />
          <StatTile
            label="Projetos ativos"
            value={projects.length}
            hint={`${root.length} tarefas no total`}
            accent="var(--chart-5)"
            icon={<Sparkles className="size-4" />}
          />
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1.4fr_1fr]">
          {/* prioridades de hoje */}
          <ChartCard
            title="Suas próximas entregas"
            description="Tarefas atribuídas a você, ordenadas por prazo"
            action={
              <Button variant="ghost" size="sm" className="h-7 text-xs" nativeButton={false} render={<Link href="/my-tasks" />}>
                Ver todas
                <ArrowRight className="size-3.5" />
              </Button>
            }
          >
            {overdue.length === 0 && dueSoon.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Nenhuma tarefa com prazo definido.
              </p>
            ) : (
              <div className="space-y-1">
                {[...overdue, ...dueSoon].slice(0, 8).map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => openTask(task.id)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition hover:bg-accent/50"
                  >
                    <TypeIcon type={task.type} />
                    <StatusDot color={task.statusColor} />
                    <span className="min-w-0 flex-1 truncate text-[13px]">
                      {task.title}
                    </span>
                    <span
                      className="hidden shrink-0 rounded px-1 font-mono text-[10px] sm:block"
                      style={{
                        backgroundColor: `${task.projectColor}1f`,
                        color: task.projectColor,
                      }}
                    >
                      {task.projectKey}
                    </span>
                    <PriorityFlag priority={task.priority} />
                    <DueDate date={task.dueDate} done={false} />
                  </button>
                ))}
              </div>
            )}
          </ChartCard>

          {/* atividade */}
          <ChartCard
            title="Atividade recente"
            description="O que o time andou fazendo"
          >
            {activity.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Nada por aqui ainda.
              </p>
            ) : (
              <ul className="space-y-3">
                {activity.slice(0, 8).map((a) => (
                  <li key={a.id} className="flex gap-2.5">
                    <UserAvatar
                      user={
                        a.user
                          ? {
                              name: a.user.name,
                              avatarColor: a.user.avatarColor,
                            }
                          : null
                      }
                      showTooltip={false}
                      className="mt-0.5 size-6"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] leading-snug">
                        <span className="font-medium">
                          {a.user?.name ?? "Alguém"}
                        </span>{" "}
                        <span className="text-muted-foreground">
                          {describe(a.action)}
                        </span>{" "}
                        {a.task && (
                          <button
                            type="button"
                            onClick={() => openTask(a.task!.id)}
                            className="font-medium hover:underline"
                          >
                            {a.task.title}
                          </button>
                        )}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {a.project.name} · <RelativeTime date={a.createdAt} />
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </ChartCard>
        </div>

        {/* projetos */}
        <div className="mt-4 grid gap-3 lg:grid-cols-[1.4fr_1fr]">
          <section className="rounded-xl border bg-card p-4">
            <div className="mb-3 flex items-center">
              <div>
                <h3 className="text-sm font-semibold">Seus projetos</h3>
                <p className="text-xs text-muted-foreground">
                  Progresso e pendências de cada frente
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-7 text-xs"
                nativeButton={false} render={<Link href="/projects" />}
              >
                Ver todos
                <ArrowRight className="size-3.5" />
              </Button>
            </div>

            {projects.length === 0 ? (
              <button
                type="button"
                onClick={openNewProject}
                className="w-full rounded-lg border border-dashed py-8 text-sm text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
              >
                <Plus className="mx-auto mb-1 size-5" />
                Criar seu primeiro projeto
              </button>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {projects.map((p) => (
                  <Link
                    key={p.id}
                    href={`/p/${p.id}/board`}
                    className="rounded-lg border p-3 transition hover:border-primary/40 hover:shadow-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="flex size-7 items-center justify-center rounded-md"
                        style={{ backgroundColor: `${p.color}1f` }}
                      >
                        <DynamicIcon
                          name={p.icon}
                          className="size-3.5"
                          style={{ color: p.color }}
                        />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                        {p.name}
                      </span>
                      {p.overdue > 0 && (
                        <span className="inline-flex items-center gap-1 rounded bg-destructive/10 px-1.5 text-[10px] font-medium text-destructive">
                          <CalendarClock className="size-3" />
                          {p.overdue}
                        </span>
                      )}
                    </div>
                    <div className="mt-2.5 flex items-center gap-2">
                      <Progress value={p.progress} className="h-1.5 flex-1" />
                      <span className="text-[11px] tabular-nums text-muted-foreground">
                        {p.done}/{p.total}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <ChartCard
            title="Trabalho em aberto por projeto"
            description="Tarefas ainda não concluídas"
          >
            <BarList items={workload} emptyLabel="Tudo concluído 🎉" />
          </ChartCard>
        </div>
      </div>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 6) return "Boa madrugada";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function describe(action: string) {
  switch (action) {
    case "task.created":
      return "criou";
    case "task.status_changed":
      return "moveu";
    case "comment.added":
      return "comentou em";
    case "task.deleted":
      return "excluiu";
    default:
      return "atualizou";
  }
}

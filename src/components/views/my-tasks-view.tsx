"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserAvatar } from "@/components/user-avatar";
import {
  DueDate,
  PriorityFlag,
  StatusDot,
  TagChip,
  TypeIcon,
} from "@/components/task/task-badges";
import {
  TaskFilterBar,
  applyFilters,
  useTaskFilters,
} from "@/components/project/task-filters";
import { useApp } from "@/components/app-shell/app-context";
import { toggleTaskDone } from "@/server/actions/tasks";
import { cn, isOverdue } from "@/lib/utils";
import type { TaskDTO } from "@/server/queries";

type Bucket = "todas" | "hoje" | "atrasadas" | "semana" | "concluidas";

export function MyTasksView({ tasks }: { tasks: TaskDTO[] }) {
  const { members, tags, openTask, openNewTask, projects } = useApp();
  const router = useRouter();
  const { filters, set, toggle, reset } = useTaskFilters({ groupBy: "none" });
  const [bucket, setBucket] = useState<Bucket>("todas");
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => applyFilters(tasks, filters), [tasks, filters]);

  const buckets = useMemo(() => {
    const now = new Date();
    const today = new Date(now);
    today.setHours(23, 59, 59, 999);
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const openTasks = filtered.filter((t) => t.statusCategory !== "DONE");
    return {
      todas: openTasks,
      hoje: openTasks.filter((t) => t.dueDate && new Date(t.dueDate) <= today),
      atrasadas: openTasks.filter((t) => isOverdue(t.dueDate, false)),
      semana: openTasks.filter(
        (t) => t.dueDate && new Date(t.dueDate) <= weekEnd,
      ),
      concluidas: filtered.filter((t) => t.statusCategory === "DONE"),
    } satisfies Record<Bucket, TaskDTO[]>;
  }, [filtered]);

  const items = buckets[bucket];

  const byProject = useMemo(() => {
    const map = new Map<string, TaskDTO[]>();
    for (const t of items) {
      map.set(t.projectId, [...(map.get(t.projectId) ?? []), t]);
    }
    return [...map.entries()].map(([projectId, list]) => ({
      project: projects.find((p) => p.id === projectId),
      list,
    }));
  }, [items, projects]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 border-b bg-background px-4">
        <div className="flex h-14 items-center gap-3">
          <div>
            <h1 className="text-[15px] font-semibold leading-tight">
              Minhas tarefas
            </h1>
            <p className="text-xs text-muted-foreground">
              Tudo o que está atribuído a você, em todos os projetos
            </p>
          </div>
          <Button size="sm" className="ml-auto" onClick={() => openNewTask()}>
            <Plus className="size-4" />
            Nova tarefa
          </Button>
        </div>

        <Tabs value={bucket} onValueChange={(v) => setBucket(v as Bucket)}>
          <TabsList className="mb-2">
            {(
              [
                ["todas", "Todas", buckets.todas.length],
                ["hoje", "Para hoje", buckets.hoje.length],
                ["atrasadas", "Atrasadas", buckets.atrasadas.length],
                ["semana", "Próximos 7 dias", buckets.semana.length],
                ["concluidas", "Concluídas", buckets.concluidas.length],
              ] as const
            ).map(([value, label, count]) => (
              <TabsTrigger key={value} value={value}>
                {label}
                <span className="ml-1.5 rounded bg-muted px-1 text-[10px] tabular-nums">
                  {count}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </header>

      <div className="px-4">
        <TaskFilterBar
          filters={filters}
          set={set}
          toggle={toggle}
          reset={reset}
          members={members}
          tags={tags}
          showGrouping={false}
        />
      </div>

      <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-8">
        {items.length === 0 && (
          <p className="py-20 text-center text-sm text-muted-foreground">
            Nada por aqui. Aproveite! 🎉
          </p>
        )}

        {byProject.map(({ project, list }) => (
          <section key={project?.id ?? "sem-projeto"} className="mt-4">
            <div className="mb-1 flex items-center gap-2 px-2">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: project?.color ?? "#94a3b8" }}
              />
              <h2 className="text-[13px] font-semibold">
                {project?.name ?? "Sem projeto"}
              </h2>
              <span className="rounded bg-muted px-1.5 text-[11px] tabular-nums text-muted-foreground">
                {list.length}
              </span>
            </div>

            <div>
              {list.map((task) => {
                const done = task.statusCategory === "DONE";
                return (
                  <div
                    key={task.id}
                    className="group flex items-center gap-2 rounded-md border-b border-border/50 px-2 py-2 transition hover:bg-accent/40"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        startTransition(async () => {
                          await toggleTaskDone(task.id);
                          router.refresh();
                        })
                      }
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded-full border-2 transition",
                        done
                          ? "border-success bg-success text-white"
                          : "border-muted-foreground/40 hover:border-primary",
                      )}
                      aria-label={done ? "Reabrir" : "Concluir"}
                    >
                      {done && (
                        <svg
                          viewBox="0 0 12 12"
                          className="size-2.5 fill-none stroke-current stroke-2"
                        >
                          <path
                            d="M2 6.5 4.5 9 10 3.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </button>

                    <TypeIcon type={task.type} />
                    <StatusDot color={task.statusColor} />

                    <button
                      type="button"
                      onClick={() => openTask(task.id)}
                      className={cn(
                        "min-w-0 flex-1 truncate text-left text-[13px]",
                        done && "text-muted-foreground line-through",
                      )}
                    >
                      {task.title}
                    </button>

                    <div className="hidden items-center gap-1 lg:flex">
                      {task.tags.slice(0, 2).map((t) => (
                        <TagChip key={t.id} name={t.name} color={t.color} />
                      ))}
                    </div>

                    <span className="hidden text-[11px] text-muted-foreground sm:block">
                      {task.statusName}
                    </span>
                    <PriorityFlag priority={task.priority} />
                    <DueDate date={task.dueDate} done={done} />
                    <UserAvatar user={task.assignee} className="size-5" />
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

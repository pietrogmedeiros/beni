"use client";

import { useMemo, useState } from "react";
import { Filter, Search, SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/user-avatar";
import { PriorityFlag } from "@/components/task/task-badges";
import { PRIORITIES, PRIORITY_META } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { TaskDTO, UserDTO } from "@/server/queries";

export type GroupBy = "status" | "assignee" | "priority" | "sprint" | "none";
export type SortBy = "manual" | "priority" | "dueDate" | "created" | "title";

export type TaskFilterState = {
  search: string;
  assignees: string[];
  priorities: string[];
  tags: string[];
  types: string[];
  showDone: boolean;
  groupBy: GroupBy;
  sortBy: SortBy;
};

export const defaultFilters: TaskFilterState = {
  search: "",
  assignees: [],
  priorities: [],
  tags: [],
  types: [],
  showDone: true,
  groupBy: "status",
  sortBy: "manual",
};

export function useTaskFilters(initial?: Partial<TaskFilterState>) {
  const [filters, setFilters] = useState<TaskFilterState>({
    ...defaultFilters,
    ...initial,
  });

  const set = <K extends keyof TaskFilterState>(
    key: K,
    value: TaskFilterState[K],
  ) => setFilters((f) => ({ ...f, [key]: value }));

  const toggle = (key: "assignees" | "priorities" | "tags" | "types", id: string) =>
    setFilters((f) => ({
      ...f,
      [key]: f[key].includes(id)
        ? f[key].filter((v) => v !== id)
        : [...f[key], id],
    }));

  return { filters, set, toggle, reset: () => setFilters(defaultFilters) };
}

export function applyFilters(tasks: TaskDTO[], f: TaskFilterState) {
  const term = f.search.trim().toLowerCase();
  const filtered = tasks.filter((t) => {
    if (term && !`${t.title} ${t.projectKey}-${t.number}`.toLowerCase().includes(term))
      return false;
    if (!f.showDone && t.statusCategory === "DONE") return false;
    if (f.assignees.length) {
      const id = t.assignee?.id ?? "none";
      if (!f.assignees.includes(id)) return false;
    }
    if (f.priorities.length && !f.priorities.includes(t.priority)) return false;
    if (f.types.length && !f.types.includes(t.type)) return false;
    if (f.tags.length && !t.tags.some((tag) => f.tags.includes(tag.id)))
      return false;
    return true;
  });

  const sorted = [...filtered];
  switch (f.sortBy) {
    case "priority":
      sorted.sort(
        (a, b) =>
          (PRIORITY_META[b.priority as keyof typeof PRIORITY_META]?.rank ?? 0) -
          (PRIORITY_META[a.priority as keyof typeof PRIORITY_META]?.rank ?? 0),
      );
      break;
    case "dueDate":
      sorted.sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      });
      break;
    case "created":
      sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      break;
    case "title":
      sorted.sort((a, b) => a.title.localeCompare(b.title));
      break;
    default:
      sorted.sort((a, b) => a.order - b.order);
  }
  return sorted;
}

export function TaskFilterBar({
  filters,
  set,
  toggle,
  reset,
  members,
  tags,
  showGrouping = true,
  extra,
}: {
  filters: TaskFilterState;
  set: <K extends keyof TaskFilterState>(k: K, v: TaskFilterState[K]) => void;
  toggle: (k: "assignees" | "priorities" | "tags" | "types", id: string) => void;
  reset: () => void;
  members: UserDTO[];
  tags: { id: string; name: string; color: string }[];
  showGrouping?: boolean;
  extra?: React.ReactNode;
}) {
  const activeCount = useMemo(
    () =>
      filters.assignees.length +
      filters.priorities.length +
      filters.tags.length +
      filters.types.length +
      (filters.showDone ? 0 : 1),
    [filters],
  );

  return (
    <div className="flex flex-wrap items-center gap-2 border-t px-1 py-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
          placeholder="Filtrar tarefas…"
          className="h-8 w-56 pl-8"
        />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="h-8" />}>
            <Filter className="size-3.5" />
            Filtros
            {activeCount > 0 && (
              <span className="rounded bg-primary px-1 text-[10px] text-primary-foreground">
                {activeCount}
              </span>
            )}
          </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60">
          <DropdownMenuLabel>Responsável</DropdownMenuLabel>
          <DropdownMenuCheckboxItem
            checked={filters.assignees.includes("none")}
            onCheckedChange={() => toggle("assignees", "none")}
          >
            Sem responsável
          </DropdownMenuCheckboxItem>
          {members.map((m) => (
            <DropdownMenuCheckboxItem
              key={m.id}
              checked={filters.assignees.includes(m.id)}
              onCheckedChange={() => toggle("assignees", m.id)}
            >
              <span className="flex items-center gap-2">
                <UserAvatar user={m} showTooltip={false} className="size-4" />
                {m.name}
              </span>
            </DropdownMenuCheckboxItem>
          ))}

          <DropdownMenuSeparator />
          <DropdownMenuLabel>Prioridade</DropdownMenuLabel>
          {[...PRIORITIES].reverse().map((p) => (
            <DropdownMenuCheckboxItem
              key={p}
              checked={filters.priorities.includes(p)}
              onCheckedChange={() => toggle("priorities", p)}
            >
              <PriorityFlag priority={p} withLabel />
            </DropdownMenuCheckboxItem>
          ))}

          {tags.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Etiquetas</DropdownMenuLabel>
              {tags.map((t) => (
                <DropdownMenuCheckboxItem
                  key={t.id}
                  checked={filters.tags.includes(t.id)}
                  onCheckedChange={() => toggle("tags", t.id)}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: t.color }}
                    />
                    {t.name}
                  </span>
                </DropdownMenuCheckboxItem>
              ))}
            </>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem
            checked={filters.showDone}
            onCheckedChange={(v) => set("showDone", !!v)}
          >
            Mostrar concluídas
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {showGrouping && (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="h-8" />}>
              <SlidersHorizontal className="size-3.5" />
              {groupLabel(filters.groupBy)}
            </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuLabel>Agrupar por</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={filters.groupBy}
              onValueChange={(v) => set("groupBy", v as GroupBy)}
            >
              {(["status", "assignee", "priority", "sprint", "none"] as const).map(
                (g) => (
                  <DropdownMenuRadioItem key={g} value={g}>
                    {groupLabel(g)}
                  </DropdownMenuRadioItem>
                ),
              )}
            </DropdownMenuRadioGroup>

            <DropdownMenuSeparator />
            <DropdownMenuLabel>Ordenar por</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={filters.sortBy}
              onValueChange={(v) => set("sortBy", v as SortBy)}
            >
              {(
                [
                  ["manual", "Manual"],
                  ["priority", "Prioridade"],
                  ["dueDate", "Prazo"],
                  ["created", "Criação"],
                  ["title", "Título"],
                ] as const
              ).map(([value, label]) => (
                <DropdownMenuRadioItem key={value} value={value}>
                  {label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {activeCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-muted-foreground"
          onClick={reset}
        >
          <X className="size-3.5" />
          Limpar
        </Button>
      )}

      <div className={cn("ml-auto flex items-center gap-2")}>{extra}</div>
    </div>
  );
}

function groupLabel(g: GroupBy) {
  return {
    status: "Agrupar: Status",
    assignee: "Agrupar: Responsável",
    priority: "Agrupar: Prioridade",
    sprint: "Agrupar: Sprint",
    none: "Sem agrupamento",
  }[g];
}

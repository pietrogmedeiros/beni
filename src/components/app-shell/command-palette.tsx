"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  FolderKanban,
  GanttChartSquare,
  Home,
  Inbox,
  KanbanSquare,
  Layers,
  List,
  PieChart,
  Plus,
  Settings,
} from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { DynamicIcon } from "@/components/dynamic-icon";
import { StatusDot } from "@/components/task/task-badges";
import { searchAction } from "@/server/actions/search";
import type { TaskDTO } from "@/server/queries";
import type { WorkspaceProject } from "@/components/app-shell/app-context";

const VIEW_ICON: Record<string, React.ElementType> = {
  list: List,
  board: KanbanSquare,
  gantt: GanttChartSquare,
  backlog: Layers,
  calendar: CalendarDays,
  dashboard: PieChart,
};

export function CommandPalette({
  open,
  onOpenChange,
  projects,
  onNewTask,
  onNewProject,
  onOpenTask,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: WorkspaceProject[];
  onNewTask: () => void;
  onNewProject: () => void;
  onOpenTask: (id: string) => void;
}) {
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<TaskDTO[]>([]);
  const [, startTransition] = useTransition();

  useEffect(() => {
    // sincronização com fonte externa (URL, localStorage, servidor) — intencional
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!open) setTerm("");
  }, [open]);

  // busca com debounce contra o servidor — sincronização externa
  useEffect(() => {
    if (term.trim().length < 2) {
      // sincronização com fonte externa (URL, localStorage, servidor) — intencional
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      startTransition(async () => {
        setResults(await searchAction(term));
      });
    }, 180);
    return () => clearTimeout(t);
  }, [term]);

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Buscar"
      description="Busque tarefas, projetos e ações"
    >
      <Command shouldFilter={term.trim().length < 2} className="p-0">
      <CommandInput
        placeholder="Buscar tarefas, projetos ou ações…"
        value={term}
        onValueChange={setTerm}
      />
      <CommandList className="max-h-[420px]">
        <CommandEmpty>Nada encontrado.</CommandEmpty>

        {results.length > 0 && (
          <CommandGroup heading="Tarefas">
            {results.map((t) => (
              <CommandItem
                key={t.id}
                value={`${t.projectKey}-${t.number} ${t.title}`}
                onSelect={() => {
                  onOpenChange(false);
                  onOpenTask(t.id);
                }}
              >
                <StatusDot color={t.statusColor} />
                <span className="flex-1 truncate">{t.title}</span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {t.projectKey}-{t.number}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandGroup heading="Ações">
          <CommandItem
            onSelect={() => {
              onOpenChange(false);
              onNewTask();
            }}
          >
            <Plus className="size-4" />
            Nova tarefa
          </CommandItem>
          <CommandItem
            onSelect={() => {
              onOpenChange(false);
              onNewProject();
            }}
          >
            <FolderKanban className="size-4" />
            Novo projeto
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Navegar">
          <CommandItem onSelect={() => go("/")}>
            <Home className="size-4" />
            Início
          </CommandItem>
          <CommandItem onSelect={() => go("/my-tasks")}>
            <Inbox className="size-4" />
            Minhas tarefas
          </CommandItem>
          <CommandItem onSelect={() => go("/projects")}>
            <FolderKanban className="size-4" />
            Todos os projetos
          </CommandItem>
          <CommandItem onSelect={() => go("/settings")}>
            <Settings className="size-4" />
            Configurações
          </CommandItem>
        </CommandGroup>

        {projects.map((project) => (
          <CommandGroup key={project.id} heading={project.name}>
            {["board", "list", "gantt", "backlog", "calendar", "dashboard"].map(
              (view) => {
                const Icon = VIEW_ICON[view];
                return (
                  <CommandItem
                    key={view}
                    value={`${project.name} ${view}`}
                    onSelect={() => go(`/p/${project.id}/${view}`)}
                  >
                    <DynamicIcon
                      name={project.icon}
                      className="size-3.5"
                      style={{ color: project.color }}
                    />
                    <span className="flex-1">
                      {project.name} · {labelFor(view)}
                    </span>
                    <Icon className="size-3.5 opacity-50" />
                  </CommandItem>
                );
              },
            )}
          </CommandGroup>
        ))}
      </CommandList>
      </Command>
    </CommandDialog>
  );
}

function labelFor(view: string) {
  return (
    {
      list: "Lista",
      board: "Quadro",
      gantt: "Gantt",
      backlog: "Backlog",
      calendar: "Calendário",
      dashboard: "Painel",
    }[view] ?? view
  );
}

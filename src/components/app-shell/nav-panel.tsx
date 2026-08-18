"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  ChevronDown,
  ChevronRight,
  FolderKanban,
  Hash,
  Inbox,
  Lock,
  Megaphone,
  MessageSquare,
  MessageSquareHeart,
  MoreHorizontal,
  PanelLeftClose,
  PieChart,
  Plus,
  Settings,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DynamicIcon } from "@/components/dynamic-icon";
import { UserMenu } from "@/components/app-shell/user-menu";
import { sectionForPath } from "@/components/app-shell/icon-rail";
import { listChannels, type ChannelSummary } from "@/server/actions/chat";
import { PROJECT_VIEWS, PROJECT_VIEW_COBRANCAS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useChatStream } from "@/lib/chat-stream";
import type { UserDTO } from "@/server/queries";

type ProjectItem = {
  id: string;
  name: string;
  key: string;
  color: string;
  icon: string;
  taskCount: number;
};

const SECTION_TITLE: Record<string, string> = {
  inicio: "Início",
  tarefas: "Minhas tarefas",
  projetos: "Projetos",
  chat: "Conversas",
  paineis: "Painéis",
  config: "Configurações",
};

/**
 * Painel de segundo nível. O título acompanha a seção escolhida no trilho de
 * ícones, e abaixo vêm os atalhos, a árvore de projetos e os canais — como o
 * painel de "Espaços" do ClickUp.
 */
export function NavPanel({
  user,
  projects,
  onNewProject,
  onNewTask,
  onNavigate,
  onCollapse,
  onFeedback,
  podeTriar,
}: {
  user: UserDTO;
  projects: ProjectItem[];
  onNewProject: () => void;
  onNewTask: (defaults?: { projectId?: string }) => void;
  onNavigate?: () => void;
  onCollapse?: () => void;
  onFeedback: () => void;
  podeTriar?: boolean;
}) {
  const pathname = usePathname();
  const section = sectionForPath(pathname);
  const [channels, setChannels] = useState<ChannelSummary[]>([]);

  useEffect(() => {
    let alive = true;
    listChannels().then((c) => alive && setChannels(c));
    return () => {
      alive = false;
    };
  }, []);

  useChatStream(() => {
    listChannels().then(setChannels);
  });

  return (
    <aside className="flex h-full w-[268px] shrink-0 flex-col border-r bg-sidebar/60">
      {/* cabeçalho da seção */}
      <div className="flex h-14 items-center gap-2 px-4">
        <h1 className="min-w-0 flex-1 truncate text-xl font-semibold tracking-tight">
          {SECTION_TITLE[section]}
        </h1>
        <div className="flex items-center rounded-lg border bg-background">
          <button
            type="button"
            onClick={onNewProject}
            className="flex size-7 items-center justify-center rounded-l-lg transition hover:bg-accent"
            aria-label="Criar"
          >
            <Plus className="size-4" />
          </button>
          <span className="h-4 w-px bg-border" />
          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex size-6 items-center justify-center rounded-r-lg text-muted-foreground transition hover:bg-accent"
              aria-label="Mais opções de criação"
            >
              <ChevronDown className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => onNewTask()}>
                <Plus className="size-4" />
                Nova tarefa
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onNewProject}>
                <FolderKanban className="size-4" />
                Novo projeto
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/chat?new=1" />}>
                <Hash className="size-4" />
                Novo canal
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {onCollapse && (
          <Button
            variant="ghost"
            size="icon"
            className="hidden size-7 text-muted-foreground lg:inline-flex"
            onClick={onCollapse}
            aria-label="Recolher painel"
          >
            <PanelLeftClose className="size-4" />
          </Button>
        )}
      </div>

      <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {/* atalhos */}
        <PanelLink
          href="/my-tasks"
          icon={<Inbox className="size-4" />}
          label="Minhas tarefas"
          active={pathname.startsWith("/my-tasks")}
          onNavigate={onNavigate}
        />
        <PanelLink
          href="/chat"
          icon={<MessageSquare className="size-4" />}
          label="Conversas"
          active={pathname.startsWith("/chat")}
          onNavigate={onNavigate}
        />
        <PanelLink
          href="/projects"
          icon={<FolderKanban className="size-4" />}
          label="Todos os projetos"
          active={pathname === "/projects"}
          onNavigate={onNavigate}
        />
        <PanelLink
          href="/settings"
          icon={<Settings className="size-4" />}
          label="Configurações"
          active={pathname.startsWith("/settings")}
          onNavigate={onNavigate}
        />
        {podeTriar && (
          <>
            <PanelLink
              href="/feedback"
              icon={<Megaphone className="size-4" />}
              label="Feedback recebido"
              active={pathname.startsWith("/feedback")}
              onNavigate={onNavigate}
            />
            <PanelLink
              href="/telemetria"
              icon={<BarChart3 className="size-4" />}
              label="Telemetria"
              active={pathname.startsWith("/telemetria")}
              onNavigate={onNavigate}
            />
          </>
        )}
        {/* abre diálogo em vez de navegar: o recado é sobre a tela em que a
            pessoa está, e sair dela para contar já perde metade do contexto */}
        <button
          type="button"
          onClick={() => {
            onNavigate?.();
            onFeedback();
          }}
          className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] text-muted-foreground transition hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
        >
          <MessageSquareHeart className="size-4" />
          <span className="truncate">Dar feedback</span>
        </button>

        {/* projetos */}
        <SectionHeader label="Espaços" onAdd={onNewProject} />
        {projects.length === 0 ? (
          <button
            type="button"
            onClick={onNewProject}
            className="w-full rounded-md border border-dashed px-3 py-4 text-xs text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
          >
            Criar primeiro projeto
          </button>
        ) : (
          projects.map((project) => (
            <ProjectNavItem
              key={project.id}
              project={project}
              pathname={pathname}
              onNavigate={onNavigate}
              onNewTask={onNewTask}
              mostrarCobrancas={podeTriar}
            />
          ))
        )}
        <button
          type="button"
          onClick={onNewProject}
          className="mt-0.5 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-muted-foreground transition hover:bg-sidebar-accent/60 hover:text-foreground"
        >
          <Plus className="size-3.5" />
          Novo espaço
        </button>

        {/* canais */}
        <SectionHeader label="Canais" />
        {channels
          .filter((c) => c.kind !== "DIRECT")
          .map((channel) => (
            <Link
              key={channel.id}
              href={`/chat?c=${channel.id}`}
              onClick={onNavigate}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-muted-foreground transition hover:bg-sidebar-accent/60 hover:text-foreground"
            >
              {channel.kind === "PRIVATE" ? (
                <Lock className="size-3.5 shrink-0" />
              ) : (
                <Hash className="size-3.5 shrink-0" />
              )}
              <span
                className={cn(
                  "min-w-0 flex-1 truncate",
                  channel.unread > 0 && "font-semibold text-foreground",
                )}
              >
                {channel.name}
              </span>
              {channel.unread > 0 && (
                <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                  {channel.unread}
                </span>
              )}
            </Link>
          ))}
        <Link
          href="/chat?new=1"
          onClick={onNavigate}
          className="mt-0.5 flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-muted-foreground transition hover:bg-sidebar-accent/60 hover:text-foreground"
        >
          <Plus className="size-3.5" />
          Adicionar canal
        </Link>
      </div>

      <div className="border-t p-2">
        <UserMenu user={user} collapsed={false} />
      </div>
    </aside>
  );
}

function SectionHeader({
  label,
  onAdd,
}: {
  label: string;
  onAdd?: () => void;
}) {
  return (
    <div className="mt-5 flex items-center justify-between px-2 pb-1">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="flex size-5 items-center justify-center rounded text-muted-foreground transition hover:bg-sidebar-accent"
          aria-label={`Adicionar em ${label}`}
        >
          <Plus className="size-3.5" />
        </button>
      )}
    </div>
  );
}

function PanelLink({
  href,
  icon,
  label,
  active,
  onNavigate,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition",
        active
          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
    </Link>
  );
}

function ProjectNavItem({
  project,
  pathname,
  onNavigate,
  onNewTask,
  mostrarCobrancas,
}: {
  project: ProjectItem;
  pathname: string;
  onNavigate?: () => void;
  onNewTask: (defaults?: { projectId?: string }) => void;
  /** Mesma regra da aba no cabeçalho: só quem administra enxerga. */
  mostrarCobrancas?: boolean;
}) {
  const isActive = pathname.startsWith(`/p/${project.id}`);
  const [open, setOpen] = useState(isActive);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mb-0.5">
      <div
        className={cn(
          "group flex items-center gap-1 rounded-md pr-1 transition",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "hover:bg-sidebar-accent/60",
        )}
      >
        <CollapsibleTrigger
          className="flex size-6 items-center justify-center text-muted-foreground"
          aria-label="Expandir projeto"
        >
          <ChevronRight
            className={cn("size-3.5 transition-transform", open && "rotate-90")}
          />
        </CollapsibleTrigger>

        <Link
          href={`/p/${project.id}/board`}
          onClick={onNavigate}
          // A barra lista todos os projetos, e cada um pré-carregado é uma ida
          // ao servidor no primeiro render de qualquer tela. As abas de visão
          // do projeto aberto continuam pré-carregando — ali o ganho paga.
          prefetch={false}
          className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-[13px]"
        >
          <span
            className="flex size-5 shrink-0 items-center justify-center rounded"
            style={{ backgroundColor: `${project.color}26` }}
          >
            <DynamicIcon
              name={project.icon}
              className="size-3"
              style={{ color: project.color }}
            />
          </span>
          <span className={cn("truncate", isActive && "font-medium")}>
            {project.name}
          </span>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition hover:bg-background group-hover:opacity-100 data-[popup-open]:opacity-100"
            aria-label={`Ações de ${project.name}`}
          >
            <MoreHorizontal className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuItem onClick={() => onNewTask({ projectId: project.id })}>
              <Plus className="size-4" />
              Nova tarefa
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href={`/p/${project.id}/dashboard`} />}>
              <PieChart className="size-4" />
              Painel do projeto
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href={`/p/${project.id}/settings`} />}>
              <Settings className="size-4" />
              Configurar projeto
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CollapsibleContent className="ml-[26px] mt-0.5 space-y-px border-l pl-2">
        {[
          ...PROJECT_VIEWS,
          ...(mostrarCobrancas ? [PROJECT_VIEW_COBRANCAS] : []),
        ].map((view) => {
          const href = `/p/${project.id}/${view.slug}`;
          const active = pathname === href;
          return (
            <Link
              key={view.slug}
              href={href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2 rounded px-2 py-1 text-[13px] transition",
                active
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
              )}
            >
              <DynamicIcon name={view.icon} className="size-3.5" />
              {view.label}
            </Link>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}

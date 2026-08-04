"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ChevronRight,
  FolderKanban,
  Home,
  Inbox,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BeniMark } from "@/components/logo";
import { DynamicIcon } from "@/components/dynamic-icon";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PROJECT_VIEWS } from "@/lib/constants";
import { UserMenu } from "@/components/app-shell/user-menu";
import { ChatNav } from "@/components/app-shell/chat-nav";
import type { UserDTO } from "@/server/queries";

type ProjectItem = {
  id: string;
  name: string;
  key: string;
  color: string;
  icon: string;
  taskCount: number;
};

export function Sidebar({
  user,
  workspace,
  projects,
  collapsed,
  onToggle,
  onOpenSearch,
  onNewProject,
  onNavigate,
}: {
  user: UserDTO;
  workspace: { id: string; name: string };
  projects: ProjectItem[];
  collapsed: boolean;
  onToggle: () => void;
  onOpenSearch: () => void;
  onNewProject: () => void;
  /** chamado ao clicar num link — usado para fechar a gaveta no mobile */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  const nav = [
    { href: "/", label: "Início", icon: Home },
    { href: "/my-tasks", label: "Minhas tarefas", icon: Inbox },
    { href: "/projects", label: "Projetos", icon: FolderKanban },
  ];

  return (
    <aside
      className={cn(
        "flex h-app shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground transition-[width] duration-200",
        collapsed ? "w-[68px]" : "w-[264px]",
      )}
    >
      {/* topo */}
      <div className="flex h-14 items-center gap-2 px-3">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <BeniMark className="size-8 shrink-0" />
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight">Beni</p>
              <p className="truncate text-[11px] leading-tight text-muted-foreground">
                {workspace.name}
              </p>
            </div>
          )}
        </Link>
        {!collapsed && (
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto hidden size-7 text-muted-foreground lg:inline-flex"
            onClick={onToggle}
            aria-label="Recolher menu"
          >
            <PanelLeftClose className="size-4" />
          </Button>
        )}
      </div>

      {collapsed && (
        <div className="flex justify-center pb-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground"
            onClick={onToggle}
            aria-label="Expandir menu"
          >
            <PanelLeftOpen className="size-4" />
          </Button>
        </div>
      )}

      {/* busca */}
      <div className="px-3 pb-2">
        <button
          type="button"
          onClick={onOpenSearch}
          className={cn(
            "flex w-full items-center gap-2 rounded-md border bg-background/60 px-2.5 py-1.5 text-sm text-muted-foreground transition hover:bg-background",
            collapsed && "justify-center px-0",
          )}
        >
          <Search className="size-4 shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Buscar…</span>
              <kbd className="rounded border bg-muted px-1 font-mono text-[10px]">
                ⌘K
              </kbd>
            </>
          )}
        </button>
      </div>

      {/* navegação */}
      <nav className="space-y-0.5 px-3">
        {nav.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <NavLink
              key={item.href}
              href={item.href}
              icon={<item.icon className="size-4 shrink-0" />}
              label={item.label}
              active={active}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          );
        })}
        <ChatNav collapsed={collapsed} />
      </nav>

      {/* projetos */}
      <div className="mt-4 flex min-h-0 flex-1 flex-col">
        {!collapsed && (
          <div className="flex items-center justify-between px-4 pb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Projetos
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-5 text-muted-foreground"
              onClick={onNewProject}
              aria-label="Novo projeto"
            >
              <Plus className="size-3.5" />
            </Button>
          </div>
        )}

        <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto px-3 pb-2">
          {projects.length === 0 && !collapsed && (
            <button
              type="button"
              onClick={onNewProject}
              className="w-full rounded-md border border-dashed px-3 py-4 text-xs text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
            >
              Criar primeiro projeto
            </button>
          )}

          {projects.map((project) => (
            <ProjectNavItem
              key={project.id}
              project={project}
              collapsed={collapsed}
              pathname={pathname}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      </div>

      {/* rodapé */}
      <div className="border-t p-2">
        <NavLink
          href="/settings"
          icon={<Settings className="size-4 shrink-0" />}
          label="Configurações"
          active={pathname.startsWith("/settings")}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
        <div className="mt-1">
          <UserMenu user={user} collapsed={collapsed} />
        </div>
      </div>
    </aside>
  );
}

function NavLink({
  href,
  icon,
  label,
  active,
  collapsed,
  onNavigate,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const content = (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition",
        active
          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
        collapsed && "justify-center px-0",
      )}
    >
      {icon}
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );

  if (!collapsed) return content;
  return (
    <Tooltip>
      <TooltipTrigger render={content} />
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

function ProjectNavItem({
  project,
  collapsed,
  pathname,
  onNavigate,
}: {
  project: ProjectItem;
  collapsed: boolean;
  pathname: string;
  onNavigate?: () => void;
}) {
  const isActive = pathname.startsWith(`/p/${project.id}`);
  const [open, setOpen] = useState(isActive);

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger render={<Link
            href={`/p/${project.id}/board`}
            className={cn(
              "mb-0.5 flex items-center justify-center rounded-md py-1.5 transition",
              isActive
                ? "bg-sidebar-accent"
                : "hover:bg-sidebar-accent/60",
            )} />}>
            <span
              className="flex size-6 items-center justify-center rounded-md"
              style={{ backgroundColor: `${project.color}22` }}
            >
              <DynamicIcon
                name={project.icon}
                className="size-3.5"
                style={{ color: project.color }}
              />
            </span>
          </TooltipTrigger>
        <TooltipContent side="right">{project.name}</TooltipContent>
      </Tooltip>
    );
  }

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
              className={cn(
                "size-3.5 transition-transform",
                open && "rotate-90",
              )}
            />
          </CollapsibleTrigger>

        <Link
          href={`/p/${project.id}/board`}
          onClick={onNavigate}
          className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-sm"
        >
          <span
            className="flex size-5 shrink-0 items-center justify-center rounded"
            style={{ backgroundColor: `${project.color}22` }}
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

        <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground opacity-0 transition group-hover:opacity-100">
          {project.taskCount}
        </span>
      </div>

      <CollapsibleContent className="ml-[26px] mt-0.5 space-y-px border-l pl-2">
        {PROJECT_VIEWS.map((view) => {
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

"use client";

import {
  Bell,
  ChevronDown,
  Clock,
  FileText,
  Plus,
  Search,
  Video,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, initials, readableOn } from "@/lib/utils";
import type { UserDTO } from "@/server/queries";

/**
 * Barra global no topo, no formato do ClickUp: seletor de workspace à
 * esquerda, busca no centro e utilitários à direita.
 *
 * No app de macOS ela também é a área de arraste da janela e reserva o espaço
 * dos botões de semáforo do sistema.
 */
export function TopBar({
  user,
  workspace,
  onOpenSearch,
  onNewTask,
  desktop,
}: {
  user: UserDTO;
  workspace: { name: string };
  onOpenSearch: () => void;
  onNewTask: () => void;
  desktop?: boolean;
}) {
  return (
    <header
      className={cn(
        "relative z-50 flex h-12 shrink-0 items-center gap-2 border-b bg-sidebar px-2",
        desktop && "pl-[84px]",
      )}
      style={desktop ? ({ WebkitAppRegion: "drag" } as React.CSSProperties) : undefined}
    >
      <div
        className="flex min-w-0 items-center gap-2"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <DropdownMenu>
          <DropdownMenuTrigger className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold transition hover:bg-sidebar-accent">
            <span
              className="flex size-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold"
              style={{
                backgroundColor: user.avatarColor,
                color: readableOn(user.avatarColor),
              }}
            >
              {initials(workspace.name)}
            </span>
            <span className="max-w-44 truncate">{workspace.name}</span>
            <ChevronDown className="size-3.5 shrink-0 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Workspace
            </DropdownMenuLabel>
            <DropdownMenuItem className="font-medium">
              <span
                className="flex size-5 items-center justify-center rounded text-[9px] font-bold"
                style={{
                  backgroundColor: user.avatarColor,
                  color: readableOn(user.avatarColor),
                }}
              >
                {initials(workspace.name)}
              </span>
              {workspace.name}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onNewTask}>
              <Plus className="size-4" />
              Nova tarefa
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* busca central */}
      <div
        className="mx-auto w-full max-w-xl px-2"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <button
          type="button"
          onClick={onOpenSearch}
          className="flex w-full items-center gap-2 rounded-lg border bg-background/70 px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-background"
        >
          <Search className="size-4 shrink-0" />
          <span className="flex-1 text-left">Pesquisar</span>
          <kbd className="rounded border bg-muted px-1 font-mono text-[10px]">⌘K</kbd>
        </button>
      </div>

      {/* utilitários */}
      <div
        className="flex shrink-0 items-center gap-0.5"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        {[
          { icon: Plus, label: "Criar", onClick: onNewTask },
          { icon: Clock, label: "Recentes" },
          { icon: FileText, label: "Documentos" },
          { icon: Video, label: "Gravar" },
          { icon: Bell, label: "Notificações" },
        ].map((item) => (
          <Tooltip key={item.label}>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground"
                  onClick={item.onClick}
                  aria-label={item.label}
                />
              }
            >
              <item.icon className="size-4" />
            </TooltipTrigger>
            <TooltipContent>{item.label}</TooltipContent>
          </Tooltip>
        ))}

        <Avatar className="ml-1 size-7">
          <AvatarFallback
            className="text-[10px] font-semibold"
            style={{
              backgroundColor: user.avatarColor,
              color: readableOn(user.avatarColor),
            }}
          >
            {initials(user.name)}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}

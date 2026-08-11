"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FolderKanban,
  Home,
  Inbox,
  MessageSquare,
  MoreHorizontal,
  PieChart,
  Settings,
  UserPlus,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BeniMark } from "@/components/logo";
import { cn } from "@/lib/utils";

export type RailSection =
  | "inicio"
  | "tarefas"
  | "projetos"
  | "chat"
  | "paineis"
  | "config";

const ITEMS: {
  id: RailSection;
  label: string;
  href: string;
  icon: React.ElementType;
}[] = [
  { id: "inicio", label: "Início", href: "/", icon: Home },
  { id: "tarefas", label: "Tarefas", href: "/my-tasks", icon: Inbox },
  { id: "projetos", label: "Projetos", href: "/projects", icon: FolderKanban },
  { id: "chat", label: "Chat", href: "/chat", icon: MessageSquare },
  { id: "paineis", label: "Painéis", href: "/dashboards", icon: PieChart },
  { id: "config", label: "Mais", href: "/settings", icon: MoreHorizontal },
];

export function sectionForPath(pathname: string): RailSection {
  if (pathname === "/") return "inicio";
  if (pathname.startsWith("/my-tasks")) return "tarefas";
  if (pathname.startsWith("/chat")) return "chat";
  if (pathname.startsWith("/dashboards")) return "paineis";
  if (pathname.startsWith("/settings")) return "config";
  return "projetos";
}

/**
 * Trilho de ícones à esquerda, no formato do ClickUp: ícone grande com
 * micro-rótulo embaixo. É a navegação de primeiro nível — o painel ao lado
 * mostra o conteúdo da seção escolhida.
 */
export function IconRail({
  unread,
  onNavigate,
  onInvite,
}: {
  unread: { unread: number; mentions: number };
  onNavigate?: () => void;
  onInvite: () => void;
}) {
  const pathname = usePathname();
  const active = sectionForPath(pathname);

  return (
    <nav className="flex h-full w-[68px] shrink-0 flex-col items-center gap-1 border-r bg-sidebar py-2">
      <Link
        href="/"
        onClick={onNavigate}
        className="mb-1 flex size-10 items-center justify-center"
        aria-label="Beni"
      >
        <BeniMark className="size-7" />
      </Link>

      {ITEMS.map((item) => {
        const isActive = active === item.id;
        const badge =
          item.id === "chat"
            ? unread.mentions > 0
              ? `${unread.mentions}`
              : unread.unread > 0
                ? `${unread.unread}`
                : null
            : null;

        return (
          <Tooltip key={item.id}>
            <TooltipTrigger
              render={
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "group relative flex w-[58px] flex-col items-center gap-1 rounded-lg px-1 py-1.5 transition",
                    isActive
                      ? "text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:text-sidebar-accent-foreground",
                  )}
                />
              }
            >
              <span
                className={cn(
                  "relative flex size-9 items-center justify-center rounded-[10px] transition",
                  isActive
                    ? "bg-primary/20 ring-1 ring-primary/40"
                    : "group-hover:bg-sidebar-accent",
                )}
              >
                <item.icon className="size-[18px]" />
                {badge && (
                  <span
                    className={cn(
                      "absolute -right-1 -top-1 min-w-4 rounded-full px-1 text-[9px] font-bold leading-4",
                      unread.mentions > 0
                        ? "bg-destructive text-white"
                        : "bg-primary text-primary-foreground",
                    )}
                  >
                    {badge}
                  </span>
                )}
              </span>
              <span className="max-w-full truncate text-[10px] leading-none">
                {item.label}
              </span>
            </TooltipTrigger>
            <TooltipContent side="right">{item.label}</TooltipContent>
          </Tooltip>
        );
      })}

      <div className="mt-auto flex flex-col items-center gap-1">
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={onInvite}
                className="flex w-[58px] flex-col items-center gap-1 rounded-lg px-1 py-1.5 text-muted-foreground transition hover:text-sidebar-accent-foreground"
              />
            }
          >
            <span className="flex size-9 items-center justify-center rounded-[10px] transition hover:bg-sidebar-accent">
              <UserPlus className="size-[18px]" />
            </span>
            <span className="text-[10px] leading-none">Convidar</span>
          </TooltipTrigger>
          <TooltipContent side="right">Convidar pessoas</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Link
                href="/settings"
                onClick={onNavigate}
                className="flex size-9 items-center justify-center rounded-[10px] text-muted-foreground transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              />
            }
          >
            <Settings className="size-[18px]" />
          </TooltipTrigger>
          <TooltipContent side="right">Configurações</TooltipContent>
        </Tooltip>
      </div>
    </nav>
  );
}

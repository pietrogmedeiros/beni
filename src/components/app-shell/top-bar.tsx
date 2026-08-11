"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  AtSign,
  Bell,
  CalendarClock,
  Check,
  ChevronDown,
  Clock,
  FolderKanban,
  Hash,
  ListPlus,
  Loader2,
  LogOut,
  Monitor,
  Moon,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sun,
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
import { RelativeTime } from "@/components/relative-time";
import { logoutAction } from "@/server/actions/auth";
import {
  markAllNotificationsRead,
  notifications,
  recentTasks,
  type NotificationItem,
  type RecentTask,
} from "@/server/actions/notifications";
import { cn, initials, readableOn } from "@/lib/utils";
import { withBase } from "@/lib/base-path";
import type { UserDTO } from "@/server/queries";

/**
 * Barra global no topo: seletor de workspace à esquerda, busca no centro e
 * utilitários à direita. Todo botão aqui executa uma ação real — nada é
 * decorativo.
 *
 * No app de macOS ela também é a área de arraste da janela e reserva o espaço
 * dos botões de semáforo do sistema.
 */
export function TopBar({
  user,
  workspace,
  onOpenSearch,
  onNewTask,
  onNewProject,
  onBulkCreate,
  onOpenTask,
  desktop,
}: {
  user: UserDTO;
  workspace: { name: string };
  onOpenSearch: () => void;
  onNewTask: () => void;
  onNewProject: () => void;
  onBulkCreate: () => void;
  onOpenTask: (id: string) => void;
  desktop?: boolean;
}) {
  const noDrag = { WebkitAppRegion: "no-drag" } as React.CSSProperties;

  return (
    <header
      className={cn(
        "relative z-50 flex h-12 shrink-0 items-center gap-2 border-b bg-sidebar px-2",
        desktop && "pl-[84px]",
      )}
      style={desktop ? ({ WebkitAppRegion: "drag" } as React.CSSProperties) : undefined}
    >
      <div className="flex min-w-0 items-center gap-2" style={noDrag}>
        <WorkspaceMenu
          user={user}
          workspace={workspace}
          onNewTask={onNewTask}
          onNewProject={onNewProject}
        />
      </div>

      <div className="mx-auto w-full max-w-xl px-2" style={noDrag}>
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

      <div className="flex shrink-0 items-center gap-0.5" style={noDrag}>
        <CreateMenu
          onNewTask={onNewTask}
          onNewProject={onNewProject}
          onBulkCreate={onBulkCreate}
        />
        <RecentMenu onOpenTask={onOpenTask} />
        <NotificationsMenu onOpenTask={onOpenTask} />
        <AccountMenu user={user} />
      </div>
    </header>
  );
}

function WorkspaceMenu({
  user,
  workspace,
  onNewTask,
  onNewProject,
}: {
  user: UserDTO;
  workspace: { name: string };
  onNewTask: () => void;
  onNewProject: () => void;
}) {
  return (
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
        <DropdownMenuItem render={<Link href="/settings" />}>
          <Settings className="size-4" />
          Configurar workspace
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/projects" />}>
          <FolderKanban className="size-4" />
          Todos os projetos
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onNewTask}>
          <Plus className="size-4" />
          Nova tarefa
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onNewProject}>
          <Plus className="size-4" />
          Novo projeto
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CreateMenu({
  onNewTask,
  onNewProject,
  onBulkCreate,
}: {
  onNewTask: () => void;
  onNewProject: () => void;
  onBulkCreate: () => void;
}) {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-sidebar-accent hover:text-foreground"
              aria-label="Criar"
            />
          }
        >
          <Plus className="size-4" />
        </TooltipTrigger>
        <TooltipContent>Criar</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={onNewTask}>
          <Plus className="size-4" />
          Nova tarefa
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onBulkCreate}>
          <ListPlus className="size-4" />
          Tarefas em massa
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onNewProject}>
          <FolderKanban className="size-4" />
          Novo projeto
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/chat" />}>
          <Hash className="size-4" />
          Novo canal
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RecentMenu({ onOpenTask }: { onOpenTask: (id: string) => void }) {
  const [items, setItems] = useState<RecentTask[] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    // busca no servidor ao abrir — sincronização externa, intencional
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(null);
    recentTasks().then(setItems);
  }, [open]);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-sidebar-accent hover:text-foreground"
              aria-label="Recentes"
            />
          }
        >
          <Clock className="size-4" />
        </TooltipTrigger>
        <TooltipContent>Recentes</TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Mexidas recentemente
        </DropdownMenuLabel>
        {items === null ? (
          <div className="flex justify-center py-4">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground">
            Nada por aqui ainda.
          </p>
        ) : (
          items.map((t) => (
            <DropdownMenuItem key={t.id} onClick={() => onOpenTask(t.id)}>
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: t.statusColor }}
              />
              <span className="min-w-0 flex-1 truncate">{t.title}</span>
              <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                {t.ref}
              </span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const NOTIFICATION_ICON = {
  mention: AtSign,
  approval: ShieldCheck,
  overdue: CalendarClock,
} as const;

function NotificationsMenu({ onOpenTask }: { onOpenTask: (id: string) => void }) {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    let alive = true;
    const load = () =>
      notifications().then((n) => {
        if (!alive) return;
        setItems(n);
        setCount(n.length);
      });
    load();

    const source = new EventSource(withBase("/api/chat/stream"));
    source.onmessage = () => load();
    return () => {
      alive = false;
      source.close();
    };
  }, []);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              className="relative flex size-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-sidebar-accent hover:text-foreground"
              aria-label="Notificações"
            />
          }
        >
          <Bell className="size-4" />
          {count > 0 && (
            <span className="absolute right-0.5 top-0.5 size-2 rounded-full bg-destructive" />
          )}
        </TooltipTrigger>
        <TooltipContent>Notificações</TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="end" className="w-96">
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Notificações
          </span>
          {count > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={() =>
                startTransition(async () => {
                  await markAllNotificationsRead();
                  setItems(await notifications());
                  setCount(0);
                  toast.success("Tudo marcado como lido");
                })
              }
            >
              <Check className="size-3" />
              Marcar tudo
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />

        {items === null ? (
          <div className="flex justify-center py-6">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            Nada pendente. Tudo em dia.
          </p>
        ) : (
          <div className="thin-scrollbar max-h-96 overflow-y-auto">
            {items.map((n) => {
              const Icon = NOTIFICATION_ICON[n.kind];
              return (
                <DropdownMenuItem
                  key={n.id}
                  className="items-start gap-2.5 py-2"
                  onClick={() => {
                    if (n.taskId) onOpenTask(n.taskId);
                    else if (n.href) router.push(n.href);
                  }}
                >
                  <Icon
                    className={cn(
                      "mt-0.5 size-4 shrink-0",
                      n.kind === "overdue" && "text-destructive",
                      n.kind === "approval" && "text-success",
                      n.kind === "mention" && "text-primary-strong",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{n.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {n.detail}
                    </p>
                    <RelativeTime
                      date={n.createdAt}
                      className="text-[10px] text-muted-foreground"
                    />
                  </div>
                </DropdownMenuItem>
              );
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AccountMenu({ user }: { user: UserDTO }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    // o tema só é conhecido no cliente
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="ml-1 rounded-full transition hover:opacity-80"
        aria-label="Sua conta"
      >
        <Avatar className="size-7">
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
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-medium">{user.name}</p>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem render={<Link href="/settings" />}>
          <Settings className="size-4" />
          Configurações
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Tema
        </DropdownMenuLabel>
        {(
          [
            { value: "light", label: "Claro", icon: Sun },
            { value: "dark", label: "Escuro", icon: Moon },
            { value: "system", label: "Sistema", icon: Monitor },
          ] as const
        ).map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => setTheme(option.value)}
            className={cn(mounted && theme === option.value && "bg-accent")}
          >
            <option.icon className="size-4" />
            {option.label}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={pending}
          onClick={() => startTransition(() => void logoutAction())}
        >
          <LogOut className="size-4" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Menu } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { TopBar } from "@/components/app-shell/top-bar";
import { IconRail, sectionForPath } from "@/components/app-shell/icon-rail";
import { NavPanel } from "@/components/app-shell/nav-panel";
import { CommandPalette } from "@/components/app-shell/command-palette";
import {
  AppProvider,
  type AppContextValue,
  type WorkspaceMember,
  type WorkspaceProject,
} from "@/components/app-shell/app-context";
import { NewProjectDialog } from "@/components/project/new-project-dialog";
import {
  NewTaskDialog,
  type NewTaskDefaults,
} from "@/components/task/new-task-dialog";
import { TaskSheet } from "@/components/task/task-sheet";
import { InviteDialog } from "@/components/app-shell/invite-dialog";
import { unreadTotals } from "@/server/actions/chat";
import { cn } from "@/lib/utils";
import type { UserDTO } from "@/server/queries";

const STORAGE_KEY = "beni:panel-collapsed";

export function AppShell({
  user,
  workspace,
  projects,
  members,
  tags,
  desktop,
  children,
}: {
  user: UserDTO;
  workspace: { id: string; name: string; slug: string };
  projects: WorkspaceProject[];
  members: WorkspaceMember[];
  tags: { id: string; name: string; color: string }[];
  desktop?: boolean;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [projectDialog, setProjectDialog] = useState(false);
  const [taskDialog, setTaskDialog] = useState<{
    open: boolean;
    defaults: NewTaskDefaults;
  }>({ open: false, defaults: {} });
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unread, setUnread] = useState({ unread: 0, mentions: 0 });
  const [inviteOpen, setInviteOpen] = useState(false);

  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // sincronização com fonte externa (localStorage) — intencional
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  // ?task=<id> abre o painel de detalhe (usado pelos links permanentes /t/<id>)
  useEffect(() => {
    const taskParam = searchParams.get("task");
    if (taskParam) {
      // sincronização com fonte externa (URL) — intencional
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpenTaskId(taskParam);
      router.replace(pathname);
    }
  }, [searchParams, pathname, router]);

  useEffect(() => {
    // fecha a gaveta ao navegar
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileOpen(false);
  }, [pathname]);

  // contador de não lidas do chat, alimentado pelo mesmo fluxo SSE
  useEffect(() => {
    let alive = true;
    const load = () => {
      unreadTotals().then((t) => alive && setUnread(t));
    };
    load();
    const source = new EventSource("/api/chat/stream");
    source.onmessage = () => load();
    return () => {
      alive = false;
      source.close();
    };
  }, []);

  const togglePanel = useCallback(() => {
    setCollapsed((c) => {
      localStorage.setItem(STORAGE_KEY, c ? "0" : "1");
      return !c;
    });
  }, []);

  const openNewTask = useCallback((defaults: NewTaskDefaults = {}) => {
    setTaskDialog({ open: true, defaults });
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
        return;
      }
      if (typing) return;
      if (e.key.toLowerCase() === "n" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        openNewTask();
      }
      if (e.key === "[" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        togglePanel();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openNewTask, togglePanel]);

  // no Chat, a própria tela já traz a lista de conversas — o painel genérico
  // seria uma terceira coluna redundante
  const hidePanel = sectionForPath(pathname) === "chat";

  const value: AppContextValue = {
    user,
    workspace,
    projects,
    members,
    tags,
    openSearch: () => setSearchOpen(true),
    openNewProject: () => setProjectDialog(true),
    openNewTask,
    openTask: (id) => setOpenTaskId(id),
  };

  return (
    <TooltipProvider delay={300}>
      <AppProvider value={value}>
        <div className="flex h-svh flex-col overflow-hidden">
          <TopBar
            user={user}
            workspace={workspace}
            onOpenSearch={() => setSearchOpen(true)}
            onNewTask={() => openNewTask()}
            onNewProject={() => setProjectDialog(true)}
            onOpenTask={(id) => setOpenTaskId(id)}
            desktop={desktop}
          />

          <div className="flex min-h-0 flex-1">
            {/* gaveta no mobile */}
            {mobileOpen && (
              <button
                type="button"
                aria-label="Fechar menu"
                className="fixed inset-0 z-40 bg-black/40 lg:hidden"
                onClick={() => setMobileOpen(false)}
              />
            )}

            <div
              className={cn(
                "fixed inset-y-0 left-0 z-50 flex transition-transform duration-200",
                "lg:relative lg:z-auto lg:translate-x-0 lg:transition-none",
                mobileOpen ? "translate-x-0" : "-translate-x-full",
              )}
            >
              <IconRail
                unread={unread}
                onNavigate={() => setMobileOpen(false)}
                onInvite={() => {
                  setMobileOpen(false);
                  setInviteOpen(true);
                }}
              />
              {(!collapsed || mobileOpen) && !hidePanel && (
                <NavPanel
                  user={user}
                  projects={projects}
                  onNewProject={() => {
                    setMobileOpen(false);
                    setProjectDialog(true);
                  }}
                  onNewTask={openNewTask}
                  onNavigate={() => setMobileOpen(false)}
                  onCollapse={togglePanel}
                />
              )}
            </div>

            <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
              {/* botão do menu em telas pequenas */}
              <div className="flex h-11 shrink-0 items-center border-b px-2 lg:hidden">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9"
                  onClick={() => setMobileOpen(true)}
                  aria-label="Abrir menu"
                >
                  <Menu className="size-5" />
                </Button>
              </div>
              {children}
            </main>
          </div>
        </div>

        <CommandPalette
          open={searchOpen}
          onOpenChange={setSearchOpen}
          projects={projects}
          onNewTask={() => openNewTask()}
          onNewProject={() => setProjectDialog(true)}
          onOpenTask={(id) => setOpenTaskId(id)}
        />

        <NewProjectDialog open={projectDialog} onOpenChange={setProjectDialog} />

        <NewTaskDialog
          open={taskDialog.open}
          defaults={taskDialog.defaults}
          onOpenChange={(open) => setTaskDialog((prev) => ({ ...prev, open }))}
        />

        <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />

        <TaskSheet taskId={openTaskId} onClose={() => setOpenTaskId(null)} />
      </AppProvider>
    </TooltipProvider>
  );
}

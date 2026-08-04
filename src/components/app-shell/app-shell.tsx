"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MobileTopBar } from "@/components/app-shell/mobile-topbar";
import { cn } from "@/lib/utils";
import { Sidebar } from "@/components/app-shell/sidebar";
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
import type { UserDTO } from "@/server/queries";

const STORAGE_KEY = "beni:sidebar-collapsed";

export function AppShell({
  user,
  workspace,
  projects,
  members,
  tags,
  children,
}: {
  user: UserDTO;
  workspace: { id: string; name: string; slug: string };
  projects: WorkspaceProject[];
  members: WorkspaceMember[];
  tags: { id: string; name: string; color: string }[];
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

  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  // lê a preferência salva só no cliente (evita divergência de hidratação)
  useEffect(() => {
    // sincronização com fonte externa (URL, localStorage, servidor) — intencional
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  // ?task=<id> abre o painel de detalhe (usado pelos links permanentes /t/<id>)
  useEffect(() => {
    const taskParam = searchParams.get("task");
    if (taskParam) {
      // sincronização com fonte externa (URL, localStorage, servidor) — intencional
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpenTaskId(taskParam);
      router.replace(pathname);
    }
  }, [searchParams, pathname, router]);

  // fecha a gaveta ao navegar para outra rota
  useEffect(() => {
    // sincronização com fonte externa (URL) — intencional
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileOpen(false);
  }, [pathname]);

  const toggleSidebar = useCallback(() => {
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
        toggleSidebar();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openNewTask, toggleSidebar]);

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
        <div className="flex h-app overflow-hidden">
          {/* fundo escuro da gaveta em telas pequenas */}
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
              "fixed inset-y-0 left-0 z-50 transition-transform duration-200",
              "lg:relative lg:z-auto lg:translate-x-0 lg:transition-none",
              mobileOpen ? "translate-x-0" : "-translate-x-full",
            )}
          >
            <Sidebar
              user={user}
              workspace={workspace}
              projects={projects}
              collapsed={collapsed && !mobileOpen}
              onToggle={toggleSidebar}
              onOpenSearch={() => {
                setMobileOpen(false);
                setSearchOpen(true);
              }}
              onNewProject={() => {
                setMobileOpen(false);
                setProjectDialog(true);
              }}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>

          <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <MobileTopBar
              onMenu={() => setMobileOpen(true)}
              onSearch={() => setSearchOpen(true)}
              onNewTask={() => openNewTask()}
            />
            {children}
          </main>
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
          onOpenChange={(open) =>
            setTaskDialog((prev) => ({ ...prev, open }))
          }
        />

        <TaskSheet taskId={openTaskId} onClose={() => setOpenTaskId(null)} />
      </AppProvider>
    </TooltipProvider>
  );
}

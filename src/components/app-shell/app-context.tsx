"use client";

import { createContext, useContext } from "react";
import type { SprintDTO, StatusDTO, UserDTO } from "@/server/queries";

export type WorkspaceProject = {
  id: string;
  name: string;
  key: string;
  color: string;
  icon: string;
  description: string | null;
  taskCount: number;
  statuses: StatusDTO[];
  sprints: SprintDTO[];
};

export type WorkspaceMember = UserDTO & { role: string };

export type AppContextValue = {
  user: UserDTO;
  workspace: { id: string; name: string; slug: string };
  projects: WorkspaceProject[];
  members: WorkspaceMember[];
  tags: { id: string; name: string; color: string }[];
  openSearch: () => void;
  openNewProject: () => void;
  openNewTask: (defaults?: {
    projectId?: string;
    statusId?: string;
    sprintId?: string | null;
    parentId?: string;
  }) => void;
  openTask: (taskId: string) => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({
  value,
  children,
}: {
  value: AppContextValue;
  children: React.ReactNode;
}) {
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp deve ser usado dentro de AppProvider");
  return ctx;
}

/**
 * Versão tolerante do `useApp`, para componentes que também rodam fora do app
 * autenticado — como o Gantt renderizado numa página pública compartilhada.
 */
export function useAppOptional() {
  return useContext(AppContext);
}

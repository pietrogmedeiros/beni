"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal, Plus, Settings2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DynamicIcon } from "@/components/dynamic-icon";
import { useApp } from "@/components/app-shell/app-context";
import { PROJECT_VIEWS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { deleteProject } from "@/server/actions/projects";
import type { SprintDTO, StatusDTO } from "@/server/queries";

export function ProjectHeader({
  project,
}: {
  project: {
    id: string;
    name: string;
    key: string;
    color: string;
    icon: string;
    description: string | null;
    statuses: StatusDTO[];
    sprints: SprintDTO[];
  };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { openNewTask } = useApp();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [, startTransition] = useTransition();

  return (
    <header className="shrink-0 border-b bg-background px-4">
      <div className="flex h-14 items-center gap-3">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${project.color}1f` }}
        >
          <DynamicIcon
            name={project.icon}
            className="size-4.5"
            style={{ color: project.color }}
          />
        </span>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-[15px] font-semibold leading-tight">
              {project.name}
            </h1>
            <span
              className="rounded px-1 py-px font-mono text-[10px] font-medium"
              style={{
                backgroundColor: `${project.color}1f`,
                color: project.color,
              }}
            >
              {project.key}
            </span>
          </div>
          {project.description && (
            <p className="truncate text-xs text-muted-foreground">
              {project.description}
            </p>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" onClick={() => openNewTask({ projectId: project.id })}>
            <Plus className="size-4" />
            Nova tarefa
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-8" />}>
                <MoreHorizontal className="size-4" />
              </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem render={<Link href={`/p/${project.id}/settings`} />}>
                  <Settings2 className="size-4" />
                  Configurar projeto
                </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="size-4" />
                Excluir projeto
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir “{project.name}”?</AlertDialogTitle>
                <AlertDialogDescription>
                  Todas as tarefas, sprints e comentários deste projeto serão
                  removidos permanentemente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() =>
                    startTransition(async () => {
                      await deleteProject(project.id);
                      toast.success("Projeto excluído");
                      router.push("/projects");
                    })
                  }
                >
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <nav className="flex items-center gap-0.5 overflow-x-auto no-scrollbar">
        {PROJECT_VIEWS.map((view) => {
          const href = `/p/${project.id}/${view.slug}`;
          const active = pathname === href;
          return (
            <Link
              key={view.slug}
              href={href}
              className={cn(
                "flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-[13px] font-medium transition",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <DynamicIcon name={view.icon} className="size-3.5" />
              {view.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

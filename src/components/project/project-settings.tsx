"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DynamicIcon } from "@/components/dynamic-icon";
import { GithubRepos, type ProjectRepo } from "@/components/project/github-repos";
import { ConvidadosCard } from "@/components/project/convidados-card";
import { TagChip } from "@/components/task/task-badges";
import {
  PALETTE,
  PROJECT_ICONS,
  STATUS_CATEGORIES,
  STATUS_CATEGORY_META,
  type StatusCategoryValue,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  createStatus,
  createTag,
  deleteStatus,
  deleteTag,
  reorderStatuses,
  updateProject,
  updateStatus,
} from "@/server/actions/projects";
import type { StatusDTO } from "@/server/queries";

export function ProjectSettings({
  project,
  tags,
}: {
  project: {
    id: string;
    name: string;
    key: string;
    color: string;
    icon: string;
    description: string | null;
    statuses: StatusDTO[];
    repositories: ProjectRepo[];
  };
  tags: { id: string; name: string; color: string }[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [color, setColor] = useState(project.color);
  const [icon, setIcon] = useState(project.icon);

  const [statuses, setStatuses] = useState(project.statuses);
  const [newStatus, setNewStatus] = useState("");
  const [newTag, setNewTag] = useState("");
  const [newTagColor, setNewTagColor] = useState(PALETTE[0]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  function saveProject(patch: Parameters<typeof updateProject>[1]) {
    startTransition(async () => {
      await updateProject(project.id, patch);
      router.refresh();
    });
  }

  function handleReorder(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = statuses.findIndex((s) => s.id === active.id);
    const to = statuses.findIndex((s) => s.id === over.id);
    const next = arrayMove(statuses, from, to);
    setStatuses(next);
    startTransition(async () => {
      await reorderStatuses(project.id, next.map((s) => s.id));
      router.refresh();
    });
  }

  return (
    <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        {/* identidade */}
        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold">Identidade do projeto</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Nome, descrição e aparência na barra lateral.
          </p>

          <div className="flex items-start gap-4">
            <span
              className="flex size-14 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${color}22` }}
            >
              <DynamicIcon name={icon} className="size-7" style={{ color }} />
            </span>

            <div className="flex-1 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="p-name">Nome</Label>
                <Input
                  id="p-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => name.trim() && name !== project.name && saveProject({ name })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-desc">Descrição</Label>
                <Textarea
                  id="p-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={() =>
                    description !== (project.description ?? "") &&
                    saveProject({ description: description || null })
                  }
                  className="min-h-16"
                />
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-1.5">
                {PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Cor ${c}`}
                    onClick={() => {
                      setColor(c);
                      saveProject({ color: c });
                    }}
                    className={cn(
                      "size-6 rounded-full ring-offset-2 ring-offset-background transition",
                      color === c && "ring-2 ring-foreground",
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Ícone</Label>
              <div className="flex flex-wrap gap-1.5">
                {PROJECT_ICONS.map((i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Ícone ${i}`}
                    onClick={() => {
                      setIcon(i);
                      saveProject({ icon: i });
                    }}
                    className={cn(
                      "flex size-8 items-center justify-center rounded-md border transition hover:bg-accent",
                      icon === i && "border-primary bg-primary/10 text-primary-strong",
                    )}
                  >
                    <DynamicIcon name={i} className="size-4" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* status */}
        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold">Fluxo de status</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            As colunas do quadro. Arraste para reordenar; a categoria define o
            comportamento (concluído marca a tarefa como finalizada).
          </p>

          <DndContext
            id="beni-statuses"
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleReorder}
          >
            <SortableContext
              items={statuses.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-1.5">
                {statuses.map((status) => (
                  <StatusRow
                    key={status.id}
                    status={status}
                    canDelete={statuses.length > 1}
                    onChange={(patch) => {
                      setStatuses((prev) =>
                        prev.map((s) =>
                          s.id === status.id ? { ...s, ...patch } : s,
                        ),
                      );
                      startTransition(async () => {
                        await updateStatus(status.id, patch);
                        router.refresh();
                      });
                    }}
                    onDelete={() =>
                      startTransition(async () => {
                        try {
                          await deleteStatus(status.id);
                          setStatuses((prev) =>
                            prev.filter((s) => s.id !== status.id),
                          );
                          router.refresh();
                        } catch (e) {
                          toast.error(
                            e instanceof Error ? e.message : "Erro ao excluir",
                          );
                        }
                      })
                    }
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <div className="mt-3 flex gap-2">
            <Input
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              placeholder="Nome do novo status"
              className="h-9"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newStatus.trim()) {
                  const nameValue = newStatus.trim();
                  setNewStatus("");
                  startTransition(async () => {
                    await createStatus(project.id, {
                      name: nameValue,
                      color: PALETTE[statuses.length % PALETTE.length],
                      category: "TODO",
                    });
                    router.refresh();
                  });
                }
              }}
            />
            <Button
              variant="outline"
              disabled={!newStatus.trim()}
              onClick={() => {
                const nameValue = newStatus.trim();
                setNewStatus("");
                startTransition(async () => {
                  await createStatus(project.id, {
                    name: nameValue,
                    color: PALETTE[statuses.length % PALETTE.length],
                    category: "TODO",
                  });
                  router.refresh();
                });
              }}
            >
              <Plus className="size-4" />
              Adicionar
            </Button>
          </div>
        </section>

        <ConvidadosCard projectId={project.id} />

        <GithubRepos
          projectId={project.id}
          repositories={project.repositories}
        />

        {/* etiquetas */}
        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold">Etiquetas do workspace</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Compartilhadas entre todos os projetos.
          </p>

          <div className="mb-3 flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span key={t.id} className="inline-flex items-center">
                <TagChip
                  name={t.name}
                  color={t.color}
                  onRemove={() =>
                    startTransition(async () => {
                      await deleteTag(t.id);
                      router.refresh();
                    })
                  }
                />
              </span>
            ))}
            {tags.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhuma etiqueta criada ainda.
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <div className="flex flex-wrap gap-1">
              {PALETTE.slice(0, 8).map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Cor ${c}`}
                  onClick={() => setNewTagColor(c)}
                  className={cn(
                    "size-6 rounded-full ring-offset-2 ring-offset-background transition",
                    newTagColor === c && "ring-2 ring-foreground",
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="Nova etiqueta"
              className="h-9 flex-1"
            />
            <Button
              variant="outline"
              disabled={!newTag.trim()}
              onClick={() => {
                const value = newTag.trim();
                setNewTag("");
                startTransition(async () => {
                  await createTag({ name: value, color: newTagColor });
                  router.refresh();
                });
              }}
            >
              <Plus className="size-4" />
              Criar
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}

function StatusRow({
  status,
  canDelete,
  onChange,
  onDelete,
}: {
  status: StatusDTO;
  canDelete: boolean;
  onChange: (patch: { name?: string; color?: string; category?: string }) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: status.id });
  const [name, setName] = useState(status.name);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className="flex items-center gap-2 rounded-lg border px-2 py-1.5"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab text-muted-foreground active:cursor-grabbing"
        aria-label="Reordenar status"
      >
        <GripVertical className="size-4" />
      </button>

      <label className="relative size-5 shrink-0 cursor-pointer">
        <span
          className="block size-5 rounded-full border"
          style={{ backgroundColor: status.color }}
        />
        <input
          type="color"
          value={status.color}
          onChange={(e) => onChange({ color: e.target.value })}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label="Cor do status"
        />
      </label>

      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name.trim() && name !== status.name && onChange({ name })}
        className="h-8 flex-1 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
      />

      <Select
        value={status.category}
        onValueChange={(v) => v && onChange({ category: v })}
        items={Object.fromEntries(
          STATUS_CATEGORIES.map((c) => [
            c,
            STATUS_CATEGORY_META[c as StatusCategoryValue].label,
          ]),
        )}
      >
        <SelectTrigger className="h-8 w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_CATEGORIES.map((c) => (
            <SelectItem key={c} value={c}>
              {STATUS_CATEGORY_META[c as StatusCategoryValue].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        variant="ghost"
        size="icon"
        className="size-8 text-muted-foreground hover:text-destructive"
        disabled={!canDelete}
        onClick={onDelete}
        aria-label="Excluir status"
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}

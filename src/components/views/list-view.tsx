"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  ChevronRight,
  GripVertical,
  ListChecks,
  MessageSquare,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { StatusDot, TagChip, TypeIcon } from "@/components/task/task-badges";
import {
  AssigneePicker,
  DatePicker,
  PriorityPicker,
  StatusPicker,
} from "@/components/task/pickers";
import {
  TaskFilterBar,
  applyFilters,
  useTaskFilters,
  type GroupBy,
} from "@/components/project/task-filters";
import { useApp } from "@/components/app-shell/app-context";
import {
  bulkDeleteTasks,
  bulkUpdateTasks,
  createTask,
  moveTask,
  toggleTaskDone,
  updateTask,
} from "@/server/actions/tasks";
import { cn } from "@/lib/utils";
import { PRIORITY_META } from "@/lib/constants";
import type { SprintDTO, StatusDTO, TaskDTO } from "@/server/queries";

type Group = {
  id: string;
  label: string;
  color?: string;
  items: TaskDTO[];
};

export function ListView({
  projectId,
  statuses,
  sprints,
  tasks: initialTasks,
}: {
  projectId: string;
  statuses: StatusDTO[];
  sprints: SprintDTO[];
  tasks: TaskDTO[];
}) {
  const { members, tags, openTask } = useApp();
  const router = useRouter();
  const { filters, set, toggle, reset } = useTaskFilters();
  const [tasks, setTasks] = useState(initialTasks);
  const [selected, setSelected] = useState<string[]>([]);
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const [syncKey, setSyncKey] = useState(initialTasks);
  if (syncKey !== initialTasks) {
    setSyncKey(initialTasks);
    setTasks(initialTasks);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const visible = useMemo(
    () => applyFilters(tasks.filter((t) => !t.parentId), filters),
    [tasks, filters],
  );

  const groups = useMemo(
    () => buildGroups(visible, filters.groupBy, statuses, sprints, members),
    [visible, filters.groupBy, statuses, sprints, members],
  );

  const activeTask = tasks.find((t) => t.id === activeId) ?? null;

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const group = groups.find((g) => g.items.some((t) => t.id === active.id));
    const targetGroup = groups.find((g) => g.items.some((t) => t.id === over.id));
    if (!group || !targetGroup) return;

    const list = targetGroup.items.filter((t) => t.id !== active.id);
    const overIndex = list.findIndex((t) => t.id === over.id);
    const insertAt = overIndex === -1 ? list.length : overIndex;
    const before = list[insertAt - 1]?.id ?? null;
    const after = list[insertAt]?.id ?? null;

    const statusId =
      filters.groupBy === "status" ? targetGroup.id : undefined;
    const sprintId =
      filters.groupBy === "sprint"
        ? targetGroup.id === "none"
          ? null
          : targetGroup.id
        : undefined;

    startTransition(async () => {
      await moveTask({
        taskId: String(active.id),
        statusId,
        sprintId,
        beforeId: before,
        afterId: after,
      });
      router.refresh();
    });
  }

  function patch(taskId: string, input: Parameters<typeof updateTask>[1]) {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, ...normalize(input, statuses, t) } : t)),
    );
    startTransition(async () => {
      await updateTask(taskId, input);
      router.refresh();
    });
  }

  const allVisibleIds = visible.map((t) => t.id);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-4">
        <TaskFilterBar
          filters={filters}
          set={set}
          toggle={toggle}
          reset={reset}
          members={members}
          tags={tags}
        />
      </div>

      {selected.length > 0 && (
        <div className="mx-4 mb-2 flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2 shadow-sm">
          <span className="text-sm font-medium">
            {selected.length} selecionada{selected.length > 1 ? "s" : ""}
          </span>
          <div className="w-40">
            <StatusPicker
              statuses={statuses}
              value=""
              onChange={(statusId) =>
                startTransition(async () => {
                  await bulkUpdateTasks(selected, { statusId });
                  setSelected([]);
                  router.refresh();
                })
              }
            />
          </div>
          <div className="w-44">
            <AssigneePicker
              members={members}
              value={null}
              onChange={(assigneeId) =>
                startTransition(async () => {
                  await bulkUpdateTasks(selected, { assigneeId });
                  setSelected([]);
                  router.refresh();
                })
              }
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() =>
              startTransition(async () => {
                await bulkDeleteTasks(selected);
                setSelected([]);
                router.refresh();
              })
            }
          >
            <Trash2 className="size-3.5" />
            Excluir
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => setSelected([])}
          >
            Cancelar
          </Button>
        </div>
      )}

      <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-8">
        <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background/95 px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground backdrop-blur">
          <Checkbox
            checked={
              allVisibleIds.length > 0 && selected.length === allVisibleIds.length
            }
            onCheckedChange={(v) => setSelected(v ? allVisibleIds : [])}
            aria-label="Selecionar todas"
          />
          <span className="flex-1 pl-1">Tarefa</span>
          <span className="hidden w-28 md:block">Status</span>
          <span className="hidden w-24 lg:block">Prazo</span>
          <span className="w-8 text-center">Pri</span>
          <span className="w-8" />
        </div>

        <DndContext
          id="beni-list"
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          {groups.map((group) => {
            const isCollapsed = collapsed.includes(group.id);
            return (
              <section key={group.id} className="mt-3">
                <button
                  type="button"
                  onClick={() =>
                    setCollapsed((c) =>
                      c.includes(group.id)
                        ? c.filter((g) => g !== group.id)
                        : [...c, group.id],
                    )
                  }
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition hover:bg-accent/50"
                >
                  <ChevronRight
                    className={cn(
                      "size-3.5 text-muted-foreground transition-transform",
                      !isCollapsed && "rotate-90",
                    )}
                  />
                  {group.color && <StatusDot color={group.color} />}
                  <span className="text-[13px] font-semibold">{group.label}</span>
                  <span className="rounded bg-muted px-1.5 text-[11px] tabular-nums text-muted-foreground">
                    {group.items.length}
                  </span>
                </button>

                {!isCollapsed && (
                  <div className="mt-0.5">
                    <SortableContext
                      items={group.items.map((t) => t.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {group.items.map((task) => (
                        <SortableRow
                          key={task.id}
                          task={task}
                          statuses={statuses}
                          members={members}
                          selected={selected.includes(task.id)}
                          selecionando={selected.length > 0}
                          dragging={activeId === task.id}
                          onSelect={(v) =>
                            setSelected((s) =>
                              v ? [...s, task.id] : s.filter((id) => id !== task.id),
                            )
                          }
                          onOpen={() => openTask(task.id)}
                          onPatch={(input) => patch(task.id, input)}
                          onToggleDone={() =>
                            startTransition(async () => {
                              await toggleTaskDone(task.id);
                              router.refresh();
                            })
                          }
                        />
                      ))}
                    </SortableContext>

                    <QuickAdd
                      projectId={projectId}
                      groupBy={filters.groupBy}
                      groupId={group.id}
                      statuses={statuses}
                      onCreated={() => router.refresh()}
                    />
                  </div>
                )}
              </section>
            );
          })}

          <DragOverlay>
            {activeTask && (
              <div className="rounded-md border bg-card px-2 py-2 text-sm shadow-lg">
                {activeTask.title}
              </div>
            )}
          </DragOverlay>
        </DndContext>

        {visible.length === 0 && (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Nenhuma tarefa corresponde aos filtros.
          </p>
        )}
      </div>
    </div>
  );
}

function SortableRow({
  task,
  statuses,
  members,
  selected,
  selecionando,
  dragging,
  onSelect,
  onOpen,
  onPatch,
  onToggleDone,
}: {
  task: TaskDTO;
  statuses: StatusDTO[];
  members: { id: string; name: string; email: string; avatarColor: string }[];
  selected: boolean;
  /** Já há alguma linha marcada — então todas mostram a caixa. */
  selecionando: boolean;
  dragging: boolean;
  onSelect: (checked: boolean) => void;
  onOpen: () => void;
  onPatch: (input: Parameters<typeof updateTask>[1]) => void;
  onToggleDone: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: task.id });
  const done = task.statusCategory === "DONE";

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "group/row group flex items-center gap-2 rounded-md border-b border-border/50 px-2 py-1.5 transition hover:bg-accent/40",
        selected && "bg-primary/5",
        dragging && "opacity-40",
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab text-muted-foreground opacity-0 transition group-hover:opacity-60 active:cursor-grabbing"
        aria-label="Reordenar"
      >
        <GripVertical className="size-3.5" />
      </button>

      {/* Em repouso a linha mostrava dois controles quase idênticos lado a
          lado — um quadrado para selecionar, um círculo para concluir — e as
          pessoas erravam qual era qual. A seleção só aparece quando é pedida:
          ao passar o mouse, ao focar pelo teclado, ou quando já há alguma
          linha marcada. Sobra um único controle redondo, que é "concluir". */}
      <Checkbox
        checked={selected}
        onCheckedChange={(v) => onSelect(!!v)}
        aria-label="Selecionar tarefa"
        className={cn(
          "transition-opacity",
          selected || selecionando
            ? "opacity-100"
            : "opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100",
        )}
      />

      <button
        type="button"
        onClick={onToggleDone}
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-full border-2 transition",
          done
            ? "border-success bg-success text-white"
            : "border-muted-foreground/40 hover:border-primary",
        )}
        aria-label={done ? "Reabrir tarefa" : "Concluir tarefa"}
      >
        {done && (
          <svg viewBox="0 0 12 12" className="size-2.5 fill-none stroke-current stroke-2">
            <path d="M2 6.5 4.5 9 10 3.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      <TypeIcon type={task.type} />

      <span className="hidden shrink-0 font-mono text-[10px] text-muted-foreground sm:block">
        {task.projectKey}-{task.number}
      </span>

      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "min-w-0 flex-1 truncate text-left text-[13px]",
          done && "text-muted-foreground line-through",
        )}
      >
        {task.title}
      </button>

      <div className="hidden items-center gap-1 xl:flex">
        {task.tags.slice(0, 2).map((t) => (
          <TagChip key={t.id} name={t.name} color={t.color} />
        ))}
      </div>

      {task.subtaskCount > 0 && (
        <span className="hidden items-center gap-1 text-[11px] text-muted-foreground lg:inline-flex">
          <ListChecks className="size-3" />
          {task.doneSubtaskCount}/{task.subtaskCount}
        </span>
      )}
      {task.commentCount > 0 && (
        <span className="hidden items-center gap-1 text-[11px] text-muted-foreground lg:inline-flex">
          <MessageSquare className="size-3" />
          {task.commentCount}
        </span>
      )}

      <div className="hidden w-28 shrink-0 md:block">
        <StatusPicker
          statuses={statuses}
          value={task.statusId}
          onChange={(statusId) => onPatch({ statusId })}
          compact
          className="px-1.5 py-1 text-xs"
        />
      </div>

      <div className="hidden w-24 shrink-0 lg:block">
        <DatePicker
          value={task.dueDate}
          onChange={(dueDate) => onPatch({ dueDate })}
          placeholder="—"
          compact
          className="px-1.5 py-1 text-xs"
        />
      </div>

      <div className="w-8 shrink-0 text-center">
        <PriorityPicker
          value={task.priority}
          onChange={(priority) => onPatch({ priority })}
          compact
          className="mx-auto"
        />
      </div>

      <div className="w-8 shrink-0">
        <AssigneePicker
          members={members}
          value={task.assignee?.id ?? null}
          onChange={(assigneeId) => onPatch({ assigneeId })}
          compact
          className="mx-auto"
        />
      </div>
    </div>
  );
}

function QuickAdd({
  projectId,
  groupBy,
  groupId,
  statuses,
  onCreated,
}: {
  projectId: string;
  groupBy: GroupBy;
  groupId: string;
  statuses: StatusDTO[];
  onCreated: () => void;
}) {
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    const title = value.trim();
    if (!title) return;
    setValue("");
    startTransition(async () => {
      await createTask({
        projectId,
        title,
        statusId:
          groupBy === "status" ? groupId : statuses[0]?.id ?? null,
        sprintId:
          groupBy === "sprint" ? (groupId === "none" ? null : groupId) : null,
        assigneeId:
          groupBy === "assignee" && groupId !== "none" ? groupId : null,
        priority: groupBy === "priority" ? groupId : undefined,
      });
      onCreated();
    });
  }

  return (
    <div className="flex items-center gap-2 px-2 py-1">
      <Plus className="size-3.5 text-muted-foreground" />
      <Input
        value={value}
        disabled={pending}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") setValue("");
        }}
        onBlur={submit}
        placeholder="Adicionar tarefa…"
        className="h-7 border-0 bg-transparent px-0 text-[13px] shadow-none focus-visible:ring-0"
      />
    </div>
  );
}

function normalize(
  input: Parameters<typeof updateTask>[1],
  statuses: StatusDTO[],
  task: TaskDTO,
): Partial<TaskDTO> {
  const patch: Partial<TaskDTO> = {};
  if (input.statusId) {
    const s = statuses.find((x) => x.id === input.statusId);
    if (s) {
      patch.statusId = s.id;
      patch.statusName = s.name;
      patch.statusColor = s.color;
      patch.statusCategory = s.category;
    }
  }
  if (input.priority !== undefined) patch.priority = input.priority as string;
  if (input.dueDate !== undefined) patch.dueDate = input.dueDate ?? null;
  if (input.assigneeId !== undefined) {
    patch.assignee = input.assigneeId === null ? null : task.assignee;
  }
  return patch;
}

function buildGroups(
  tasks: TaskDTO[],
  groupBy: GroupBy,
  statuses: StatusDTO[],
  sprints: SprintDTO[],
  members: { id: string; name: string }[],
): Group[] {
  if (groupBy === "none") {
    return [{ id: "all", label: "Todas as tarefas", items: tasks }];
  }

  if (groupBy === "status") {
    return statuses.map((s) => ({
      id: s.id,
      label: s.name,
      color: s.color,
      items: tasks.filter((t) => t.statusId === s.id),
    }));
  }

  if (groupBy === "sprint") {
    return [
      ...sprints.map((s) => ({
        id: s.id,
        label: s.name,
        items: tasks.filter((t) => t.sprintId === s.id),
      })),
      {
        id: "none",
        label: "Backlog",
        items: tasks.filter((t) => !t.sprintId),
      },
    ];
  }

  if (groupBy === "assignee") {
    return [
      ...members.map((m) => ({
        id: m.id,
        label: m.name,
        items: tasks.filter((t) => t.assignee?.id === m.id),
      })),
      {
        id: "none",
        label: "Sem responsável",
        items: tasks.filter((t) => !t.assignee),
      },
    ].filter((g) => g.items.length > 0);
  }

  // prioridade
  return (["URGENT", "HIGH", "MEDIUM", "LOW", "NONE"] as const).map((p) => ({
    id: p,
    label: PRIORITY_META[p].label,
    color: PRIORITY_META[p].color,
    items: tasks.filter((t) => t.priority === p),
  }));
}

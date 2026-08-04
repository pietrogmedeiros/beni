"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
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
import {
  CalendarRange,
  CheckCircle2,
  ChevronRight,
  GripVertical,
  MoreHorizontal,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/user-avatar";
import { PriorityFlag, StatusDot, TypeIcon } from "@/components/task/task-badges";
import { DatePicker } from "@/components/task/pickers";
import {
  TaskFilterBar,
  applyFilters,
  useTaskFilters,
} from "@/components/project/task-filters";
import { useApp } from "@/components/app-shell/app-context";
import { moveTask, createTask } from "@/server/actions/tasks";
import {
  completeSprint,
  createSprint,
  deleteSprint,
  startSprint,
} from "@/server/actions/sprints";
import { SPRINT_STATUS_META, type SprintStatusValue } from "@/lib/constants";
import { cn, formatDate } from "@/lib/utils";
import type { SprintDTO, StatusDTO, TaskDTO } from "@/server/queries";

export function BacklogView({
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
  const { members, tags, openTask, openNewTask } = useApp();
  const router = useRouter();
  const { filters, set, toggle, reset } = useTaskFilters({ groupBy: "none" });
  const [tasks, setTasks] = useState(initialTasks);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [sprintDialog, setSprintDialog] = useState(false);
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

  const buckets = useMemo(
    () => [
      ...sprints.map((sprint) => ({
        id: sprint.id,
        sprint,
        items: visible.filter((t) => t.sprintId === sprint.id),
      })),
      {
        id: "backlog",
        sprint: null,
        items: visible.filter((t) => !t.sprintId),
      },
    ],
    [sprints, visible],
  );

  const activeTask = tasks.find((t) => t.id === activeId) ?? null;

  function bucketOf(id: string) {
    if (id === "backlog" || sprints.some((s) => s.id === id)) return id;
    const task = tasks.find((t) => t.id === id);
    return task ? (task.sprintId ?? "backlog") : null;
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const target = bucketOf(String(over.id));
    if (!target) return;

    const list = (buckets.find((b) => b.id === target)?.items ?? []).filter(
      (t) => t.id !== String(active.id),
    );
    const overIndex = list.findIndex((t) => t.id === String(over.id));
    const insertAt = overIndex === -1 ? list.length : overIndex;

    const sprintId = target === "backlog" ? null : target;

    setTasks((prev) =>
      prev.map((t) => (t.id === String(active.id) ? { ...t, sprintId } : t)),
    );

    startTransition(async () => {
      await moveTask({
        taskId: String(active.id),
        sprintId,
        beforeId: list[insertAt - 1]?.id ?? null,
        afterId: list[insertAt]?.id ?? null,
      });
      router.refresh();
    });
  }

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
          showGrouping={false}
          extra={
            <Button size="sm" variant="outline" className="h-8" onClick={() => setSprintDialog(true)}>
              <Plus className="size-3.5" />
              Nova sprint
            </Button>
          }
        />
      </div>

      <DndContext
        id="beni-backlog"
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="thin-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-10 pt-1">
          {buckets.map((bucket) => (
            <SprintSection
              key={bucket.id}
              id={bucket.id}
              sprint={bucket.sprint}
              items={bucket.items}
              statuses={statuses}
              collapsed={collapsed.includes(bucket.id)}
              activeId={activeId}
              onToggleCollapse={() =>
                setCollapsed((c) =>
                  c.includes(bucket.id)
                    ? c.filter((x) => x !== bucket.id)
                    : [...c, bucket.id],
                )
              }
              onOpenTask={openTask}
              onAddTask={() =>
                openNewTask({
                  projectId,
                  sprintId: bucket.id === "backlog" ? null : bucket.id,
                })
              }
              onQuickAdd={(title) =>
                startTransition(async () => {
                  await createTask({
                    projectId,
                    title,
                    sprintId: bucket.id === "backlog" ? null : bucket.id,
                  });
                  router.refresh();
                })
              }
              onAction={(action) =>
                startTransition(async () => {
                  if (!bucket.sprint) return;
                  if (action === "start") await startSprint(bucket.sprint.id);
                  if (action === "complete") await completeSprint(bucket.sprint.id);
                  if (action === "delete") await deleteSprint(bucket.sprint.id);
                  toast.success("Sprint atualizada");
                  router.refresh();
                })
              }
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask && (
            <div className="rounded-md border bg-card px-3 py-2 text-sm shadow-lg">
              {activeTask.title}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <SprintDialog
        open={sprintDialog}
        onOpenChange={setSprintDialog}
        projectId={projectId}
        nextNumber={sprints.length + 1}
      />
    </div>
  );
}

function SprintSection({
  id,
  sprint,
  items,
  statuses,
  collapsed,
  activeId,
  onToggleCollapse,
  onOpenTask,
  onAddTask,
  onQuickAdd,
  onAction,
}: {
  id: string;
  sprint: SprintDTO | null;
  items: TaskDTO[];
  statuses: StatusDTO[];
  collapsed: boolean;
  activeId: string | null;
  onToggleCollapse: () => void;
  onOpenTask: (id: string) => void;
  onAddTask: () => void;
  onQuickAdd: (title: string) => void;
  onAction: (action: "start" | "complete" | "delete") => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const [quick, setQuick] = useState("");

  const points = items.reduce((s, t) => s + (t.points ?? 0), 0);
  const donePoints = items
    .filter((t) => t.statusCategory === "DONE")
    .reduce((s, t) => s + (t.points ?? 0), 0);
  const progress = points ? Math.round((donePoints / points) * 100) : 0;

  const meta = sprint
    ? SPRINT_STATUS_META[sprint.status as SprintStatusValue]
    : null;

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "rounded-xl border transition",
        isOver && "border-primary/60 bg-primary/5",
        sprint?.status === "ACTIVE" && "border-primary/40",
      )}
    >
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex items-center gap-2 text-left"
        >
          <ChevronRight
            className={cn(
              "size-4 text-muted-foreground transition-transform",
              !collapsed && "rotate-90",
            )}
          />
          <span className="text-sm font-semibold">
            {sprint ? sprint.name : "Backlog do produto"}
          </span>
        </button>

        {meta && (
          <span
            className={cn(
              "rounded border px-1.5 py-px text-[10px] font-medium",
              meta.className,
            )}
          >
            {meta.label}
          </span>
        )}

        {sprint?.startDate && (
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <CalendarRange className="size-3" />
            {formatDate(sprint.startDate)} – {formatDate(sprint.endDate)}
          </span>
        )}

        <span className="text-[11px] tabular-nums text-muted-foreground">
          {items.length} {items.length === 1 ? "item" : "itens"}
          {points > 0 && ` · ${donePoints}/${points} pts`}
        </span>

        {points > 0 && (
          <div className="flex w-28 items-center gap-2">
            <Progress value={progress} className="h-1.5" />
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {progress}%
            </span>
          </div>
        )}

        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onAddTask}>
            <Plus className="size-3.5" />
            Item
          </Button>

          {sprint && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="ghost" size="icon" className="size-7" />}
              >
                <MoreHorizontal className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {sprint.status !== "ACTIVE" && (
                  <DropdownMenuItem onClick={() => onAction("start")}>
                    <Play className="size-4" />
                    Iniciar sprint
                  </DropdownMenuItem>
                )}
                {sprint.status !== "COMPLETED" && (
                  <DropdownMenuItem onClick={() => onAction("complete")}>
                    <CheckCircle2 className="size-4" />
                    Concluir sprint
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => onAction("delete")}
                >
                  <Trash2 className="size-4" />
                  Excluir sprint
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {sprint?.goal && !collapsed && (
        <p className="border-t px-3 py-1.5 text-xs text-muted-foreground">
          🎯 {sprint.goal}
        </p>
      )}

      {!collapsed && (
        <div className="border-t p-1.5">
          <SortableContext
            items={items.map((t) => t.id)}
            strategy={verticalListSortingStrategy}
          >
            {items.map((task) => (
              <BacklogRow
                key={task.id}
                task={task}
                statuses={statuses}
                dragging={activeId === task.id}
                onClick={() => onOpenTask(task.id)}
              />
            ))}
          </SortableContext>

          {items.length === 0 && (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">
              Arraste itens para cá ou crie um novo.
            </p>
          )}

          <div className="flex items-center gap-2 px-2 py-1">
            <Plus className="size-3.5 text-muted-foreground" />
            <Input
              value={quick}
              onChange={(e) => setQuick(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && quick.trim()) {
                  onQuickAdd(quick.trim());
                  setQuick("");
                }
              }}
              placeholder="Adicionar item…"
              className="h-7 border-0 bg-transparent px-0 text-[13px] shadow-none focus-visible:ring-0"
            />
          </div>
        </div>
      )}
    </section>
  );
}

function BacklogRow({
  task,
  statuses,
  dragging,
  onClick,
}: {
  task: TaskDTO;
  statuses: StatusDTO[];
  dragging: boolean;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: task.id });
  const status = statuses.find((s) => s.id === task.statusId);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "group flex items-center gap-2 rounded-md px-2 py-1.5 transition hover:bg-accent/50",
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

      <TypeIcon type={task.type} />
      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
        {task.projectKey}-{task.number}
      </span>

      <button
        type="button"
        onClick={onClick}
        className={cn(
          "min-w-0 flex-1 truncate text-left text-[13px]",
          task.statusCategory === "DONE" && "text-muted-foreground line-through",
        )}
      >
        {task.title}
      </button>

      <PriorityFlag priority={task.priority} />

      {task.points != null && (
        <span className="rounded bg-muted px-1.5 text-[10px] font-medium tabular-nums">
          {task.points}
        </span>
      )}

      {status && (
        <span className="hidden items-center gap-1.5 text-[11px] text-muted-foreground sm:inline-flex">
          <StatusDot color={status.color} />
          {status.name}
        </span>
      )}

      <UserAvatar user={task.assignee} className="size-5" />
    </div>
  );
}

function SprintDialog({
  open,
  onOpenChange,
  projectId,
  nextNumber,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  nextNumber: number;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (v) {
          setName(`Sprint ${nextNumber}`);
          setGoal("");
          setStartDate(null);
          setEndDate(null);
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova sprint</DialogTitle>
          <DialogDescription>
            Defina o período e o objetivo do ciclo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="sprint-name">Nome</Label>
            <Input
              id="sprint-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`Sprint ${nextNumber}`}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sprint-goal">Objetivo</Label>
            <Textarea
              id="sprint-goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="O que queremos alcançar nesse ciclo?"
              className="min-h-16"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="px-2 text-xs text-muted-foreground">Início</Label>
              <DatePicker value={startDate} onChange={setStartDate} />
            </div>
            <div>
              <Label className="px-2 text-xs text-muted-foreground">Fim</Label>
              <DatePicker value={endDate} onChange={setEndDate} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await createSprint({
                  projectId,
                  name: name.trim() || `Sprint ${nextNumber}`,
                  goal: goal.trim() || null,
                  startDate,
                  endDate,
                });
                toast.success("Sprint criada");
                onOpenChange(false);
                router.refresh();
              })
            }
          >
            Criar sprint
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

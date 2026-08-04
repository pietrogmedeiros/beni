"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskCard } from "@/components/task/task-card";
import {
  TaskFilterBar,
  applyFilters,
  useTaskFilters,
} from "@/components/project/task-filters";
import { useApp } from "@/components/app-shell/app-context";
import { moveTask } from "@/server/actions/tasks";
import { cn } from "@/lib/utils";
import type { StatusDTO, TaskDTO } from "@/server/queries";

export function BoardView({
  projectId,
  statuses,
  tasks: initialTasks,
}: {
  projectId: string;
  statuses: StatusDTO[];
  tasks: TaskDTO[];
}) {
  const { members, tags, openTask, openNewTask } = useApp();
  const router = useRouter();
  const { filters, set, toggle, reset } = useTaskFilters();
  const [tasks, setTasks] = useState(initialTasks);
  const [activeId, setActiveId] = useState<string | null>(null);

  // mantém o estado local sincronizado quando o servidor devolve novos dados
  const [syncKey, setSyncKey] = useState(initialTasks);
  if (syncKey !== initialTasks) {
    setSyncKey(initialTasks);
    setTasks(initialTasks);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const visible = useMemo(
    () => applyFilters(tasks.filter((t) => !t.parentId), filters),
    [tasks, filters],
  );

  const columns = useMemo(
    () =>
      statuses.map((status) => ({
        status,
        items: visible.filter((t) => t.statusId === status.id),
      })),
    [statuses, visible],
  );

  const activeTask = tasks.find((t) => t.id === activeId) ?? null;

  function findColumnId(id: string) {
    if (statuses.some((s) => s.id === id)) return id;
    return tasks.find((t) => t.id === id)?.statusId ?? null;
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  /** Move o card entre colunas ainda durante o arraste (feedback imediato). */
  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeCol = findColumnId(String(active.id));
    const overCol = findColumnId(String(over.id));
    if (!activeCol || !overCol || activeCol === overCol) return;

    setTasks((prev) =>
      prev.map((t) =>
        t.id === String(active.id) ? { ...t, statusId: overCol } : t,
      ),
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const taskId = String(active.id);
    const targetStatusId = findColumnId(String(over.id));
    if (!targetStatusId) return;

    const column = tasks
      .filter((t) => t.statusId === targetStatusId && t.id !== taskId && !t.parentId)
      .sort((a, b) => a.order - b.order);

    const overIndex = column.findIndex((t) => t.id === String(over.id));
    const insertAt = overIndex === -1 ? column.length : overIndex;

    const before = column[insertAt - 1]?.id ?? null;
    const after = column[insertAt]?.id ?? null;

    const beforeOrder = column[insertAt - 1]?.order ?? null;
    const afterOrder = column[insertAt]?.order ?? null;
    const newOrder =
      beforeOrder == null && afterOrder == null
        ? 1000
        : beforeOrder == null
          ? (afterOrder as number) - 1000
          : afterOrder == null
            ? beforeOrder + 1000
            : (beforeOrder + afterOrder) / 2;

    const status = statuses.find((s) => s.id === targetStatusId);

    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              statusId: targetStatusId,
              statusName: status?.name ?? t.statusName,
              statusColor: status?.color ?? t.statusColor,
              statusCategory: status?.category ?? t.statusCategory,
              order: newOrder,
            }
          : t,
      ),
    );

    void moveTask({
      taskId,
      statusId: targetStatusId,
      beforeId: before,
      afterId: after,
    }).then(() => router.refresh());
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
        />
      </div>

      <DndContext
        id="beni-board"
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="thin-scrollbar flex min-h-0 flex-1 gap-3 overflow-x-auto px-4 pb-4 pt-1">
          {columns.map(({ status, items }) => (
            <BoardColumn
              key={status.id}
              status={status}
              items={items}
              activeId={activeId}
              onOpenTask={openTask}
              onAdd={() => openNewTask({ projectId, statusId: status.id })}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={{ duration: 180 }}>
          {activeTask && (
            <TaskCard task={activeTask} overlay className="w-[280px]" />
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function BoardColumn({
  status,
  items,
  activeId,
  onOpenTask,
  onAdd,
}: {
  status: StatusDTO;
  items: TaskDTO[];
  activeId: string | null;
  onOpenTask: (id: string) => void;
  onAdd: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id });
  const points = items.reduce((sum, t) => sum + (t.points ?? 0), 0);

  return (
    <div className="flex w-[292px] shrink-0 flex-col">
      <div className="mb-2 flex items-center gap-2 px-1">
        <span
          className="size-2.5 rounded-full"
          style={{ backgroundColor: status.color }}
        />
        <h3 className="text-[13px] font-semibold">{status.name}</h3>
        <span className="rounded bg-muted px-1.5 text-[11px] tabular-nums text-muted-foreground">
          {items.length}
        </span>
        {points > 0 && (
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {points} pts
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto size-6 text-muted-foreground"
          onClick={onAdd}
          aria-label={`Nova tarefa em ${status.name}`}
        >
          <Plus className="size-3.5" />
        </Button>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "thin-scrollbar flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto rounded-xl border border-dashed p-2 transition",
          isOver ? "border-primary/50 bg-primary/5" : "border-transparent bg-muted/40",
        )}
      >
        <SortableContext
          items={items.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {items.map((task) => (
            <SortableCard
              key={task.id}
              task={task}
              dragging={activeId === task.id}
              onClick={() => onOpenTask(task.id)}
            />
          ))}
        </SortableContext>

        {items.length === 0 && (
          <button
            type="button"
            onClick={onAdd}
            className="flex flex-1 items-center justify-center rounded-lg text-xs text-muted-foreground transition hover:text-foreground"
          >
            <Plus className="mr-1 size-3.5" />
            Adicionar tarefa
          </button>
        )}
      </div>
    </div>
  );
}

function SortableCard({
  task,
  dragging,
  onClick,
}: {
  task: TaskDTO;
  dragging: boolean;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: task.id });

  return (
    <TaskCard
      ref={setNodeRef}
      task={task}
      dragging={dragging}
      onClick={onClick}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
      }}
      {...attributes}
      {...listeners}
    />
  );
}

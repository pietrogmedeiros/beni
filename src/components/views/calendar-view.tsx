"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TypeIcon } from "@/components/task/task-badges";
import { UserAvatar } from "@/components/user-avatar";
import {
  TaskFilterBar,
  applyFilters,
  useTaskFilters,
} from "@/components/project/task-filters";
import { useApp } from "@/components/app-shell/app-context";
import { updateTask } from "@/server/actions/tasks";
import { cn } from "@/lib/utils";
import type { TaskDTO } from "@/server/queries";

const WEEKDAYS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

export function CalendarView({
  projectId,
  tasks: initialTasks,
}: {
  projectId: string;
  tasks: TaskDTO[];
}) {
  const { members, tags, openTask, openNewTask } = useApp();
  const router = useRouter();
  const { filters, set, toggle, reset } = useTaskFilters({ groupBy: "none" });
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [tasks, setTasks] = useState(initialTasks);
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

  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
      }),
    [month],
  );

  const visible = useMemo(
    () => applyFilters(tasks.filter((t) => !t.parentId), filters),
    [tasks, filters],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, TaskDTO[]>();
    for (const task of visible) {
      if (!task.dueDate) continue;
      const key = format(new Date(task.dueDate), "yyyy-MM-dd");
      map.set(key, [...(map.get(key) ?? []), task]);
    }
    return map;
  }, [visible]);

  const undated = visible.filter((t) => !t.dueDate);
  const activeTask = tasks.find((t) => t.id === activeId) ?? null;

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const dayKey = String(over.id);
    const date = startOfDay(new Date(`${dayKey}T12:00:00`));
    const iso = date.toISOString();

    setTasks((prev) =>
      prev.map((t) => (t.id === String(active.id) ? { ...t, dueDate: iso } : t)),
    );

    startTransition(async () => {
      await updateTask(String(active.id), { dueDate: iso });
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
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => setMonth((m) => subMonths(m, 1))}
                aria-label="Mês anterior"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="w-36 text-center text-sm font-medium capitalize">
                {format(month, "MMMM yyyy", { locale: ptBR })}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => setMonth((m) => addMonths(m, 1))}
                aria-label="Próximo mês"
              >
                <ChevronRight className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => setMonth(startOfMonth(new Date()))}
              >
                Hoje
              </Button>
            </div>
          }
        />
      </div>

      <DndContext
        id="beni-calendar"
        sensors={sensors}
        onDragStart={(e) => setActiveId(String(e.active.id))}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
          <div className="grid grid-cols-7 border-b">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="py-1.5 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
              >
                {d}
              </div>
            ))}
          </div>

          <div className="thin-scrollbar grid min-h-0 flex-1 grid-cols-7 auto-rows-fr overflow-y-auto">
            {days.map((day) => (
              <DayCell
                key={day.toISOString()}
                day={day}
                month={month}
                tasks={byDay.get(format(day, "yyyy-MM-dd")) ?? []}
                onOpenTask={openTask}
                onAdd={() =>
                  openNewTask({ projectId })
                }
              />
            ))}
          </div>

          {undated.length > 0 && (
            <div className="mt-3 shrink-0 rounded-lg border bg-muted/30 p-2">
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Sem prazo ({undated.length}) — arraste para uma data
              </p>
              <div className="thin-scrollbar flex gap-1.5 overflow-x-auto pb-1">
                {undated.map((t) => (
                  <DraggableChip key={t.id} task={t} onClick={() => openTask(t.id)} />
                ))}
              </div>
            </div>
          )}
        </div>

        <DragOverlay>
          {activeTask && (
            <div className="rounded border bg-card px-2 py-1 text-xs shadow-lg">
              {activeTask.title}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function DayCell({
  day,
  month,
  tasks,
  onOpenTask,
  onAdd,
}: {
  day: Date;
  month: Date;
  tasks: TaskDTO[];
  onOpenTask: (id: string) => void;
  onAdd: () => void;
}) {
  const key = format(day, "yyyy-MM-dd");
  const { setNodeRef, isOver } = useDroppable({ id: key });
  const outside = !isSameMonth(day, month);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group min-h-24 border-b border-r p-1 transition",
        outside && "bg-muted/25",
        isOver && "bg-primary/10 ring-1 ring-inset ring-primary/40",
      )}
    >
      <div className="mb-1 flex items-center gap-1">
        <span
          className={cn(
            "flex size-5 items-center justify-center rounded-full text-[11px] tabular-nums",
            isToday(day) && "bg-primary font-semibold text-primary-foreground",
            outside && "text-muted-foreground",
          )}
        >
          {day.getDate()}
        </span>
        <button
          type="button"
          onClick={onAdd}
          className="ml-auto rounded p-0.5 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-accent"
          aria-label="Nova tarefa"
        >
          <Plus className="size-3" />
        </button>
      </div>

      <div className="space-y-0.5">
        {tasks.slice(0, 4).map((task) => (
          <DraggableChip
            key={task.id}
            task={task}
            onClick={() => onOpenTask(task.id)}
            block
          />
        ))}
        {tasks.length > 4 && (
          <p className="px-1 text-[10px] text-muted-foreground">
            +{tasks.length - 4} mais
          </p>
        )}
      </div>
    </div>
  );
}

function DraggableChip({
  task,
  onClick,
  block,
}: {
  task: TaskDTO;
  onClick: () => void;
  block?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
  });
  const done = task.statusCategory === "DONE";

  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 rounded px-1 py-0.5 text-left text-[11px] transition hover:brightness-95",
        block ? "w-full" : "shrink-0",
        isDragging && "opacity-40",
        done && "line-through opacity-60",
      )}
      style={{
        backgroundColor: `${task.statusColor}22`,
        borderLeft: `2px solid ${task.statusColor}`,
      }}
      title={task.title}
    >
      <TypeIcon type={task.type} />
      <span className="min-w-0 flex-1 truncate">{task.title}</span>
      {task.assignee && (
        <UserAvatar user={task.assignee} showTooltip={false} className="size-4" />
      )}
    </button>
  );
}

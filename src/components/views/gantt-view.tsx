"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  isWeekend,
  startOfDay,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { PriorityFlag, TypeIcon } from "@/components/task/task-badges";
import {
  TaskFilterBar,
  applyFilters,
  useTaskFilters,
} from "@/components/project/task-filters";
import { useAppOptional } from "@/components/app-shell/app-context";
import { rescheduleTask } from "@/server/actions/tasks";
import { cn } from "@/lib/utils";
import type { TaskDTO } from "@/server/queries";

const ROW_HEIGHT = 36;
const SIDEBAR_WIDTH = 300;

type Zoom = "day" | "week" | "month";
const DAY_WIDTH: Record<Zoom, number> = { day: 40, week: 18, month: 7 };

type DragState = {
  taskId: string;
  mode: "move" | "start" | "end";
  originX: number;
  startDate: Date;
  dueDate: Date;
  deltaDays: number;
};

export function GanttView({
  tasks: initialTasks,
  dependencies,
  readOnly = false,
  onOpenTask,
  toolbarExtra,
}: {
  tasks: TaskDTO[];
  dependencies: { taskId: string; dependsOnId: string }[];
  /** Modo público: sem arrastar, redimensionar ou salvar. */
  readOnly?: boolean;
  /** Sobrescreve o clique numa barra (usado na página compartilhada). */
  onOpenTask?: (taskId: string) => void;
  toolbarExtra?: React.ReactNode;
}) {
  const app = useAppOptional();
  const members = app?.members ?? [];
  const tags = app?.tags ?? [];
  const openTask = onOpenTask ?? app?.openTask ?? (() => {});

  /**
   * Etapas oferecidas no filtro, tiradas das próprias tarefas.
   *
   * O Gantt público não tem contexto do app, então não há de onde puxar a
   * lista do projeto. Derivar das tarefas resolve os dois casos com o mesmo
   * código e tem uma vantagem: nunca oferece uma etapa vazia, que só
   * devolveria lista em branco.
   *
   * A ordem segue o fluxo do quadro (do backlog ao concluído) e não a ordem
   * alfabética, porque é assim que a etapa é lida.
   */
  const etapas = useMemo(() => {
    const ordem = ["BACKLOG", "TODO", "IN_PROGRESS", "DONE", "CANCELED"];
    const vistas = new Map<string, { id: string; name: string; color: string; cat: string }>();
    for (const t of initialTasks) {
      if (t.statusId && !vistas.has(t.statusId)) {
        vistas.set(t.statusId, {
          id: t.statusId,
          name: t.statusName,
          color: t.statusColor,
          cat: t.statusCategory,
        });
      }
    }
    return [...vistas.values()].sort(
      (a, b) =>
        ordem.indexOf(a.cat) - ordem.indexOf(b.cat) || a.name.localeCompare(b.name),
    );
  }, [initialTasks]);
  const router = useRouter();
  const { filters, set, toggle, reset } = useTaskFilters({ groupBy: "none" });
  const [zoom, setZoom] = useState<Zoom>("week");
  const [tasks, setTasks] = useState(initialTasks);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [syncKey, setSyncKey] = useState(initialTasks);
  if (syncKey !== initialTasks) {
    setSyncKey(initialTasks);
    setTasks(initialTasks);
  }

  const dayWidth = DAY_WIDTH[zoom];

  const visible = useMemo(
    () => applyFilters(tasks.filter((t) => !t.parentId), filters),
    [tasks, filters],
  );

  const scheduled = visible.filter((t) => t.startDate || t.dueDate);
  const unscheduled = visible.filter((t) => !t.startDate && !t.dueDate);

  const { rangeStart, days } = useMemo(() => {
    const dates = scheduled.flatMap((t) =>
      [t.startDate, t.dueDate].filter(Boolean).map((d) => new Date(d as string)),
    );
    const today = startOfDay(new Date());
    const min = dates.length
      ? new Date(Math.min(...dates.map((d) => d.getTime())))
      : addDays(today, -14);
    const max = dates.length
      ? new Date(Math.max(...dates.map((d) => d.getTime())))
      : addDays(today, 30);

    const start = startOfWeek(addDays(min, -7), { weekStartsOn: 1 });
    const end = endOfWeek(addDays(max, 14), { weekStartsOn: 1 });
    return { rangeStart: start, days: eachDayOfInterval({ start, end }) };
  }, [scheduled]);

  const months = useMemo(() => {
    const result: { label: string; span: number }[] = [];
    for (const day of days) {
      const label = format(day, "MMMM yyyy", { locale: ptBR });
      const last = result[result.length - 1];
      if (last && last.label === label) last.span += 1;
      else result.push({ label, span: 1 });
    }
    return result;
  }, [days]);

  function xFor(date: Date) {
    return differenceInCalendarDays(startOfDay(date), rangeStart) * dayWidth;
  }

  function barGeometry(task: TaskDTO) {
    const start = task.startDate
      ? startOfDay(new Date(task.startDate))
      : startOfDay(new Date(task.dueDate as string));
    const end = task.dueDate
      ? startOfDay(new Date(task.dueDate))
      : startOfDay(new Date(task.startDate as string));
    const offset = drag?.taskId === task.id ? drag.deltaDays : 0;

    let s = start;
    let e = end;
    if (drag?.taskId === task.id) {
      if (drag.mode === "move") {
        s = addDays(start, offset);
        e = addDays(end, offset);
      } else if (drag.mode === "start") {
        s = addDays(start, offset);
        if (s > e) s = e;
      } else {
        e = addDays(end, offset);
        if (e < s) e = s;
      }
    }

    const left = xFor(s);
    const width = Math.max(
      dayWidth,
      (differenceInCalendarDays(e, s) + 1) * dayWidth,
    );
    return { left, width, start: s, end: e };
  }

  function onPointerDown(
    event: React.PointerEvent,
    task: TaskDTO,
    mode: DragState["mode"],
  ) {
    if (readOnly) return;
    event.preventDefault();
    event.stopPropagation();
    const start = task.startDate
      ? startOfDay(new Date(task.startDate))
      : startOfDay(new Date(task.dueDate as string));
    const end = task.dueDate
      ? startOfDay(new Date(task.dueDate))
      : startOfDay(new Date(task.startDate as string));

    setDrag({
      taskId: task.id,
      mode,
      originX: event.clientX,
      startDate: start,
      dueDate: end,
      deltaDays: 0,
    });

    const move = (e: PointerEvent) => {
      const delta = Math.round((e.clientX - event.clientX) / dayWidth);
      setDrag((d) => (d ? { ...d, deltaDays: delta } : d));
    };

    const up = (e: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const delta = Math.round((e.clientX - event.clientX) / dayWidth);
      setDrag(null);
      if (delta === 0) return;

      let newStart = start;
      let newEnd = end;
      if (mode === "move") {
        newStart = addDays(start, delta);
        newEnd = addDays(end, delta);
      } else if (mode === "start") {
        newStart = addDays(start, delta);
        if (newStart > end) newStart = end;
      } else {
        newEnd = addDays(end, delta);
        if (newEnd < start) newEnd = start;
      }

      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id
            ? {
                ...t,
                startDate: newStart.toISOString(),
                dueDate: newEnd.toISOString(),
              }
            : t,
        ),
      );

      startTransition(async () => {
        await rescheduleTask({
          taskId: task.id,
          startDate: newStart.toISOString(),
          dueDate: newEnd.toISOString(),
        });
        router.refresh();
      });
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const rowIndex = new Map(scheduled.map((t, i) => [t.id, i]));

  const links = dependencies
    .filter((d) => rowIndex.has(d.taskId) && rowIndex.has(d.dependsOnId))
    .map((d) => {
      const from = scheduled[rowIndex.get(d.dependsOnId)!];
      const to = scheduled[rowIndex.get(d.taskId)!];
      const a = barGeometry(from);
      const b = barGeometry(to);
      return {
        key: `${d.dependsOnId}-${d.taskId}`,
        x1: a.left + a.width,
        y1: rowIndex.get(d.dependsOnId)! * ROW_HEIGHT + ROW_HEIGHT / 2,
        x2: b.left,
        y2: rowIndex.get(d.taskId)! * ROW_HEIGHT + ROW_HEIGHT / 2,
      };
    });

  // ao abrir, posiciona a linha do tempo em "hoje"
  const centeredRef = useRef(false);
  useEffect(() => {
    if (centeredRef.current || !scrollRef.current || days.length === 0) return;
    centeredRef.current = true;
    scrollRef.current.scrollLeft = Math.max(
      0,
      SIDEBAR_WIDTH +
        differenceInCalendarDays(startOfDay(new Date()), rangeStart) * dayWidth -
        scrollRef.current.clientWidth / 2,
    );
  }, [days.length, rangeStart, dayWidth]);

  function scrollToToday() {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({
      left: Math.max(0, SIDEBAR_WIDTH + xFor(new Date()) - el.clientWidth / 2),
      behavior: "smooth",
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-4">
        <TaskFilterBar
          statuses={etapas}
          filters={filters}
          set={set}
          toggle={toggle}
          reset={reset}
          members={members}
          tags={tags}
          showGrouping={false}
          extra={
            <div className="flex items-center gap-1">
              {toolbarExtra}
              <Button variant="outline" size="sm" className="h-8" onClick={scrollToToday}>
                Hoje
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() =>
                  setZoom((z) => (z === "month" ? "week" : z === "week" ? "day" : "day"))
                }
                aria-label="Aproximar"
              >
                <ZoomIn className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() =>
                  setZoom((z) => (z === "day" ? "week" : z === "week" ? "month" : "month"))
                }
                aria-label="Afastar"
              >
                <ZoomOut className="size-4" />
              </Button>
            </div>
          }
        />
      </div>

      {/*
        Um único container de rolagem para a coluna de tarefas e a linha do
        tempo — assim a rolagem vertical nunca fica dessincronizada. A coluna
        de tarefas fica presa à esquerda com `sticky`.
      */}
      <div
        ref={scrollRef}
        className="thin-scrollbar relative min-h-0 flex-1 overflow-auto border-t"
      >
        <div className="flex" style={{ width: SIDEBAR_WIDTH + days.length * dayWidth }}>
          {/* coluna de tarefas */}
          <div
            className="sticky left-0 z-50 shrink-0 border-r bg-background"
            style={{ width: SIDEBAR_WIDTH }}
          >
            <div className="sticky top-0 z-10 flex h-[52px] items-end border-b bg-background px-3 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Tarefa
            </div>
            {scheduled.map((task) => (
              <button
                key={task.id}
                type="button"
                onClick={() => openTask(task.id)}
                className="flex w-full items-center gap-2 border-b border-border/50 px-3 text-left transition hover:bg-accent/40"
                style={{ height: ROW_HEIGHT }}
              >
                <TypeIcon type={task.type} />
                <span className="min-w-0 flex-1 truncate text-[13px]">
                  {task.title}
                </span>
                <PriorityFlag priority={task.priority} />
                <UserAvatar user={task.assignee} className="size-5" />
              </button>
            ))}
          </div>

          {/* timeline */}
          <div style={{ width: days.length * dayWidth }}>
            {/* cabeçalho de meses */}
            <div className="sticky top-0 z-40 bg-background">
              <div className="flex h-7 border-b">
                {months.map((m, i) => (
                  <div
                    key={`${m.label}-${i}`}
                    className="flex items-center border-r px-2 text-xs font-medium capitalize"
                    style={{ width: m.span * dayWidth }}
                  >
                    <span className="sticky left-2 truncate">{m.label}</span>
                  </div>
                ))}
              </div>
              <div className="flex h-[25px] border-b">
                {days.map((day) => (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "flex shrink-0 items-center justify-center border-r border-border/40 text-[10px]",
                      isWeekend(day) && "bg-muted/50",
                      isToday(day) && "bg-primary/20 font-semibold text-primary-strong",
                    )}
                    style={{ width: dayWidth }}
                  >
                    {zoom === "month"
                      ? day.getDate() === 1 || day.getDate() === 15
                        ? day.getDate()
                        : ""
                      : zoom === "week"
                        ? day.getDay() === 1
                          ? format(day, "d")
                          : ""
                        : format(day, "d")}
                  </div>
                ))}
              </div>
            </div>

            {/* grade + barras */}
            <div
              className="relative"
              style={{ height: Math.max(scheduled.length * ROW_HEIGHT, 200) }}
            >
              {/* colunas de fundo */}
              <div className="absolute inset-0 flex">
                {days.map((day) => (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "shrink-0 border-r border-border/30",
                      isWeekend(day) && "bg-muted/40",
                      !isSameMonth(day, endOfMonth(day)) && "",
                    )}
                    style={{ width: dayWidth }}
                  />
                ))}
              </div>

              {/* linha de hoje */}
              <div
                className="pointer-events-none absolute top-0 bottom-0 z-[5] w-px bg-primary-strong"
                style={{ left: xFor(new Date()) + dayWidth / 2 }}
              />

              {/* dependências */}
              <svg
                className="pointer-events-none absolute inset-0 z-10 overflow-visible"
                width="100%"
                height="100%"
              >
                <defs>
                  <marker
                    id="gantt-arrow"
                    markerWidth="6"
                    markerHeight="6"
                    refX="5"
                    refY="3"
                    orient="auto"
                  >
                    <path d="M0,0 L6,3 L0,6 Z" className="fill-muted-foreground" />
                  </marker>
                </defs>
                {links.map((l) => {
                  const midX = Math.max(l.x1 + 10, l.x2 - 10);
                  return (
                    <path
                      key={l.key}
                      d={`M ${l.x1} ${l.y1} H ${midX} V ${l.y2} H ${l.x2}`}
                      className="stroke-muted-foreground/60"
                      strokeWidth={1.2}
                      fill="none"
                      markerEnd="url(#gantt-arrow)"
                    />
                  );
                })}
              </svg>

              {/* barras */}
              {scheduled.map((task, index) => {
                const geo = barGeometry(task);
                const done = task.statusCategory === "DONE";
                return (
                  <div
                    key={task.id}
                    className="absolute z-20"
                    style={{
                      top: index * ROW_HEIGHT + 6,
                      left: geo.left,
                      width: geo.width,
                      height: ROW_HEIGHT - 12,
                    }}
                  >
                    <div
                      onPointerDown={(e) => onPointerDown(e, task, "move")}
                      onClick={() => !drag && openTask(task.id)}
                      className={cn(
                        "group relative flex h-full items-center overflow-hidden rounded-md px-2 text-[11px] font-medium text-white shadow-sm transition",
                        readOnly
                          ? "cursor-pointer"
                          : "cursor-grab active:cursor-grabbing",
                        done && "opacity-60",
                      )}
                      style={{ backgroundColor: task.statusColor }}
                      title={task.title}
                    >
                      {task.progress > 0 && (
                        <div
                          className="absolute inset-y-0 left-0 bg-black/20"
                          style={{ width: `${task.progress}%` }}
                        />
                      )}
                      <span className="relative truncate">{task.title}</span>

                      {!readOnly && (
                      <span
                        onPointerDown={(e) => onPointerDown(e, task, "start")}
                        className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize opacity-0 transition group-hover:bg-white/40 group-hover:opacity-100"
                      />
                      )}
                      {!readOnly && (
                      <span
                        onPointerDown={(e) => onPointerDown(e, task, "end")}
                        className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize opacity-0 transition group-hover:bg-white/40 group-hover:opacity-100"
                      />
                      )}
                    </div>
                  </div>
                );
              })}

              {scheduled.length === 0 && (
                <p className="absolute left-1/2 top-16 -translate-x-1/2 text-sm text-muted-foreground">
                  Nenhuma tarefa com datas definidas.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {unscheduled.length > 0 && (
        <div className="shrink-0 border-t bg-muted/30 px-4 py-2">
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Sem datas ({unscheduled.length}) — defina início e prazo para
            aparecerem na linha do tempo
          </p>
          <div className="thin-scrollbar flex gap-2 overflow-x-auto pb-1">
            {unscheduled.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => openTask(t.id)}
                className="flex shrink-0 items-center gap-1.5 rounded-md border bg-card px-2 py-1 text-xs transition hover:border-primary/50"
              >
                <TypeIcon type={t.type} />
                <span className="max-w-40 truncate">{t.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

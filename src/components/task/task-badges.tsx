"use client";

import {
  BookOpen,
  Bug,
  CheckSquare,
  ChevronsDown,
  ChevronsUp,
  ChevronUp,
  Equal,
  Minus,
  Wrench,
  Zap,
} from "lucide-react";
import {
  PRIORITY_META,
  TASK_TYPE_META,
  type PriorityValue,
  type TaskTypeValue,
} from "@/lib/constants";
import { cn, smartDate, isOverdue } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CalendarClock } from "lucide-react";

const PRIORITY_ICON = {
  URGENT: ChevronsUp,
  HIGH: ChevronUp,
  MEDIUM: Equal,
  LOW: ChevronsDown,
  NONE: Minus,
} as const;

export function PriorityFlag({
  priority,
  className,
  withLabel = false,
}: {
  priority: string;
  className?: string;
  withLabel?: boolean;
}) {
  const key = (priority in PRIORITY_META ? priority : "NONE") as PriorityValue;
  const meta = PRIORITY_META[key];
  const Icon = PRIORITY_ICON[key];

  const node = (
    <span className={cn("inline-flex items-center gap-1", meta.className, className)}>
      <Icon className="size-3.5" />
      {withLabel && <span className="text-xs font-medium">{meta.label}</span>}
    </span>
  );

  if (withLabel) return node;

  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />}>
        {node}
      </TooltipTrigger>
      <TooltipContent>Prioridade: {meta.label}</TooltipContent>
    </Tooltip>
  );
}

const TYPE_ICON = {
  TASK: CheckSquare,
  BUG: Bug,
  STORY: BookOpen,
  EPIC: Zap,
  CHORE: Wrench,
} as const;

export function TypeIcon({
  type,
  className,
}: {
  type: string;
  className?: string;
}) {
  const key = (type in TASK_TYPE_META ? type : "TASK") as TaskTypeValue;
  const meta = TASK_TYPE_META[key];
  const Icon = TYPE_ICON[key];
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />}>
        <Icon className={cn("size-3.5", className)} style={{ color: meta.color }} />
      </TooltipTrigger>
      <TooltipContent>{meta.label}</TooltipContent>
    </Tooltip>
  );
}

export function StatusDot({
  color,
  className,
}: {
  color: string;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-block size-2 shrink-0 rounded-full", className)}
      style={{ backgroundColor: color }}
    />
  );
}

export function StatusChip({
  name,
  color,
  className,
}: {
  name: string;
  color: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-xs font-medium",
        className,
      )}
      style={{
        borderColor: `${color}55`,
        backgroundColor: `${color}18`,
        color,
      }}
    >
      <StatusDot color={color} />
      {name}
    </span>
  );
}

export function TagChip({
  name,
  color,
  className,
  onRemove,
}: {
  name: string;
  color: string;
  className?: string;
  onRemove?: () => void;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        className,
      )}
      style={{ backgroundColor: `${color}22`, color }}
    >
      {name}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="opacity-60 transition hover:opacity-100"
          aria-label={`Remover ${name}`}
        >
          ×
        </button>
      )}
    </span>
  );
}

export function DueDate({
  date,
  done,
  className,
}: {
  date: string | null;
  done: boolean;
  className?: string;
}) {
  if (!date) return null;
  const late = isOverdue(date, done);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs",
        late ? "font-medium text-destructive" : "text-muted-foreground",
        className,
      )}
    >
      <CalendarClock className="size-3.5" />
      {smartDate(date)}
    </span>
  );
}

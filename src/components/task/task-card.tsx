"use client";

import { forwardRef } from "react";
import { MessageSquare, GitBranch, ListChecks, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/user-avatar";
import {
  DueDate,
  PriorityFlag,
  TagChip,
  TypeIcon,
} from "@/components/task/task-badges";
import type { TaskDTO } from "@/server/queries";

type Props = {
  task: TaskDTO;
  onClick?: () => void;
  dragging?: boolean;
  overlay?: boolean;
  className?: string;
  showProject?: boolean;
} & React.HTMLAttributes<HTMLDivElement>;

export const TaskCard = forwardRef<HTMLDivElement, Props>(function TaskCard(
  { task, onClick, dragging, overlay, className, showProject, ...rest },
  ref,
) {
  const done = task.statusCategory === "DONE";

  return (
    <div
      ref={ref}
      {...rest}
      className={cn(
        "group cursor-grab rounded-lg border bg-card p-2.5 shadow-xs transition active:cursor-grabbing",
        "hover:border-primary/40 hover:shadow-sm",
        dragging && "opacity-40",
        overlay && "rotate-2 cursor-grabbing shadow-lg",
        className,
      )}
      onClick={onClick}
    >
      <div className="mb-1.5 flex items-center gap-1.5">
        <TypeIcon type={task.type} />
        <span className="font-mono text-[10px] text-muted-foreground">
          {task.projectKey}-{task.number}
        </span>
        {showProject && (
          <span
            className="truncate rounded px-1 text-[10px] font-medium"
            style={{
              backgroundColor: `${task.projectColor}1f`,
              color: task.projectColor,
            }}
          >
            {task.projectName}
          </span>
        )}
        <div className="ml-auto">
          <PriorityFlag priority={task.priority} />
        </div>
      </div>

      <p
        className={cn(
          "line-clamp-3 text-[13px] font-medium leading-snug",
          done && "text-muted-foreground line-through",
        )}
      >
        {task.title}
      </p>

      {task.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.tags.slice(0, 3).map((t) => (
            <TagChip key={t.id} name={t.name} color={t.color} />
          ))}
        </div>
      )}

      {task.progress > 0 && task.progress < 100 && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${task.progress}%` }}
          />
        </div>
      )}

      <div className="mt-2 flex items-center gap-2.5 text-muted-foreground">
        <DueDate date={task.dueDate} done={done} />

        {task.subtaskCount > 0 && (
          <span className="inline-flex items-center gap-1 text-xs">
            <ListChecks className="size-3.5" />
            {task.doneSubtaskCount}/{task.subtaskCount}
          </span>
        )}
        {task.commentCount > 0 && (
          <span className="inline-flex items-center gap-1 text-xs">
            <MessageSquare className="size-3.5" />
            {task.commentCount}
          </span>
        )}
        {task.blockedByCount > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-warning">
            <Lock className="size-3.5" />
            {task.blockedByCount}
          </span>
        )}
        {task.points != null && (
          <span className="inline-flex items-center gap-1 rounded bg-muted px-1 text-[10px] font-medium tabular-nums">
            <GitBranch className="size-3" />
            {task.points}
          </span>
        )}

        <div className="ml-auto">
          <UserAvatar user={task.assignee} className="size-5" />
        </div>
      </div>
    </div>
  );
});

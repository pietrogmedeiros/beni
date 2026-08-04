"use client";

import { useState } from "react";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Check, ChevronDown, Tag as TagIcon, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { UserAvatar } from "@/components/user-avatar";
import { PriorityFlag, StatusDot, TagChip, TypeIcon } from "@/components/task/task-badges";
import {
  PRIORITIES,
  PRIORITY_META,
  TASK_TYPES,
  TASK_TYPE_META,
  type PriorityValue,
  type TaskTypeValue,
} from "@/lib/constants";
import { cn, formatDate } from "@/lib/utils";
import type { SprintDTO, StatusDTO, UserDTO } from "@/server/queries";

const triggerClass =
  "flex w-full items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-sm transition hover:bg-accent data-[state=open]:bg-accent";

export function StatusPicker({
  statuses,
  value,
  onChange,
  className,
  compact,
}: {
  statuses: StatusDTO[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const current = statuses.find((s) => s.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={cn(triggerClass, className)}>
          <StatusDot color={current?.color ?? "#94a3b8"} />
          <span className={cn("truncate", !current && "text-muted-foreground")}>
            {current?.name ?? "Sem status"}
          </span>
          {!compact && <ChevronDown className="ml-auto size-3.5 opacity-50" />}
        </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <Command>
          <CommandList>
            <CommandGroup>
              {statuses.map((s) => (
                <CommandItem
                  key={s.id}
                  onSelect={() => {
                    onChange(s.id);
                    setOpen(false);
                  }}
                >
                  <StatusDot color={s.color} />
                  <span className="flex-1">{s.name}</span>
                  {s.id === value && <Check className="size-3.5" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function AssigneePicker({
  members,
  value,
  onChange,
  className,
  compact,
}: {
  members: UserDTO[];
  value: string | null;
  onChange: (id: string | null) => void;
  className?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const current = members.find((m) => m.id === value) ?? null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          compact
            ? "flex items-center justify-center rounded-md p-1 transition hover:bg-accent"
            : triggerClass,
          className,
        )}
        aria-label="Definir responsável"
      >
          <UserAvatar user={current} showTooltip={false} className="size-5" />
          {!compact && (
            <>
              <span className={cn("truncate", !current && "text-muted-foreground")}>
                {current?.name ?? "Sem responsável"}
              </span>
              <ChevronDown className="ml-auto size-3.5 opacity-50" />
            </>
          )}
        </PopoverTrigger>
      <PopoverContent className="w-60 p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar pessoa…" />
          <CommandList>
            <CommandEmpty>Ninguém encontrado.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                <UserAvatar user={null} showTooltip={false} className="size-5" />
                <span className="flex-1">Sem responsável</span>
                {!value && <Check className="size-3.5" />}
              </CommandItem>
              {members.map((m) => (
                <CommandItem
                  key={m.id}
                  value={m.name}
                  onSelect={() => {
                    onChange(m.id);
                    setOpen(false);
                  }}
                >
                  <UserAvatar user={m} showTooltip={false} className="size-5" />
                  <span className="flex-1 truncate">{m.name}</span>
                  {m.id === value && <Check className="size-3.5" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function PriorityPicker({
  value,
  onChange,
  className,
  compact,
}: {
  value: string;
  onChange: (value: PriorityValue) => void;
  className?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const key = (value in PRIORITY_META ? value : "NONE") as PriorityValue;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          compact
            ? "flex items-center justify-center rounded-md p-1 transition hover:bg-accent"
            : triggerClass,
          className,
        )}
        aria-label="Definir prioridade"
      >
          <PriorityFlag priority={key} withLabel={!compact} />
          {!compact && <ChevronDown className="ml-auto size-3.5 opacity-50" />}
        </PopoverTrigger>
      <PopoverContent className="w-48 p-0" align="start">
        <Command>
          <CommandList>
            <CommandGroup>
              {[...PRIORITIES].reverse().map((p) => (
                <CommandItem
                  key={p}
                  onSelect={() => {
                    onChange(p);
                    setOpen(false);
                  }}
                >
                  <PriorityFlag priority={p} withLabel />
                  {p === key && <Check className="ml-auto size-3.5" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function TypePicker({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: TaskTypeValue) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const key = (value in TASK_TYPE_META ? value : "TASK") as TaskTypeValue;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={cn(triggerClass, className)}>
          <TypeIcon type={key} />
          <span>{TASK_TYPE_META[key].label}</span>
          <ChevronDown className="ml-auto size-3.5 opacity-50" />
        </PopoverTrigger>
      <PopoverContent className="w-48 p-0" align="start">
        <Command>
          <CommandList>
            <CommandGroup>
              {TASK_TYPES.map((t) => (
                <CommandItem
                  key={t}
                  onSelect={() => {
                    onChange(t);
                    setOpen(false);
                  }}
                >
                  <TypeIcon type={t} />
                  <span className="flex-1">{TASK_TYPE_META[t].label}</span>
                  {t === key && <Check className="size-3.5" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Sem data",
  className,
  compact,
}: {
  value: string | null;
  onChange: (iso: string | null) => void;
  placeholder?: string;
  className?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const date = value ? new Date(value) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={cn(triggerClass, className)}>
          {!compact && (
            <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
          )}
          <span className={cn("truncate", !date && "text-muted-foreground")}>
            {date ? formatDate(date) : placeholder}
          </span>
          {date && (
            <span
              role="button"
              tabIndex={0}
              className={cn(
                "ml-auto rounded p-0.5 text-muted-foreground hover:bg-muted",
                compact && "opacity-0 transition group-hover/row:opacity-60",
              )}
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.stopPropagation();
                  onChange(null);
                }
              }}
            >
              <X className="size-3" />
            </span>
          )}
        </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          locale={ptBR}
          selected={date}
          defaultMonth={date}
          onSelect={(d) => {
            onChange(d ? d.toISOString() : null);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

export function SprintPicker({
  sprints,
  value,
  onChange,
  className,
}: {
  sprints: SprintDTO[];
  value: string | null;
  onChange: (id: string | null) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = sprints.find((s) => s.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={cn(triggerClass, className)}>
          <span className={cn("truncate", !current && "text-muted-foreground")}>
            {current?.name ?? "Backlog"}
          </span>
          <ChevronDown className="ml-auto size-3.5 opacity-50" />
        </PopoverTrigger>
      <PopoverContent className="w-60 p-0" align="start">
        <Command>
          <CommandList>
            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                <span className="flex-1">Backlog</span>
                {!value && <Check className="size-3.5" />}
              </CommandItem>
              {sprints.map((s) => (
                <CommandItem
                  key={s.id}
                  value={s.name}
                  onSelect={() => {
                    onChange(s.id);
                    setOpen(false);
                  }}
                >
                  <span className="flex-1 truncate">{s.name}</span>
                  {s.id === value && <Check className="size-3.5" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function TagPicker({
  tags,
  value,
  onChange,
  className,
}: {
  tags: { id: string; name: string; color: string }[];
  value: string[];
  onChange: (ids: string[]) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = tags.filter((t) => value.includes(t.id));

  function toggle(id: string) {
    onChange(
      value.includes(id) ? value.filter((v) => v !== id) : [...value, id],
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={cn(triggerClass, "flex-wrap", className)}>
          {selected.length === 0 ? (
            <>
              <TagIcon className="size-4 text-muted-foreground" />
              <span className="text-muted-foreground">Sem etiquetas</span>
            </>
          ) : (
            selected.map((t) => (
              <TagChip key={t.id} name={t.name} color={t.color} />
            ))
          )}
        </PopoverTrigger>
      <PopoverContent className="w-60 p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar etiqueta…" />
          <CommandList>
            <CommandEmpty>Nenhuma etiqueta.</CommandEmpty>
            <CommandGroup>
              {tags.map((t) => (
                <CommandItem key={t.id} value={t.name} onSelect={() => toggle(t.id)}>
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: t.color }}
                  />
                  <span className="flex-1 truncate">{t.name}</span>
                  {value.includes(t.id) && <Check className="size-3.5" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

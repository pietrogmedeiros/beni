"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  AssigneePicker,
  DatePicker,
  PriorityPicker,
  SprintPicker,
  StatusPicker,
  TagPicker,
  TypePicker,
} from "@/components/task/pickers";
import { useApp } from "@/components/app-shell/app-context";
import { createTask } from "@/server/actions/tasks";
import type { PriorityValue, TaskTypeValue } from "@/lib/constants";

export type NewTaskDefaults = {
  projectId?: string;
  statusId?: string;
  sprintId?: string | null;
  parentId?: string;
};

export function NewTaskDialog({
  open,
  defaults,
  onOpenChange,
}: {
  open: boolean;
  defaults: NewTaskDefaults;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* montado só enquanto aberto: o formulário sempre começa limpo */}
      {open && <NewTaskForm defaults={defaults} onOpenChange={onOpenChange} />}
    </Dialog>
  );
}

function NewTaskForm({
  defaults,
  onOpenChange,
}: {
  defaults: NewTaskDefaults;
  onOpenChange: (open: boolean) => void;
}) {
  const { projects, members, tags } = useApp();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [projectId, setProjectId] = useState(
    defaults.projectId ?? projects[0]?.id ?? "",
  );
  const project = projects.find((p) => p.id === projectId);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [statusId, setStatusId] = useState(
    () =>
      defaults.statusId ??
      projects.find((p) => p.id === (defaults.projectId ?? projects[0]?.id))
        ?.statuses[0]?.id ??
      "",
  );
  const [sprintId, setSprintId] = useState<string | null>(
    defaults.sprintId ?? null,
  );
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [priority, setPriority] = useState<PriorityValue>("NONE");
  const [type, setType] = useState<TaskTypeValue>("TASK");
  const [startDate, setStartDate] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [points, setPoints] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);

  /** Trocar de projeto redefine o status para o primeiro do novo fluxo. */
  function changeProject(id: string) {
    setProjectId(id);
    setStatusId(projects.find((p) => p.id === id)?.statuses[0]?.id ?? "");
    setSprintId(null);
  }

  function submit(keepOpen: boolean) {
    if (!title.trim()) {
      toast.error("Informe um título");
      return;
    }
    startTransition(async () => {
      try {
        await createTask({
          projectId,
          title: title.trim(),
          description: description.trim() || null,
          statusId: statusId || null,
          sprintId,
          parentId: defaults.parentId ?? null,
          assigneeId,
          priority,
          type,
          startDate,
          dueDate,
          points: points ? Number(points) : null,
          tagIds,
        });
        toast.success("Tarefa criada");
        router.refresh();
        if (keepOpen) {
          setTitle("");
          setDescription("");
        } else {
          onOpenChange(false);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao criar tarefa");
      }
    });
  }

  return (
    <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {defaults.parentId ? "Nova subtarefa" : "Nova tarefa"}
          </DialogTitle>
          <DialogDescription>
            Preencha o essencial agora — dá para detalhar depois.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {!defaults.parentId && (
            <div className="space-y-1.5">
              <Label>Projeto</Label>
              <Select value={projectId} onValueChange={(v) => changeProject(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: p.color }}
                      />
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="task-title">Título</Label>
            <Input
              id="task-title"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="O que precisa ser feito?"
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit(false);
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-desc">Descrição</Label>
            <Textarea
              id="task-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Contexto, critérios de aceite…"
              className="min-h-20"
            />
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-lg border p-2">
            <LabeledField label="Status">
              <StatusPicker
                statuses={project?.statuses ?? []}
                value={statusId}
                onChange={setStatusId}
              />
            </LabeledField>
            <LabeledField label="Responsável">
              <AssigneePicker
                members={members}
                value={assigneeId}
                onChange={setAssigneeId}
              />
            </LabeledField>
            <LabeledField label="Prioridade">
              <PriorityPicker value={priority} onChange={setPriority} />
            </LabeledField>
            <LabeledField label="Tipo">
              <TypePicker value={type} onChange={setType} />
            </LabeledField>
            <LabeledField label="Início">
              <DatePicker value={startDate} onChange={setStartDate} />
            </LabeledField>
            <LabeledField label="Prazo">
              <DatePicker value={dueDate} onChange={setDueDate} />
            </LabeledField>
            <LabeledField label="Sprint">
              <SprintPicker
                sprints={project?.sprints ?? []}
                value={sprintId}
                onChange={setSprintId}
              />
            </LabeledField>
            <LabeledField label="Pontos">
              <Input
                type="number"
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                className="h-8"
                placeholder="—"
              />
            </LabeledField>
            <div className="col-span-2">
              <LabeledField label="Etiquetas">
                <TagPicker tags={tags} value={tagIds} onChange={setTagIds} />
              </LabeledField>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() => submit(true)}
          >
            Criar e continuar
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button disabled={pending} onClick={() => submit(false)}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Criar tarefa
            </Button>
          </div>
      </DialogFooter>
    </DialogContent>
  );
}

function LabeledField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="px-2 pb-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

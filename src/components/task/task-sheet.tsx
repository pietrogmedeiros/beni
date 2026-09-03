"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { withBase } from "@/lib/base-path";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Link2,
  Loader2,
  MessageSquare,
  Plus,
  Send,
  Trash2,
  X,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AttachmentsPanel } from "@/components/task/attachments-panel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import { StatusDot, TypeIcon } from "@/components/task/task-badges";
import {
  AssigneePicker,
  DatePicker,
  PriorityPicker,
  SprintPicker,
  StatusPicker,
  TagPicker,
  TypePicker,
} from "@/components/task/pickers";
import { ApprovalPanel } from "@/components/task/approval-panel";
import { GithubPanel } from "@/components/task/github-panel";
import { useApp } from "@/components/app-shell/app-context";
import { loadTaskDetail } from "@/server/actions/task-detail";
import {
  addComment,
  addDependency,
  deleteTask,
  duplicateTask,
  removeDependency,
  setTaskTags,
  updateTask,
} from "@/server/actions/tasks";
import type { TaskDetail } from "@/server/queries";
import { RelativeTime } from "@/components/relative-time";
import { cn } from "@/lib/utils";

export function TaskSheet({
  taskId,
  onClose,
}: {
  taskId: string | null;
  onClose: () => void;
}) {
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // sincroniza com uma fonte externa (o servidor) — o setState aqui é intencional
  useEffect(() => {
    if (!taskId) {
      // sincronização com fonte externa (URL, localStorage, servidor) — intencional
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTask(null);
      return;
    }
    let active = true;
    setLoading(true);
    loadTaskDetail(taskId)
      .then((data) => {
        if (active) setTask(data);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [taskId]);

  async function refresh() {
    if (!taskId) return;
    const data = await loadTaskDetail(taskId);
    setTask(data);
    router.refresh();
  }

  return (
    <Sheet open={!!taskId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        showCloseButton={false}
        /* o padrão do componente é `data-[side=right]:sm:max-w-sm`; para
           sobrescrever é preciso usar a mesma combinação de variantes */
        className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl data-[side=right]:lg:max-w-4xl"
      >
        <SheetTitle className="sr-only">Detalhe da tarefa</SheetTitle>
        <SheetDescription className="sr-only">
          Edite os campos, subtarefas e comentários da tarefa.
        </SheetDescription>

        {loading && !task ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : task ? (
          <TaskSheetBody
            key={task.id}
            task={task}
            onRefresh={refresh}
            onClose={onClose}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Tarefa não encontrada.
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function TaskSheetBody({
  task,
  onRefresh,
  onClose,
}: {
  task: TaskDetail;
  onRefresh: () => Promise<void>;
  onClose: () => void;
}) {
  const { projects, members, tags, openTask, openNewTask } = useApp();
  const project = projects.find((p) => p.id === task.projectId);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [comment, setComment] = useState("");
  // a contagem vem do painel de anexos, que é quem conhece a lista
  const [attachmentCount, setAttachmentCount] = useState(0);
  const [pending, startTransition] = useTransition();

  const isDone = task.statusCategory === "DONE";

  function patch(input: Parameters<typeof updateTask>[1]) {
    startTransition(async () => {
      await updateTask(task.id, input);
      await onRefresh();
    });
  }

  const lastApproval = task.approvals[0];
  const approvalBadge = lastApproval
    ? lastApproval.status === "PENDING"
      ? { label: "pendente", className: "bg-primary/15 text-primary-strong" }
      : lastApproval.status === "APPROVED"
        ? { label: "aprovada", className: "bg-success/15 text-success" }
        : { label: "reprovada", className: "bg-destructive/15 text-destructive" }
    : null;

  const subtaskProgress = task.subtasks.length
    ? Math.round(
        (task.subtasks.filter((s) => s.statusCategory === "DONE").length /
          task.subtasks.length) *
          100,
      )
    : null;

  return (
    <div className="flex h-full flex-col">
      {/* cabeçalho */}
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        {task.parent && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 max-w-48 gap-1.5 px-2 text-xs"
            onClick={() => openTask(task.parent!.id)}
            title={`Voltar para ${task.projectKey}-${task.parent.number}: ${task.parent.title}`}
            aria-label={`Voltar para a tarefa pai ${task.projectKey}-${task.parent.number}`}
          >
            <ArrowLeft className="size-4 shrink-0" />
            <span className="truncate">
              {task.projectKey}-{task.parent.number}
            </span>
          </Button>
        )}

        <span
          className="flex items-center gap-1.5 rounded-md px-1.5 py-0.5 font-mono text-xs font-medium"
          style={{
            backgroundColor: `${task.projectColor}18`,
            color: task.projectColor,
          }}
        >
          <TypeIcon type={task.type} />
          {task.projectKey}-{task.number}
        </span>

        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={() =>
            patch({
              statusId:
                project?.statuses.find((s) =>
                  isDone ? s.category === "TODO" : s.category === "DONE",
                )?.id ?? task.statusId,
            })
          }
        >
          <CheckCircle2
            className={cn("size-4", isDone && "text-success")}
          />
          {isDone ? "Reabrir" : "Concluir"}
        </Button>

        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => {
              navigator.clipboard.writeText(
                `${window.location.origin}${withBase(`/t/${task.id}`)}`,
              );
              toast.success("Link copiado");
            }}
            aria-label="Copiar link"
          >
            <Link2 className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() =>
              startTransition(async () => {
                await duplicateTask(task.id);
                toast.success("Tarefa duplicada");
                onClose();
              })
            }
            aria-label="Duplicar"
          >
            <Copy className="size-4" />
          </Button>

          <AlertDialog>
            <AlertDialogTrigger render={<Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-destructive"
                aria-label="Excluir" />}>
                <Trash2 className="size-4" />
              </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. As subtarefas também serão
                  removidas.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() =>
                    startTransition(async () => {
                      await deleteTask(task.id);
                      toast.success("Tarefa excluída");
                      onClose();
                    })
                  }
                >
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[1fr_264px]">
        {/* coluna principal */}
        <div className="thin-scrollbar min-h-0 overflow-y-auto px-5 py-4">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title.trim() && title !== task.title && patch({ title })}
            className="mb-4 h-auto border-0 bg-transparent px-0 text-xl font-semibold shadow-none focus-visible:ring-0 md:text-xl"
          />

          <div className="mb-6">
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Descrição
            </p>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() =>
                description !== (task.description ?? "") &&
                patch({ description: description || null })
              }
              placeholder="Adicione contexto, critérios de aceite, links…"
              className="min-h-28 resize-y"
            />
          </div>

          <Tabs defaultValue="subtasks">
            <TabsList>
              <TabsTrigger value="subtasks">
                Subtarefas
                {task.subtasks.length > 0 && (
                  <span className="ml-1.5 rounded bg-muted px-1 text-[10px]">
                    {task.subtasks.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="comments">
                Comentários
                {task.comments.length > 0 && (
                  <span className="ml-1.5 rounded bg-muted px-1 text-[10px]">
                    {task.comments.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="attachments">
                Anexos
                {attachmentCount > 0 && (
                  <span className="ml-1.5 rounded bg-muted px-1 text-[10px]">
                    {attachmentCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="approval">
                Aprovação
                {approvalBadge && (
                  <span
                    className={cn(
                      "ml-1.5 rounded px-1 text-[10px]",
                      approvalBadge.className,
                    )}
                  >
                    {approvalBadge.label}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="github">
                GitHub
                {task.githubLinks.length > 0 && (
                  <span className="ml-1.5 rounded bg-muted px-1 text-[10px]">
                    {task.githubLinks.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="links">Dependências</TabsTrigger>
              <TabsTrigger value="activity">Atividade</TabsTrigger>
            </TabsList>

            {/* subtarefas */}
            <TabsContent value="subtasks" className="mt-3 space-y-2">
              {subtaskProgress !== null && (
                <div className="flex items-center gap-3">
                  <Progress value={subtaskProgress} className="h-1.5 flex-1" />
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {subtaskProgress}%
                  </span>
                </div>
              )}

              {task.subtasks.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => openTask(s.id)}
                  className="flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left text-sm transition hover:bg-accent"
                >
                  <StatusDot color={s.statusColor} />
                  <span
                    className={cn(
                      "flex-1 truncate",
                      s.statusCategory === "DONE" &&
                        "text-muted-foreground line-through",
                    )}
                  >
                    {s.title}
                  </span>
                  <UserAvatar user={s.assignee} className="size-5" />
                </button>
              ))}

              <Button
                variant="outline"
                size="sm"
                className="w-full border-dashed"
                onClick={() =>
                  openNewTask({ projectId: task.projectId, parentId: task.id })
                }
              >
                <Plus className="size-4" />
                Nova subtarefa
              </Button>
            </TabsContent>

            {/* comentários */}
            <TabsContent value="comments" className="mt-3 space-y-4">
              {task.comments.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  <MessageSquare className="mx-auto mb-2 size-5 opacity-40" />
                  Nenhum comentário ainda.
                </p>
              )}

              {task.comments.map((c) => (
                <div key={c.id} className="flex gap-2.5">
                  <UserAvatar user={c.author} className="mt-0.5 size-7" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium">{c.author.name}</span>
                      <span className="text-[11px] text-muted-foreground">
                        <RelativeTime date={c.createdAt} />
                      </span>
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm text-foreground/90">
                      {c.body}
                    </p>
                  </div>
                </div>
              ))}

              <div className="flex gap-2">
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Escreva um comentário…"
                  className="min-h-16 flex-1 resize-none"
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                      e.preventDefault();
                      if (!comment.trim()) return;
                      startTransition(async () => {
                        await addComment(task.id, comment);
                        setComment("");
                        await onRefresh();
                      });
                    }
                  }}
                />
                <Button
                  size="icon"
                  disabled={!comment.trim() || pending}
                  onClick={() =>
                    startTransition(async () => {
                      await addComment(task.id, comment);
                      setComment("");
                      await onRefresh();
                    })
                  }
                  aria-label="Enviar comentário"
                >
                  <Send className="size-4" />
                </Button>
              </div>
            </TabsContent>

            {/* aprovação de stakeholder */}
            {/* anexos */}
            <TabsContent value="attachments" className="mt-3">
              <AttachmentsPanel
                taskId={task.id}
                onCountChange={setAttachmentCount}
              />
            </TabsContent>

            <TabsContent value="approval" className="mt-3">
              <ApprovalPanel
                taskId={task.id}
                approvals={task.approvals}
                onRefresh={onRefresh}
              />
            </TabsContent>

            {/* GitHub */}
            <TabsContent value="github" className="mt-3">
              <GithubPanel
                projectId={task.projectId}
                onSair={onClose}
                taskId={task.id}
                taskKey={`${task.projectKey}-${task.number}`}
                taskTitle={task.title}
                links={task.githubLinks}
                onRefresh={onRefresh}
              />
            </TabsContent>

            {/* dependências */}
            <TabsContent value="links" className="mt-3 space-y-4">
              <DependencySection
                title="Bloqueada por"
                empty="Nada bloqueando esta tarefa."
                items={task.dependencies.blockedBy}
                onOpen={openTask}
                onRemove={(id) =>
                  startTransition(async () => {
                    await removeDependency(id);
                    await onRefresh();
                  })
                }
              />
              <DependencySection
                title="Bloqueia"
                empty="Esta tarefa não bloqueia outras."
                items={task.dependencies.blocking}
                onOpen={openTask}
                onRemove={(id) =>
                  startTransition(async () => {
                    await removeDependency(id);
                    await onRefresh();
                  })
                }
              />
              <AddDependency
                taskId={task.id}
                projectId={task.projectId}
                onDone={onRefresh}
              />
            </TabsContent>

            {/* atividade */}
            <TabsContent value="activity" className="mt-3 space-y-3">
              {task.activities.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Sem atividade registrada.
                </p>
              )}
              {task.activities.map((a) => (
                <div key={a.id} className="flex items-start gap-2 text-sm">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {a.user?.name ?? "Alguém"}
                    </span>{" "}
                    {describeActivity(a.action, a.meta)}{" "}
                    <span className="text-xs">· <RelativeTime date={a.createdAt} /></span>
                  </p>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </div>

        {/* barra lateral de propriedades */}
        <div className="thin-scrollbar min-h-0 overflow-y-auto border-t bg-muted/25 px-3 py-4 lg:border-l lg:border-t-0">
          <Field label="Status">
            <StatusPicker
              statuses={project?.statuses ?? []}
              value={task.statusId}
              onChange={(id) => patch({ statusId: id })}
            />
          </Field>
          <Field label="Responsável">
            <AssigneePicker
              members={members}
              value={task.assignee?.id ?? null}
              onChange={(id) => patch({ assigneeId: id })}
            />
          </Field>
          <Field label="Prioridade">
            <PriorityPicker
              value={task.priority}
              onChange={(p) => patch({ priority: p })}
            />
          </Field>
          <Field label="Tipo">
            <TypePicker value={task.type} onChange={(t) => patch({ type: t })} />
          </Field>

          <Separator className="my-3" />

          <Field label="Início">
            <DatePicker
              value={task.startDate}
              onChange={(iso) => patch({ startDate: iso })}
            />
          </Field>
          <Field label="Prazo">
            <DatePicker
              value={task.dueDate}
              onChange={(iso) => patch({ dueDate: iso })}
            />
          </Field>
          <Field label="Sprint">
            <SprintPicker
              sprints={project?.sprints ?? []}
              value={task.sprintId}
              onChange={(id) => patch({ sprintId: id })}
            />
          </Field>

          <Separator className="my-3" />

          <div className="grid grid-cols-2 gap-2">
            <Field label="Pontos">
              <Input
                type="number"
                defaultValue={task.points ?? ""}
                className="h-8"
                onBlur={(e) =>
                  patch({
                    points: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
            </Field>
            <Field label="Estimativa (h)">
              <Input
                type="number"
                step="0.5"
                defaultValue={task.estimate ?? ""}
                className="h-8"
                onBlur={(e) =>
                  patch({
                    estimate: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
            </Field>
          </div>

          <Field label={`Progresso · ${task.progress}%`}>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              defaultValue={task.progress}
              className="w-full accent-primary"
              onMouseUp={(e) =>
                patch({ progress: Number((e.target as HTMLInputElement).value) })
              }
              onTouchEnd={(e) =>
                patch({ progress: Number((e.target as HTMLInputElement).value) })
              }
            />
          </Field>

          <Separator className="my-3" />

          <Field label="Etiquetas">
            <TagPicker
              tags={tags}
              value={task.tags.map((t) => t.id)}
              onChange={(ids) =>
                startTransition(async () => {
                  await setTaskTags(task.id, ids);
                  await onRefresh();
                })
              }
            />
          </Field>

          <p className="mt-4 px-2 text-[11px] leading-relaxed text-muted-foreground">
            Criada <RelativeTime date={task.createdAt} />
            <br />
            Atualizada <RelativeTime date={task.updatedAt} />
          </p>
        </div>
      </div>

      {pending && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-foreground/90 px-3 py-1 text-xs text-background">
          Salvando…
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-2">
      <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

type DepItem = {
  id: string;
  type: string;
  task: {
    id: string;
    number: number;
    title: string;
    statusName: string;
    statusColor: string;
    statusCategory: string;
  };
};

function DependencySection({
  title,
  empty,
  items,
  onOpen,
  onRemove,
}: {
  title: string;
  empty: string;
  items: DepItem[];
  onOpen: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="space-y-1">
          {items.map((d) => (
            <div
              key={d.id}
              className="group flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm"
            >
              <StatusDot color={d.task.statusColor} />
              <button
                type="button"
                className="flex-1 truncate text-left hover:underline"
                onClick={() => onOpen(d.task.id)}
              >
                {d.task.title}
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 opacity-0 transition group-hover:opacity-100"
                onClick={() => onRemove(d.id)}
                aria-label="Remover dependência"
              >
                <X className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AddDependency({
  taskId,
  projectId,
  onDone,
}: {
  taskId: string;
  projectId: string;
  onDone: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<
    { id: string; title: string; number: number }[]
  >([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    import("@/server/actions/project-tasks").then(async (mod) => {
      const list = await mod.listProjectTasks(projectId);
      setOptions(list.filter((t) => t.id !== taskId));
    });
  }, [open, projectId, taskId]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="outline" size="sm" className="w-full border-dashed" />}>
          <Plus className="size-4" />
          Adicionar dependência
        </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar tarefa…" />
          <CommandList>
            <CommandEmpty>Nenhuma tarefa.</CommandEmpty>
            <CommandGroup heading="Esta tarefa é bloqueada por">
              {options.map((t) => (
                <CommandItem
                  key={t.id}
                  value={t.title}
                  disabled={pending}
                  onSelect={() =>
                    startTransition(async () => {
                      try {
                        await addDependency({
                          taskId,
                          dependsOnId: t.id,
                        });
                        await onDone();
                        setOpen(false);
                      } catch (e) {
                        toast.error(
                          e instanceof Error ? e.message : "Erro ao vincular",
                        );
                      }
                    })
                  }
                >
                  <span className="truncate">{t.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function describeActivity(action: string, meta: Record<string, unknown> | null) {
  switch (action) {
    case "task.created":
      return "criou esta tarefa";
    case "task.status_changed":
      return `moveu de ${String(meta?.from ?? "?")} para ${String(meta?.to ?? "?")}`;
    case "comment.added":
      return "comentou";
    case "task.deleted":
      return "excluiu uma tarefa";
    default:
      return action;
  }
}

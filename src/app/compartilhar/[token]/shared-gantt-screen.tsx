"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  AlertCircle,
  CalendarClock,
  Eye,
  Loader2,
  MessageSquare,
  Send,
  X,
} from "lucide-react";
import { BeniLogo } from "@/components/logo";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { GanttView } from "@/components/views/gantt-view";
import { DynamicIcon } from "@/components/dynamic-icon";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  addSharedComment,
  loadSharedTaskThread,
  type GuestCommentState,
  type SharedGantt,
  type SharedTaskThread,
} from "@/server/actions/share";
import { PRIORITY_META, type PriorityValue } from "@/lib/constants";
import { RelativeTime } from "@/components/relative-time";
import { cn, formatDate, initials, readableOn } from "@/lib/utils";

export function SharedGanttScreen({
  token,
  data,
  visitor,
}: {
  token: string;
  data: SharedGantt;
  visitor: { name: string; email: string } | null;
}) {
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  return (
    <TooltipProvider delay={300}>
      <div className="flex h-svh flex-col">
        <header className="flex shrink-0 flex-wrap items-center gap-3 border-b px-4 py-2.5">
          <BeniLogo showText={false} />
          <span
            className="flex size-8 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${data.project.color}1f` }}
          >
            <DynamicIcon
              name={data.project.icon}
              className="size-4"
              style={{ color: data.project.color }}
            />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-semibold leading-tight">
              {data.project.name}
            </h1>
            <p className="text-xs text-muted-foreground">
              Cronograma compartilhado
              {data.sharedBy && ` por ${data.sharedBy}`}
              {data.expiresAt && ` · disponível até ${formatDate(data.expiresAt)}`}
            </p>
          </div>

          <span className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
            <Eye className="size-3.5" />
            somente leitura
            {data.allowComments && " · comentários abertos"}
          </span>
        </header>

        <GanttView
          tasks={data.tasks}
          dependencies={data.dependencies}
          readOnly
          onOpenTask={setOpenTaskId}
        />

        <TaskThreadSheet
          token={token}
          taskId={openTaskId}
          visitor={visitor}
          onClose={() => setOpenTaskId(null)}
        />
      </div>
    </TooltipProvider>
  );
}

function TaskThreadSheet({
  token,
  taskId,
  visitor,
  onClose,
}: {
  token: string;
  taskId: string | null;
  visitor: { name: string; email: string } | null;
  onClose: () => void;
}) {
  const [thread, setThread] = useState<SharedTaskThread | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!taskId) {
      // sincronização com fonte externa (servidor) — intencional
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setThread(null);
      return;
    }
    let active = true;
    setLoading(true);
    loadSharedTaskThread(token, taskId)
      .then((data) => active && setThread(data))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [token, taskId]);

  async function refresh() {
    if (!taskId) return;
    setThread(await loadSharedTaskThread(token, taskId));
  }

  return (
    <Sheet open={!!taskId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg"
      >
        <SheetTitle className="sr-only">Detalhe do item</SheetTitle>
        <SheetDescription className="sr-only">
          Veja os detalhes do item e deixe um comentário.
        </SheetDescription>

        {loading && !thread ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : thread ? (
          <ThreadBody
            token={token}
            thread={thread}
            visitor={visitor}
            onClose={onClose}
            onSent={refresh}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Item não encontrado.
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function ThreadBody({
  token,
  thread,
  visitor,
  onClose,
  onSent,
}: {
  token: string;
  thread: SharedTaskThread;
  visitor: { name: string; email: string } | null;
  onClose: () => void;
  onSent: () => Promise<void>;
}) {
  const [state, formAction] = useActionState<GuestCommentState, FormData>(
    addSharedComment,
    undefined,
  );

  useEffect(() => {
    if (state?.ok) void onSent();
  }, [state?.ok, onSent]);

  const priority =
    PRIORITY_META[
      (thread.priority in PRIORITY_META
        ? thread.priority
        : "NONE") as PriorityValue
    ];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start gap-2 border-b px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Item #{thread.number}
          </p>
          <h2 className="mt-0.5 text-base font-semibold leading-snug">
            {thread.title}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: thread.statusColor }}
              />
              {thread.statusName}
            </span>
            <span className={priority.className}>{priority.label}</span>
            {thread.dueDate && (
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="size-3.5" />
                {formatDate(thread.startDate)} – {formatDate(thread.dueDate)}
              </span>
            )}
            {thread.assignee && <span>{thread.assignee.name}</span>}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          onClick={onClose}
          aria-label="Fechar"
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="thin-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {thread.description && (
          <p className="whitespace-pre-wrap rounded-lg bg-muted/60 p-3 text-sm">
            {thread.description}
          </p>
        )}

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Comentários ({thread.comments.length})
          </p>

          {thread.comments.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              <MessageSquare className="mx-auto mb-2 size-5 opacity-40" />
              Ninguém comentou ainda.
            </p>
          ) : (
            <ul className="space-y-3">
              {thread.comments.map((c) => (
                <li key={c.id} className="flex gap-2.5">
                  <Avatar className="mt-0.5 size-7">
                    <AvatarFallback
                      className="text-[10px] font-semibold"
                      style={{
                        backgroundColor: c.avatarColor,
                        color: readableOn(c.avatarColor),
                      }}
                    >
                      {initials(c.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-baseline gap-2">
                      <span className="text-sm font-medium">{c.name}</span>
                      {c.isGuest && (
                        <span className="rounded bg-muted px-1 text-[10px] text-muted-foreground">
                          convidado
                        </span>
                      )}
                      <span className="text-[11px] text-muted-foreground">
                        <RelativeTime date={c.createdAt} />
                      </span>
                    </p>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm text-foreground/90">
                      {c.body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {thread.allowComments ? (
        <form
          action={formAction}
          key={state?.ok ? "sent" : "form"}
          className="shrink-0 space-y-3 border-t bg-muted/30 px-4 py-3"
        >
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="taskId" value={thread.id} />

          {visitor ? (
            <p className="text-xs text-muted-foreground">
              Comentando como{" "}
              <strong className="font-medium text-foreground">
                {visitor.name}
              </strong>
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="guest-name" className="text-xs">
                  Seu nome *
                </Label>
                <Input
                  id="guest-name"
                  name="name"
                  required
                  minLength={2}
                  className="h-8"
                  placeholder="Ex.: Ana Ribeiro"
                  autoComplete="name"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="guest-email" className="text-xs">
                  Seu e-mail *
                </Label>
                <Input
                  id="guest-email"
                  name="email"
                  type="email"
                  required
                  className="h-8"
                  placeholder="voce@empresa.com"
                  autoComplete="email"
                />
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Textarea
              name="body"
              required
              placeholder="Escreva um comentário…"
              className="min-h-16 flex-1 resize-none bg-background"
            />
            <SendButton />
          </div>

          {state?.error && (
            <p className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="size-3.5" />
              {state.error}
            </p>
          )}

          <p className="text-[11px] text-muted-foreground">
            Seu comentário fica visível para o time do projeto, com nome e
            e-mail.
          </p>
        </form>
      ) : (
        <p className="shrink-0 border-t px-4 py-3 text-center text-xs text-muted-foreground">
          Os comentários estão desativados neste link.
        </p>
      )}
    </div>
  );
}

function SendButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="icon"
      className={cn("shrink-0")}
      disabled={pending}
      aria-label="Enviar comentário"
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Send className="size-4" />
      )}
    </Button>
  );
}

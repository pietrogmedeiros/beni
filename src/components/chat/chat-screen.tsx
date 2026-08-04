"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Check,
  Hash,
  Loader2,
  Lock,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Send,
  SmilePlus,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { useApp } from "@/components/app-shell/app-context";
import {
  addChannelMembers,
  createChannel,
  deleteMessage,
  editMessage,
  joinChannel,
  leaveChannel,
  listChannels,
  listDiscoverableChannels,
  loadChannel,
  loadThread,
  markChannelRead,
  openDirectChannel,
  sendMessage,
  toggleReaction,
  type ChannelDetail,
  type ChannelSummary,
  type MessageDTO,
} from "@/server/actions/chat";
import { cn, formatRelative, initials, readableOn } from "@/lib/utils";
import { format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";

const QUICK_EMOJI = ["👍", "🎉", "❤️", "🚀", "👀", "✅", "😄", "🙏"];

export function ChatScreen({
  initialChannels,
  initialChannelId,
}: {
  initialChannels: ChannelSummary[];
  initialChannelId: string | null;
}) {
  const { members, user } = useApp();
  const [channels, setChannels] = useState(initialChannels);
  const [activeId, setActiveId] = useState<string | null>(initialChannelId);
  const [channel, setChannel] = useState<ChannelDetail | null>(null);
  const [threadRoot, setThreadRoot] = useState<string | null>(null);
  const [newChannelOpen, setNewChannelOpen] = useState(false);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const refreshChannels = useCallback(async () => {
    setChannels(await listChannels());
  }, []);

  const openChannel = useCallback(
    async (id: string) => {
      setActiveId(id);
      setThreadRoot(null);
      setLoading(true);
      try {
        const data = await loadChannel(id);
        setChannel(data);
        await markChannelRead(id);
        await refreshChannels();
      } finally {
        setLoading(false);
      }
    },
    [refreshChannels],
  );

  // abre o primeiro canal ao entrar
  useEffect(() => {
    // carrega do servidor ao montar — sincronização externa, intencional
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (activeId && !channel) void openChannel(activeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // tempo real: recarrega o canal aberto e a lista quando algo muda
  useEffect(() => {
    const source = new EventSource("/api/chat/stream");

    source.onmessage = (event) => {
      const data = JSON.parse(event.data) as {
        type: string;
        channelId?: string;
      };
      if (data.type === "ready") return;

      void refreshChannels();
      if (data.channelId && data.channelId === activeId) {
        void loadChannel(data.channelId).then(setChannel);
        void markChannelRead(data.channelId);
      }
    };

    return () => source.close();
  }, [activeId, refreshChannels]);

  const totalUnread = channels.reduce((sum, c) => sum + c.unread, 0);
  useEffect(() => {
    document.title = totalUnread > 0 ? `(${totalUnread}) Chat · Beni` : "Chat · Beni";
  }, [totalUnread]);

  const grouped = useMemo(
    () => ({
      channels: channels.filter((c) => c.kind !== "DIRECT"),
      directs: channels.filter((c) => c.kind === "DIRECT"),
    }),
    [channels],
  );

  return (
    <div className="flex min-h-0 flex-1">
      {/* lista de conversas */}
      <aside className="flex w-64 shrink-0 flex-col border-r bg-sidebar/60">
        <div className="flex h-14 items-center gap-2 border-b px-3">
          <MessageSquare className="size-4 text-muted-foreground" />
          <h1 className="text-[15px] font-semibold">Conversas</h1>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto size-7"
            onClick={() => setNewChannelOpen(true)}
            aria-label="Novo canal"
          >
            <Plus className="size-4" />
          </Button>
        </div>

        <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto p-2">
          <SectionTitle>Canais</SectionTitle>
          {grouped.channels.map((c) => (
            <ChannelRow
              key={c.id}
              channel={c}
              active={c.id === activeId}
              onClick={() => openChannel(c.id)}
            />
          ))}
          <button
            type="button"
            onClick={() => setBrowseOpen(true)}
            className="mt-0.5 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-muted-foreground transition hover:bg-sidebar-accent/60 hover:text-foreground"
          >
            <Search className="size-3.5" />
            Explorar canais
          </button>

          <SectionTitle className="mt-4">Mensagens diretas</SectionTitle>
          {grouped.directs.map((c) => (
            <ChannelRow
              key={c.id}
              channel={c}
              active={c.id === activeId}
              onClick={() => openChannel(c.id)}
            />
          ))}

          <DirectPicker
            members={members.filter((m) => m.id !== user.id)}
            onPick={async (id) => {
              const { id: channelId } = await openDirectChannel(id);
              await refreshChannels();
              await openChannel(channelId);
            }}
          />
        </div>
      </aside>

      {/* conversa */}
      {channel ? (
        <ChannelPane
          channel={channel}
          loading={loading}
          onReload={() => openChannel(channel.id)}
          onOpenThread={setThreadRoot}
          onLeave={async () => {
            await leaveChannel(channel.id);
            setChannel(null);
            setActiveId(null);
            await refreshChannels();
          }}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          {loading ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            "Escolha uma conversa para começar."
          )}
        </div>
      )}

      {/* thread */}
      {threadRoot && channel && (
        <ThreadPane
          messageId={threadRoot}
          channelId={channel.id}
          onClose={() => setThreadRoot(null)}
        />
      )}

      <NewChannelDialog
        open={newChannelOpen}
        onOpenChange={setNewChannelOpen}
        onCreated={async (id) => {
          await refreshChannels();
          await openChannel(id);
        }}
      />

      <BrowseChannelsDialog
        open={browseOpen}
        onOpenChange={setBrowseOpen}
        onJoined={async (id) => {
          await refreshChannels();
          await openChannel(id);
        }}
      />
    </div>
  );
}

function SectionTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
        className,
      )}
    >
      {children}
    </p>
  );
}

function ChannelRow({
  channel,
  active,
  onClick,
}: {
  channel: ChannelSummary;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition",
        active
          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
        channel.unread > 0 && !active && "font-semibold text-foreground",
      )}
    >
      {channel.kind === "DIRECT" && channel.partner ? (
        <Avatar className="size-5">
          <AvatarFallback
            className="text-[9px] font-semibold"
            style={{
              backgroundColor: channel.partner.avatarColor,
              color: readableOn(channel.partner.avatarColor),
            }}
          >
            {initials(channel.partner.name)}
          </AvatarFallback>
        </Avatar>
      ) : channel.kind === "PRIVATE" ? (
        <Lock className="size-3.5 shrink-0" />
      ) : (
        <Hash className="size-3.5 shrink-0" />
      )}

      <span className="min-w-0 flex-1 truncate">{channel.name}</span>

      {channel.mentions > 0 && (
        <span className="rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-white">
          @{channel.mentions}
        </span>
      )}
      {channel.mentions === 0 && channel.unread > 0 && (
        <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
          {channel.unread}
        </span>
      )}
    </button>
  );
}

function ChannelPane({
  channel,
  loading,
  onReload,
  onOpenThread,
  onLeave,
}: {
  channel: ChannelDetail;
  loading: boolean;
  onReload: () => void;
  onOpenThread: (id: string) => void;
  onLeave: () => void;
}) {
  const { members } = useApp();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [membersOpen, setMembersOpen] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [channel.messages.length, channel.id]);

  const candidates = members.filter(
    (m) => !channel.members.some((cm) => cm.id === m.id),
  );

  return (
    <section className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        {channel.kind === "PRIVATE" ? (
          <Lock className="size-4 text-muted-foreground" />
        ) : channel.kind === "DIRECT" ? (
          <Users className="size-4 text-muted-foreground" />
        ) : (
          <Hash className="size-4 text-muted-foreground" />
        )}
        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-semibold leading-tight">
            {channel.name}
          </h2>
          {channel.topic && (
            <p className="truncate text-xs text-muted-foreground">{channel.topic}</p>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setMembersOpen(true)}
          >
            <Users className="size-3.5" />
            {channel.members.length}
          </Button>

          {channel.kind !== "DIRECT" && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="ghost" size="icon" className="size-8" />}
              >
                <MoreHorizontal className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setMembersOpen(true)}>
                  <UserPlus className="size-4" />
                  Adicionar pessoas
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={onLeave}>
                  <X className="size-4" />
                  Sair do canal
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {loading && channel.messages.length === 0 && (
          <div className="flex justify-center py-10">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {channel.messages.length === 0 && !loading && (
          <div className="py-16 text-center">
            <MessageSquare className="mx-auto mb-2 size-6 text-muted-foreground/50" />
            <p className="text-sm font-medium">Comece a conversa</p>
            <p className="text-xs text-muted-foreground">
              Use @nome para chamar alguém.
            </p>
          </div>
        )}

        <MessageList
          messages={channel.messages}
          onReload={onReload}
          onOpenThread={onOpenThread}
        />
        <div ref={bottomRef} />
      </div>

      <Composer channelId={channel.id} onSent={onReload} />

      <MembersDialog
        open={membersOpen}
        onOpenChange={setMembersOpen}
        channel={channel}
        candidates={candidates}
        onChanged={onReload}
      />
    </section>
  );
}

function MessageList({
  messages,
  onReload,
  onOpenThread,
  compact,
}: {
  messages: MessageDTO[];
  onReload: () => void;
  onOpenThread?: (id: string) => void;
  compact?: boolean;
}) {
  return (
    <div className="space-y-0.5">
      {messages.map((m, i) => {
        const previous = messages[i - 1];
        const sameAuthor =
          previous &&
          previous.author.id === m.author.id &&
          new Date(m.createdAt).getTime() -
            new Date(previous.createdAt).getTime() <
            5 * 60 * 1000;
        const newDay =
          !previous || !isSameDay(new Date(previous.createdAt), new Date(m.createdAt));

        return (
          <div key={m.id}>
            {newDay && !compact && (
              <div className="my-3 flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-[11px] font-medium text-muted-foreground">
                  {format(new Date(m.createdAt), "d 'de' MMMM", { locale: ptBR })}
                </span>
                <Separator className="flex-1" />
              </div>
            )}
            <MessageRow
              message={m}
              grouped={!!sameAuthor && !newDay}
              onReload={onReload}
              onOpenThread={onOpenThread}
            />
          </div>
        );
      })}
    </div>
  );
}

function MessageRow({
  message,
  grouped,
  onReload,
  onOpenThread,
}: {
  message: MessageDTO;
  grouped: boolean;
  onReload: () => void;
  onOpenThread?: (id: string) => void;
}) {
  const { user, openTask } = useApp();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.body);
  const [, startTransition] = useTransition();
  const mine = message.author.id === user.id;

  return (
    <div
      className={cn(
        "group relative flex gap-2.5 rounded-md px-2 transition hover:bg-accent/40",
        grouped ? "py-0.5" : "py-1.5",
      )}
    >
      {grouped ? (
        <span className="w-8 shrink-0 pt-0.5 text-right text-[10px] text-muted-foreground opacity-0 transition group-hover:opacity-100">
          {format(new Date(message.createdAt), "HH:mm")}
        </span>
      ) : (
        <Avatar className="mt-0.5 size-8 shrink-0">
          <AvatarFallback
            className="text-[11px] font-semibold"
            style={{
              backgroundColor: message.author.avatarColor,
              color: readableOn(message.author.avatarColor),
            }}
          >
            {initials(message.author.name)}
          </AvatarFallback>
        </Avatar>
      )}

      <div className="min-w-0 flex-1">
        {!grouped && (
          <p className="flex items-baseline gap-2">
            <span className="text-sm font-semibold">{message.author.name}</span>
            <span className="text-[11px] text-muted-foreground">
              {format(new Date(message.createdAt), "HH:mm")}
            </span>
            {message.editedAt && (
              <span className="text-[10px] text-muted-foreground">(editada)</span>
            )}
          </p>
        )}

        {editing ? (
          <div className="mt-1 flex gap-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="min-h-16 flex-1"
              autoFocus
            />
            <div className="flex flex-col gap-1">
              <Button
                size="icon"
                className="size-8"
                onClick={() =>
                  startTransition(async () => {
                    await editMessage(message.id, draft);
                    setEditing(false);
                    onReload();
                  })
                }
                aria-label="Salvar"
              >
                <Check className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="size-8"
                onClick={() => {
                  setDraft(message.body);
                  setEditing(false);
                }}
                aria-label="Cancelar"
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed">
            {renderBody(message.body)}
          </p>
        )}

        {message.task && (
          <button
            type="button"
            onClick={() => openTask(message.task!.id)}
            className="mt-1 inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition hover:bg-accent"
          >
            <span className="font-mono text-[10px] text-muted-foreground">
              {message.task.projectKey}-{message.task.number}
            </span>
            {message.task.title}
          </button>
        )}

        {message.reactions.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {message.reactions.map((r) => (
              <button
                key={r.emoji}
                type="button"
                onClick={() =>
                  startTransition(async () => {
                    await toggleReaction(message.id, r.emoji);
                    onReload();
                  })
                }
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] transition",
                  r.mine
                    ? "border-primary/50 bg-primary/15"
                    : "hover:bg-accent",
                )}
              >
                {r.emoji} {r.count}
              </button>
            ))}
          </div>
        )}

        {message.replyCount > 0 && onOpenThread && (
          <button
            type="button"
            onClick={() => onOpenThread(message.id)}
            className="mt-1 inline-flex items-center gap-1.5 rounded px-1 text-[11px] font-medium text-primary-strong hover:underline"
          >
            <MessageSquare className="size-3" />
            {message.replyCount}{" "}
            {message.replyCount === 1 ? "resposta" : "respostas"}
            {message.lastReplyAt && (
              <span className="font-normal text-muted-foreground">
                · {formatRelative(message.lastReplyAt)}
              </span>
            )}
          </button>
        )}
      </div>

      {/* ações rápidas */}
      <div className="absolute right-2 top-0 hidden items-center gap-0.5 rounded-md border bg-popover p-0.5 shadow-sm group-hover:flex">
        <Popover>
          <PopoverTrigger
            className="inline-flex size-6 items-center justify-center rounded transition hover:bg-accent"
            aria-label="Reagir"
          >
            <SmilePlus className="size-3.5" />
          </PopoverTrigger>
          <PopoverContent className="w-auto p-1" align="end">
            <div className="flex gap-0.5">
              {QUICK_EMOJI.map((e) => (
                <button
                  key={e}
                  type="button"
                  className="rounded p-1 text-base transition hover:bg-accent"
                  onClick={() =>
                    startTransition(async () => {
                      await toggleReaction(message.id, e);
                      onReload();
                    })
                  }
                >
                  {e}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {onOpenThread && (
          <button
            type="button"
            className="inline-flex size-6 items-center justify-center rounded transition hover:bg-accent"
            onClick={() => onOpenThread(message.id)}
            aria-label="Responder na thread"
          >
            <MessageSquare className="size-3.5" />
          </button>
        )}

        {mine && (
          <>
            <button
              type="button"
              className="inline-flex size-6 items-center justify-center rounded transition hover:bg-accent"
              onClick={() => setEditing(true)}
              aria-label="Editar"
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              type="button"
              className="inline-flex size-6 items-center justify-center rounded text-muted-foreground transition hover:bg-accent hover:text-destructive"
              onClick={() =>
                startTransition(async () => {
                  await deleteMessage(message.id);
                  onReload();
                })
              }
              aria-label="Apagar"
            >
              <Trash2 className="size-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** Destaca @menções no texto. */
function renderBody(body: string) {
  return body.split(/(@[\wÀ-ÿ.-]+)/g).map((part, i) =>
    part.startsWith("@") ? (
      <span
        key={i}
        className="rounded bg-primary/15 px-1 font-medium text-primary-strong"
      >
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

function Composer({
  channelId,
  parentId,
  onSent,
  placeholder = "Escreva uma mensagem…  (@ para mencionar)",
}: {
  channelId: string;
  parentId?: string;
  onSent: () => void;
  placeholder?: string;
}) {
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    const value = body.trim();
    if (!value) return;
    setBody("");
    startTransition(async () => {
      try {
        await sendMessage({ channelId, body: value, parentId: parentId ?? null });
        onSent();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao enviar");
        setBody(value);
      }
    });
  }

  return (
    <div className="shrink-0 border-t p-3">
      <div className="flex gap-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={placeholder}
          className="min-h-11 flex-1 resize-none"
          rows={1}
        />
        <Button
          size="icon"
          className="size-11 shrink-0"
          disabled={pending || !body.trim()}
          onClick={submit}
          aria-label="Enviar mensagem"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </Button>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Enter envia · Shift+Enter quebra linha
      </p>
    </div>
  );
}

function ThreadPane({
  messageId,
  channelId,
  onClose,
}: {
  messageId: string;
  channelId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<Awaited<ReturnType<typeof loadThread>> | null>(
    null,
  );

  const reload = useCallback(async () => {
    setData(await loadThread(messageId));
  }, [messageId]);

  useEffect(() => {
    // carrega do servidor ao montar — sincronização externa, intencional
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  return (
    <aside className="flex w-96 shrink-0 flex-col border-l">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <h3 className="text-[15px] font-semibold">Thread</h3>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto size-8"
          onClick={onClose}
          aria-label="Fechar thread"
        >
          <X className="size-4" />
        </Button>
      </header>

      <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {!data ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <MessageList messages={[data.root]} onReload={reload} compact />
            <div className="my-2 flex items-center gap-2 px-2">
              <Separator className="flex-1" />
              <span className="text-[11px] text-muted-foreground">
                {data.replies.length}{" "}
                {data.replies.length === 1 ? "resposta" : "respostas"}
              </span>
              <Separator className="flex-1" />
            </div>
            <MessageList messages={data.replies} onReload={reload} compact />
          </>
        )}
      </div>

      <Composer
        channelId={channelId}
        parentId={messageId}
        onSent={reload}
        placeholder="Responder na thread…"
      />
    </aside>
  );
}

function DirectPicker({
  members,
  onPick,
}: {
  members: { id: string; name: string; avatarColor: string }[];
  onPick: (id: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="mt-0.5 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-muted-foreground transition hover:bg-sidebar-accent/60 hover:text-foreground">
        <Plus className="size-3.5" />
        Nova conversa
      </PopoverTrigger>
      <PopoverContent className="w-60 p-1" align="start">
        {members.map((m) => (
          <button
            key={m.id}
            type="button"
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition hover:bg-accent"
            onClick={async () => {
              setOpen(false);
              await onPick(m.id);
            }}
          >
            <Avatar className="size-5">
              <AvatarFallback
                className="text-[9px] font-semibold"
                style={{
                  backgroundColor: m.avatarColor,
                  color: readableOn(m.avatarColor),
                }}
              >
                {initials(m.name)}
              </AvatarFallback>
            </Avatar>
            {m.name}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function NewChannelDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (id: string) => Promise<void>;
}) {
  const { members, user } = useApp();
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (v) {
          setName("");
          setTopic("");
          setIsPrivate(false);
          setSelected([]);
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo canal</DialogTitle>
          <DialogDescription>
            Canais organizam conversas por tema, time ou projeto.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ch-name">Nome</Label>
            <div className="flex items-center gap-2">
              <Hash className="size-4 text-muted-foreground" />
              <Input
                id="ch-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="lançamento"
                autoFocus
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ch-topic">Assunto (opcional)</Label>
            <Input
              id="ch-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Do que se trata este canal?"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm">
            <Checkbox
              checked={isPrivate}
              onCheckedChange={(v) => setIsPrivate(!!v)}
            />
            <Lock className="size-3.5 text-muted-foreground" />
            Canal privado — só quem for convidado entra
          </label>

          <div className="space-y-1.5">
            <Label>Pessoas</Label>
            <div className="thin-scrollbar max-h-40 space-y-0.5 overflow-y-auto rounded-lg border p-1">
              {members
                .filter((m) => m.id !== user.id)
                .map((m) => (
                  <label
                    key={m.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm transition hover:bg-accent"
                  >
                    <Checkbox
                      checked={selected.includes(m.id)}
                      onCheckedChange={(v) =>
                        setSelected((s) =>
                          v ? [...s, m.id] : s.filter((x) => x !== m.id),
                        )
                      }
                    />
                    <Avatar className="size-5">
                      <AvatarFallback
                        className="text-[9px] font-semibold"
                        style={{
                          backgroundColor: m.avatarColor,
                          color: readableOn(m.avatarColor),
                        }}
                      >
                        {initials(m.name)}
                      </AvatarFallback>
                    </Avatar>
                    {m.name}
                  </label>
                ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={pending || !name.trim()}
            onClick={() =>
              startTransition(async () => {
                try {
                  const { id } = await createChannel({
                    name,
                    topic,
                    kind: isPrivate ? "PRIVATE" : "PUBLIC",
                    memberIds: selected,
                  });
                  onOpenChange(false);
                  await onCreated(id);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Erro ao criar");
                }
              })
            }
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Criar canal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BrowseChannelsDialog({
  open,
  onOpenChange,
  onJoined,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onJoined: (id: string) => Promise<void>;
}) {
  const [list, setList] = useState<
    { id: string; name: string; topic: string | null; memberCount: number }[] | null
  >(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setList(null);
    listDiscoverableChannels().then(setList);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Explorar canais</DialogTitle>
          <DialogDescription>
            Canais públicos do workspace em que você ainda não está.
          </DialogDescription>
        </DialogHeader>

        {list === null ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : list.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Você já participa de todos os canais públicos.
          </p>
        ) : (
          <ul className="thin-scrollbar max-h-72 space-y-1 overflow-y-auto">
            {list.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-2 rounded-lg border px-3 py-2"
              >
                <Hash className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.topic ?? `${c.memberCount} participantes`}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await joinChannel(c.id);
                      onOpenChange(false);
                      await onJoined(c.id);
                    })
                  }
                >
                  Entrar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MembersDialog({
  open,
  onOpenChange,
  channel,
  candidates,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  channel: ChannelDetail;
  candidates: { id: string; name: string; avatarColor: string }[];
  onChanged: () => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pessoas em {channel.name}</DialogTitle>
          <DialogDescription>
            {channel.members.length} no canal.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-1.5">
          {channel.members.map((m) => (
            <li key={m.id} className="flex items-center gap-2 text-sm">
              <Avatar className="size-7">
                <AvatarFallback
                  className="text-[10px] font-semibold"
                  style={{
                    backgroundColor: m.avatarColor,
                    color: readableOn(m.avatarColor),
                  }}
                >
                  {initials(m.name)}
                </AvatarFallback>
              </Avatar>
              <span className="flex-1">{m.name}</span>
              {m.isAdmin && (
                <span className="rounded bg-muted px-1.5 text-[10px] text-muted-foreground">
                  admin
                </span>
              )}
            </li>
          ))}
        </ul>

        {channel.kind !== "DIRECT" && candidates.length > 0 && (
          <>
            <Separator />
            <div className="space-y-1.5">
              <Label>Adicionar</Label>
              <div className="thin-scrollbar max-h-36 space-y-0.5 overflow-y-auto rounded-lg border p-1">
                {candidates.map((m) => (
                  <label
                    key={m.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm transition hover:bg-accent"
                  >
                    <Checkbox
                      checked={selected.includes(m.id)}
                      onCheckedChange={(v) =>
                        setSelected((s) =>
                          v ? [...s, m.id] : s.filter((x) => x !== m.id),
                        )
                      }
                    />
                    {m.name}
                  </label>
                ))}
              </div>
              <Button
                size="sm"
                disabled={pending || selected.length === 0}
                onClick={() =>
                  startTransition(async () => {
                    await addChannelMembers(channel.id, selected);
                    setSelected([]);
                    onChanged();
                    onOpenChange(false);
                  })
                }
              >
                <UserPlus className="size-3.5" />
                Adicionar ao canal
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

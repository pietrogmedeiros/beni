"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { currentWorkspace, requireUser } from "@/lib/auth";
import { publish } from "@/server/chat-bus";

/* ————— Tipos enviados ao client ————— */

export type ChannelSummary = {
  id: string;
  kind: string;
  name: string;
  topic: string | null;
  memberCount: number;
  unread: number;
  mentions: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  /** Para DMs: a outra pessoa da conversa */
  partner: { id: string; name: string; avatarColor: string } | null;
};

export type MessageDTO = {
  id: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  parentId: string | null;
  replyCount: number;
  lastReplyAt: string | null;
  author: { id: string; name: string; avatarColor: string };
  reactions: { emoji: string; count: number; mine: boolean }[];
  task: { id: string; number: number; title: string; projectKey: string } | null;
};

/* ————— Ajudantes ————— */

async function memberOrThrow(channelId: string) {
  const user = await requireUser();
  const membership = await db.channelMember.findUnique({
    where: { channelId_userId: { channelId, userId: user.id } },
    include: { channel: true },
  });
  if (!membership) throw new Error("Você não participa desta conversa");
  return { user, membership, channel: membership.channel };
}

/** Nome exibido de um canal (DMs usam o nome da outra pessoa). */
function displayName(
  channel: { kind: string; name: string | null },
  partnerName?: string | null,
) {
  if (channel.kind === "DIRECT") return partnerName ?? "Conversa";
  return channel.name ?? "canal";
}

/* ————— Leitura ————— */

export async function listChannels(): Promise<ChannelSummary[]> {
  const user = await requireUser();
  const workspace = await currentWorkspace();

  const memberships = await db.channelMember.findMany({
    where: { userId: user.id, channel: { workspaceId: workspace.id, archived: false } },
    include: {
      channel: {
        include: {
          _count: { select: { members: true } },
          members: { include: { user: true } },
          messages: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
    },
  });

  const summaries = await Promise.all(
    memberships.map(async (m) => {
      const partner =
        m.channel.kind === "DIRECT"
          ? (m.channel.members.find((x) => x.userId !== user.id)?.user ?? null)
          : null;

      const [unread, mentions] = await Promise.all([
        db.message.count({
          where: {
            channelId: m.channelId,
            createdAt: { gt: m.lastReadAt },
            authorId: { not: user.id },
          },
        }),
        db.mention.count({
          where: { userId: user.id, readAt: null, message: { channelId: m.channelId } },
        }),
      ]);

      const last = m.channel.messages[0];

      return {
        id: m.channelId,
        kind: m.channel.kind as string,
        name: displayName(m.channel, partner?.name),
        topic: m.channel.topic,
        memberCount: m.channel._count.members,
        unread,
        mentions,
        lastMessageAt: last?.createdAt.toISOString() ?? null,
        lastMessagePreview: last ? last.body.slice(0, 80) : null,
        partner: partner
          ? { id: partner.id, name: partner.name, avatarColor: partner.avatarColor }
          : null,
      } satisfies ChannelSummary;
    }),
  );

  return summaries.sort((a, b) =>
    (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? ""),
  );
}

/** Canais públicos do workspace que o usuário ainda não segue. */
export async function listDiscoverableChannels() {
  const user = await requireUser();
  const workspace = await currentWorkspace();

  const channels = await db.channel.findMany({
    where: {
      workspaceId: workspace.id,
      kind: "PUBLIC",
      archived: false,
      members: { none: { userId: user.id } },
    },
    include: { _count: { select: { members: true } } },
    orderBy: { name: "asc" },
  });

  return channels.map((c) => ({
    id: c.id,
    name: c.name ?? "canal",
    topic: c.topic,
    memberCount: c._count.members,
  }));
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function toMessageDTO(m: any, userId: string): MessageDTO {
  const grouped = new Map<string, { count: number; mine: boolean }>();
  for (const r of m.reactions ?? []) {
    const current = grouped.get(r.emoji) ?? { count: 0, mine: false };
    grouped.set(r.emoji, {
      count: current.count + 1,
      mine: current.mine || r.userId === userId,
    });
  }

  return {
    id: m.id,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
    editedAt: m.editedAt?.toISOString() ?? null,
    parentId: m.parentId,
    replyCount: m._count?.replies ?? 0,
    lastReplyAt: m.replies?.[0]?.createdAt?.toISOString() ?? null,
    author: {
      id: m.author.id,
      name: m.author.name,
      avatarColor: m.author.avatarColor,
    },
    reactions: [...grouped.entries()].map(([emoji, v]) => ({ emoji, ...v })),
    task: m.task
      ? {
          id: m.task.id,
          number: m.task.number,
          title: m.task.title,
          projectKey: m.task.project.key,
        }
      : null,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const messageInclude = {
  author: true,
  reactions: true,
  _count: { select: { replies: true } },
  replies: { orderBy: { createdAt: "desc" as const }, take: 1 },
} as const;

async function withTasks(messages: { taskId: string | null }[]) {
  const ids = messages.map((m) => m.taskId).filter(Boolean) as string[];
  if (ids.length === 0) return new Map();
  const tasks = await db.task.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      number: true,
      title: true,
      project: { select: { key: true } },
    },
  });
  return new Map(tasks.map((t) => [t.id, t]));
}

export async function loadChannel(channelId: string) {
  const { user, membership, channel } = await memberOrThrow(channelId);

  const [messages, members] = await Promise.all([
    db.message.findMany({
      where: { channelId, parentId: null },
      include: messageInclude,
      orderBy: { createdAt: "asc" },
      take: 200,
    }),
    db.channelMember.findMany({
      where: { channelId },
      include: { user: true },
    }),
  ]);

  const taskMap = await withTasks(messages);
  const partner =
    channel.kind === "DIRECT"
      ? (members.find((m) => m.userId !== user.id)?.user ?? null)
      : null;

  return {
    id: channel.id,
    kind: channel.kind as string,
    name: displayName(channel, partner?.name),
    topic: channel.topic,
    isAdmin: membership.isAdmin,
    members: members.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      avatarColor: m.user.avatarColor,
      isAdmin: m.isAdmin,
    })),
    messages: messages.map((m) =>
      toMessageDTO({ ...m, task: taskMap.get(m.taskId ?? "") }, user.id),
    ),
  };
}

export type ChannelDetail = NonNullable<Awaited<ReturnType<typeof loadChannel>>>;

export async function loadThread(messageId: string) {
  const root = await db.message.findUnique({
    where: { id: messageId },
    include: messageInclude,
  });
  if (!root) throw new Error("Mensagem não encontrada");
  const { user } = await memberOrThrow(root.channelId);

  const replies = await db.message.findMany({
    where: { parentId: messageId },
    include: messageInclude,
    orderBy: { createdAt: "asc" },
  });

  const taskMap = await withTasks([root, ...replies]);
  return {
    root: toMessageDTO({ ...root, task: taskMap.get(root.taskId ?? "") }, user.id),
    replies: replies.map((r) =>
      toMessageDTO({ ...r, task: taskMap.get(r.taskId ?? "") }, user.id),
    ),
  };
}

/* ————— Escrita ————— */

const sendSchema = z.object({
  channelId: z.string().min(1),
  body: z.string().min(1, "Escreva algo").max(4000),
  parentId: z.string().nullable().optional(),
  taskId: z.string().nullable().optional(),
});

/** Extrai @mentions do texto e resolve para membros do canal. */
async function resolveMentions(body: string, channelId: string) {
  const handles = [...body.matchAll(/@([\wÀ-ÿ.-]+)/g)].map((m) =>
    m[1].toLowerCase(),
  );
  if (handles.length === 0) return [];

  const members = await db.channelMember.findMany({
    where: { channelId },
    include: { user: true },
  });

  return members
    .filter((m) => {
      const first = m.user.name.split(" ")[0].toLowerCase();
      const handle = m.user.email.split("@")[0].toLowerCase();
      return handles.includes(first) || handles.includes(handle);
    })
    .map((m) => m.userId);
}

export async function sendMessage(input: z.input<typeof sendSchema>) {
  const data = sendSchema.parse(input);
  const { user } = await memberOrThrow(data.channelId);

  const message = await db.message.create({
    data: {
      channelId: data.channelId,
      authorId: user.id,
      body: data.body.trim(),
      parentId: data.parentId || null,
      taskId: data.taskId || null,
    },
  });

  const mentioned = (await resolveMentions(data.body, data.channelId)).filter(
    (id) => id !== user.id,
  );
  if (mentioned.length > 0) {
    await db.mention.createMany({
      data: mentioned.map((userId) => ({ messageId: message.id, userId })),
      skipDuplicates: true,
    });
  }

  await db.channelMember.update({
    where: { channelId_userId: { channelId: data.channelId, userId: user.id } },
    data: { lastReadAt: new Date() },
  });

  publish({
    type: "message",
    channelId: data.channelId,
    messageId: message.id,
    parentId: message.parentId,
  });

  return { id: message.id };
}

export async function editMessage(messageId: string, body: string) {
  const user = await requireUser();
  const message = await db.message.findUnique({ where: { id: messageId } });
  if (!message || message.authorId !== user.id) {
    throw new Error("Você só pode editar suas mensagens");
  }
  await db.message.update({
    where: { id: messageId },
    data: { body: body.trim(), editedAt: new Date() },
  });
  publish({ type: "message.updated", channelId: message.channelId, messageId });
}

export async function deleteMessage(messageId: string) {
  const user = await requireUser();
  const message = await db.message.findUnique({ where: { id: messageId } });
  if (!message || message.authorId !== user.id) {
    throw new Error("Você só pode apagar suas mensagens");
  }
  await db.message.delete({ where: { id: messageId } });
  publish({ type: "message.deleted", channelId: message.channelId, messageId });
}

export async function toggleReaction(messageId: string, emoji: string) {
  const user = await requireUser();
  const message = await db.message.findUnique({ where: { id: messageId } });
  if (!message) return;
  await memberOrThrow(message.channelId);

  const existing = await db.reaction.findUnique({
    where: { messageId_userId_emoji: { messageId, userId: user.id, emoji } },
  });

  if (existing) {
    await db.reaction.delete({ where: { id: existing.id } });
  } else {
    await db.reaction.create({ data: { messageId, userId: user.id, emoji } });
  }

  publish({ type: "reaction", channelId: message.channelId, messageId });
}

export async function markChannelRead(channelId: string) {
  const { user } = await memberOrThrow(channelId);
  await db.channelMember.update({
    where: { channelId_userId: { channelId, userId: user.id } },
    data: { lastReadAt: new Date() },
  });
  await db.mention.updateMany({
    where: { userId: user.id, readAt: null, message: { channelId } },
    data: { readAt: new Date() },
  });
}

/* ————— Canais ————— */

export async function createChannel(input: {
  name: string;
  topic?: string | null;
  kind: "PUBLIC" | "PRIVATE";
  memberIds: string[];
  projectId?: string | null;
}) {
  const user = await requireUser();
  const workspace = await currentWorkspace();

  const name = input.name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\wÀ-ÿ-]/g, "")
    .slice(0, 40);
  if (!name) throw new Error("Informe um nome para o canal");

  const memberIds = [...new Set([user.id, ...input.memberIds])];

  const channel = await db.channel.create({
    data: {
      workspaceId: workspace.id,
      kind: input.kind,
      name,
      topic: input.topic?.trim() || null,
      projectId: input.projectId || null,
      createdById: user.id,
      members: {
        create: memberIds.map((userId) => ({
          userId,
          isAdmin: userId === user.id,
        })),
      },
    },
  });

  publish({ type: "channel", channelId: channel.id });
  revalidatePath("/chat");
  return { id: channel.id };
}

/** Abre (ou cria) a conversa direta com outra pessoa. */
export async function openDirectChannel(otherUserId: string) {
  const user = await requireUser();
  const workspace = await currentWorkspace();
  if (otherUserId === user.id) throw new Error("Escolha outra pessoa");

  const existing = await db.channel.findFirst({
    where: {
      workspaceId: workspace.id,
      kind: "DIRECT",
      AND: [
        { members: { some: { userId: user.id } } },
        { members: { some: { userId: otherUserId } } },
      ],
    },
  });
  if (existing) return { id: existing.id };

  const channel = await db.channel.create({
    data: {
      workspaceId: workspace.id,
      kind: "DIRECT",
      createdById: user.id,
      members: {
        create: [{ userId: user.id }, { userId: otherUserId }],
      },
    },
  });

  publish({ type: "channel", channelId: channel.id });
  return { id: channel.id };
}

export async function joinChannel(channelId: string) {
  const user = await requireUser();
  const workspace = await currentWorkspace();
  const channel = await db.channel.findFirst({
    where: { id: channelId, workspaceId: workspace.id, kind: "PUBLIC" },
  });
  if (!channel) throw new Error("Canal não encontrado");

  await db.channelMember.upsert({
    where: { channelId_userId: { channelId, userId: user.id } },
    update: {},
    create: { channelId, userId: user.id },
  });
  publish({ type: "channel", channelId });
  revalidatePath("/chat");
}

export async function leaveChannel(channelId: string) {
  const user = await requireUser();
  await db.channelMember.deleteMany({ where: { channelId, userId: user.id } });
  publish({ type: "channel", channelId });
  revalidatePath("/chat");
}

export async function addChannelMembers(channelId: string, userIds: string[]) {
  await memberOrThrow(channelId);
  await db.channelMember.createMany({
    data: userIds.map((userId) => ({ channelId, userId })),
    skipDuplicates: true,
  });
  publish({ type: "channel", channelId });
}

export async function updateChannel(
  channelId: string,
  input: { name?: string; topic?: string | null },
) {
  const { membership } = await memberOrThrow(channelId);
  if (!membership.isAdmin) throw new Error("Só administradores do canal podem editar");
  await db.channel.update({
    where: { id: channelId },
    data: {
      name: input.name?.trim().toLowerCase().replace(/\s+/g, "-"),
      topic: input.topic,
    },
  });
  publish({ type: "channel", channelId });
}

/** Total de não lidas — usado no selo da barra lateral. */
export async function unreadTotals() {
  const user = await requireUser();
  const workspace = await currentWorkspace();

  const memberships = await db.channelMember.findMany({
    where: { userId: user.id, channel: { workspaceId: workspace.id, archived: false } },
    select: { channelId: true, lastReadAt: true },
  });

  let unread = 0;
  for (const m of memberships) {
    unread += await db.message.count({
      where: {
        channelId: m.channelId,
        createdAt: { gt: m.lastReadAt },
        authorId: { not: user.id },
      },
    });
  }

  const mentions = await db.mention.count({
    where: { userId: user.id, readAt: null },
  });

  return { unread, mentions };
}

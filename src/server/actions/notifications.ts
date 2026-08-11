"use server";

import { db } from "@/lib/db";
import { currentWorkspace, requireUser } from "@/lib/auth";

export type RecentTask = {
  id: string;
  title: string;
  ref: string;
  projectColor: string;
  statusColor: string;
  updatedAt: string;
};

/** Tarefas mexidas recentemente no workspace — alimenta o menu "Recentes". */
export async function recentTasks(limit = 8): Promise<RecentTask[]> {
  const workspace = await currentWorkspace();
  const tasks = await db.task.findMany({
    where: { archived: false, project: { workspaceId: workspace.id } },
    include: {
      status: { select: { color: true } },
      project: { select: { key: true, color: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  return tasks.map((t) => ({
    id: t.id,
    title: t.title,
    ref: `${t.project.key}-${t.number}`,
    projectColor: t.project.color,
    statusColor: t.status.color,
    updatedAt: t.updatedAt.toISOString(),
  }));
}

export type NotificationItem = {
  id: string;
  kind: "mention" | "approval" | "overdue";
  title: string;
  detail: string;
  taskId: string | null;
  href: string | null;
  createdAt: string;
};

/**
 * Central de avisos: menções não lidas no chat, aprovações que você pediu e
 * já foram respondidas, e suas tarefas com prazo vencido.
 */
export async function notifications(): Promise<NotificationItem[]> {
  const user = await requireUser();
  const workspace = await currentWorkspace();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [mentions, approvals, overdue] = await Promise.all([
    db.mention.findMany({
      where: { userId: user.id, readAt: null },
      include: {
        message: {
          include: {
            author: { select: { name: true } },
            channel: { select: { name: true, kind: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    db.approval.findMany({
      where: {
        requestedById: user.id,
        status: { in: ["APPROVED", "REJECTED"] },
        decidedAt: { not: null },
        task: { project: { workspaceId: workspace.id } },
      },
      include: { task: { select: { id: true, title: true } } },
      orderBy: { decidedAt: "desc" },
      take: 5,
    }),
    db.task.findMany({
      where: {
        assigneeId: user.id,
        archived: false,
        dueDate: { lt: today },
        status: { category: { notIn: ["DONE", "CANCELED"] } },
        project: { workspaceId: workspace.id },
      },
      include: { project: { select: { key: true } } },
      orderBy: { dueDate: "asc" },
      take: 10,
    }),
  ]);

  const items: NotificationItem[] = [
    ...mentions.map((m) => ({
      id: `mention:${m.id}`,
      kind: "mention" as const,
      title: `${m.message.author.name} mencionou você`,
      detail: `#${m.message.channel.name ?? "conversa"} · ${m.message.body.slice(0, 60)}`,
      taskId: null,
      href: "/chat",
      createdAt: m.createdAt.toISOString(),
    })),
    ...approvals.map((a) => ({
      id: `approval:${a.id}`,
      kind: "approval" as const,
      title:
        a.status === "APPROVED"
          ? `${a.approverName ?? "O aprovador"} aprovou`
          : `${a.approverName ?? "O aprovador"} reprovou`,
      detail: a.task.title,
      taskId: a.task.id,
      href: null,
      createdAt: (a.decidedAt ?? a.createdAt).toISOString(),
    })),
    ...overdue.map((t) => ({
      id: `overdue:${t.id}`,
      kind: "overdue" as const,
      title: "Prazo vencido",
      detail: `${t.project.key}-${t.number} · ${t.title}`,
      taskId: t.id,
      href: null,
      createdAt: (t.dueDate ?? t.updatedAt).toISOString(),
    })),
  ];

  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Marca todas as menções como lidas (botão "marcar tudo como lido"). */
export async function markAllNotificationsRead() {
  const user = await requireUser();
  await db.mention.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
}

/** Link de convite: quem receber cria a própria conta. */
export async function inviteLink() {
  const workspace = await currentWorkspace();
  return { workspaceName: workspace.name, path: "/register" };
}

import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { currentWorkspace, requireUser } from "@/lib/auth";
import { filtroDeProjetos, projetosPermitidos } from "@/server/escopo";
import { searchTaskIds } from "@/server/search";

/* ————— Tipos serializáveis enviados para os componentes client ————— */

export type UserDTO = {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
  /** Nulo enquanto o dono do endereço não clicar no link de confirmação. */
  emailVerifiedAt?: string | null;
  /** Mascote escolhido como avatar, se houver. */
  avatarMascot?: string | null;
  /**
   * Endereço da foto de perfil, já com o carimbo da última troca. Nulo quando
   * a pessoa não subiu foto.
   */
  avatarFoto?: string | null;
};

/** Monta o endereço da foto com o carimbo que invalida o cache do navegador. */
export function urlDaFoto(userId: string, updatedAt: Date | null | undefined) {
  return updatedAt ? `/api/avatar/${userId}?v=${updatedAt.getTime()}` : null;
}

export type TagDTO = { id: string; name: string; color: string };

export type StatusDTO = {
  id: string;
  name: string;
  color: string;
  category: string;
  order: number;
};

export type SprintDTO = {
  id: string;
  name: string;
  goal: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  order: number;
};

export type TaskDTO = {
  id: string;
  number: number;
  projectId: string;
  projectKey: string;
  projectName: string;
  projectColor: string;
  title: string;
  description: string | null;
  statusId: string;
  statusName: string;
  statusColor: string;
  statusCategory: string;
  sprintId: string | null;
  parentId: string | null;
  type: string;
  priority: string;
  assignee: UserDTO | null;
  startDate: string | null;
  dueDate: string | null;
  estimate: number | null;
  points: number | null;
  progress: number;
  order: number;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  tags: TagDTO[];
  subtaskCount: number;
  doneSubtaskCount: number;
  commentCount: number;
  blockedByCount: number;
};

const taskInclude = {
  status: true,
  assignee: true,
  project: { select: { key: true, name: true, color: true } },
  tags: { include: { tag: true } },
  subtasks: { select: { id: true, status: { select: { category: true } } } },
  _count: { select: { comments: true, blockedBy: true } },
} as const;

/* eslint-disable @typescript-eslint/no-explicit-any */
export function toTaskDTO(t: any): TaskDTO {
  return {
    id: t.id,
    number: t.number,
    projectId: t.projectId,
    projectKey: t.project?.key ?? "",
    projectName: t.project?.name ?? "",
    projectColor: t.project?.color ?? "#eab308",
    title: t.title,
    description: t.description,
    statusId: t.statusId,
    statusName: t.status?.name ?? "",
    statusColor: t.status?.color ?? "#94a3b8",
    statusCategory: t.status?.category ?? "TODO",
    sprintId: t.sprintId,
    parentId: t.parentId,
    type: t.type,
    priority: t.priority,
    assignee: t.assignee
      ? {
          id: t.assignee.id,
          name: t.assignee.name,
          email: t.assignee.email,
          avatarColor: t.assignee.avatarColor,
        }
      : null,
    startDate: t.startDate?.toISOString() ?? null,
    dueDate: t.dueDate?.toISOString() ?? null,
    estimate: t.estimate,
    points: t.points,
    progress: t.progress,
    order: t.order,
    completedAt: t.completedAt?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    tags: (t.tags ?? []).map((tt: any) => ({
      id: tt.tag.id,
      name: tt.tag.name,
      color: tt.tag.color,
    })),
    subtaskCount: t.subtasks?.length ?? 0,
    doneSubtaskCount:
      t.subtasks?.filter((s: any) => s.status?.category === "DONE").length ?? 0,
    commentCount: t._count?.comments ?? 0,
    blockedByCount: t._count?.blockedBy ?? 0,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/* ————— Loaders ————— */

export const getWorkspaceContext = cache(async () => {
  const user = await requireUser();
  const workspace = await currentWorkspace();

  const permitidos = await projetosPermitidos();

  const [projects, members, tags] = await Promise.all([
    db.project.findMany({
      where: { ...(await filtroDeProjetos()), archived: false },
      orderBy: { order: "asc" },
      include: {
        _count: { select: { tasks: true } },
        statuses: { orderBy: { order: "asc" } },
        sprints: { orderBy: { order: "asc" } },
      },
    }),
    db.membership.findMany({
      // Para quem é do workspace, o time inteiro. Para convidado, só quem tem
      // a ver com os projetos dele: entregar a lista completa daria ao cliente
      // o organograma da empresa de brinde, e ele nem precisa disso para
      // atribuir tarefa dentro do projeto que recebeu.
      where: {
        workspaceId: workspace.id,
        ...(permitidos === null
          ? {}
          : {
              user: {
                OR: [
                  { assignedTasks: { some: { projectId: { in: permitidos } } } },
                  { reportedTasks: { some: { projectId: { in: permitidos } } } },
                  { acessos: { some: { projectId: { in: permitidos } } } },
                ],
              },
            }),
      },
      // o carimbo da foto vem junto para montar o endereço com `?v=`; os bytes
      // ficam onde estão, e são buscados pela rota só quando a imagem carrega
      include: { user: { include: { avatarFoto: { select: { updatedAt: true } } } } },
    }),
    db.tag.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarColor: user.avatarColor,
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      avatarMascot: user.avatarMascot,
      avatarFoto: urlDaFoto(user.id, user.avatarFoto?.updatedAt),
    } satisfies UserDTO,
    workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug },
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      key: p.key,
      color: p.color,
      icon: p.icon,
      description: p.description,
      taskCount: p._count.tasks,
      statuses: p.statuses.map((s) => ({
        id: s.id,
        name: s.name,
        color: s.color,
        category: s.category as string,
        order: s.order,
      })) satisfies StatusDTO[],
      sprints: p.sprints.map((s) => ({
        id: s.id,
        name: s.name,
        goal: s.goal,
        status: s.status as string,
        startDate: s.startDate?.toISOString() ?? null,
        endDate: s.endDate?.toISOString() ?? null,
        order: s.order,
      })) satisfies SprintDTO[],
    })),
    members: members.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      avatarColor: m.user.avatarColor,
      avatarMascot: m.user.avatarMascot,
      avatarFoto: urlDaFoto(m.user.id, m.user.avatarFoto?.updatedAt),
      role: m.role,
    })),
    tags: tags.map((t) => ({ id: t.id, name: t.name, color: t.color })),
  };
});

export const getProject = cache(async (projectId: string) => {
  const project = await db.project.findFirst({
    where: { id: projectId, ...(await filtroDeProjetos()) },
    include: {
      statuses: { orderBy: { order: "asc" } },
      sprints: { orderBy: { order: "asc" } },
      repositories: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!project) return null;

  return {
    id: project.id,
    name: project.name,
    key: project.key,
    color: project.color,
    icon: project.icon,
    description: project.description,
    startDate: project.startDate?.toISOString() ?? null,
    endDate: project.endDate?.toISOString() ?? null,
    statuses: project.statuses.map((s) => ({
      id: s.id,
      name: s.name,
      color: s.color,
      category: s.category as string,
      order: s.order,
    })) satisfies StatusDTO[],
    sprints: project.sprints.map((s) => ({
      id: s.id,
      name: s.name,
      goal: s.goal,
      status: s.status as string,
      startDate: s.startDate?.toISOString() ?? null,
      endDate: s.endDate?.toISOString() ?? null,
      order: s.order,
    })) satisfies SprintDTO[],
    repositories: project.repositories.map((r) => ({
      id: r.id,
      owner: r.owner,
      name: r.name,
      htmlUrl: r.htmlUrl,
      description: r.description,
      defaultBranch: r.defaultBranch,
      isPrivate: r.isPrivate,
    })),
  };
});

export const getProjectTasks = cache(async (projectId: string) => {
  const tasks = await db.task.findMany({
    where: {
      projectId,
      archived: false,
      project: await filtroDeProjetos(),
    },
    include: taskInclude,
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
  return tasks.map(toTaskDTO);
});

export const getTaskDetail = cache(async (taskId: string) => {
  const task = await db.task.findFirst({
    where: { id: taskId, project: await filtroDeProjetos() },
    include: {
      ...taskInclude,
      subtasks: {
        include: { status: true, assignee: true },
        orderBy: { order: "asc" },
      },
      comments: { include: { author: true }, orderBy: { createdAt: "asc" } },
      blockedBy: { include: { dependsOn: { include: { status: true } } } },
      blocking: { include: { task: { include: { status: true } } } },
      activities: {
        include: { user: true },
        orderBy: { createdAt: "desc" },
        take: 30,
      },
      approvals: {
        include: { requestedBy: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
      githubLinks: {
        include: { repo: { select: { owner: true, name: true } } },
        orderBy: { number: "asc" },
      },
    },
  });
  if (!task) return null;

  return {
    ...toTaskDTO({ ...task, subtasks: task.subtasks }),
    subtasks: task.subtasks.map((s) => ({
      id: s.id,
      number: s.number,
      title: s.title,
      statusId: s.statusId,
      statusName: s.status.name,
      statusColor: s.status.color,
      statusCategory: s.status.category as string,
      priority: s.priority as string,
      assignee: s.assignee
        ? {
            id: s.assignee.id,
            name: s.assignee.name,
            email: s.assignee.email,
            avatarColor: s.assignee.avatarColor,
          }
        : null,
    })),
    comments: task.comments.map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      /** Comentários vindos de um link público não têm conta associada. */
      isGuest: !c.author,
      author: c.author
        ? {
            id: c.author.id,
            name: c.author.name,
            email: c.author.email,
            avatarColor: c.author.avatarColor,
          }
        : {
            id: `guest:${c.id}`,
            name: c.guestName ?? "Visitante",
            email: c.guestEmail ?? "",
            avatarColor: "#94a3b8",
          },
    })),
    dependencies: {
      blockedBy: task.blockedBy.map((d) => ({
        id: d.id,
        type: d.type as string,
        task: {
          id: d.dependsOn.id,
          number: d.dependsOn.number,
          title: d.dependsOn.title,
          statusName: d.dependsOn.status.name,
          statusColor: d.dependsOn.status.color,
          statusCategory: d.dependsOn.status.category as string,
        },
      })),
      blocking: task.blocking.map((d) => ({
        id: d.id,
        type: d.type as string,
        task: {
          id: d.task.id,
          number: d.task.number,
          title: d.task.title,
          statusName: d.task.status.name,
          statusColor: d.task.status.color,
          statusCategory: d.task.status.category as string,
        },
      })),
    },
    githubLinks: task.githubLinks.map((l) => ({
      id: l.id,
      type: l.type as string,
      number: l.number,
      title: l.title,
      state: l.state,
      htmlUrl: l.htmlUrl,
      author: l.author,
      syncedAt: l.syncedAt.toISOString(),
      repo: `${l.repo.owner}/${l.repo.name}`,
    })),
    approvals: task.approvals.map((a) => ({
      id: a.id,
      token: a.token,
      status: a.status as string,
      message: a.message,
      approverName: a.approverName,
      approverEmail: a.approverEmail,
      approverComment: a.approverComment,
      decidedAt: a.decidedAt?.toISOString() ?? null,
      expiresAt: a.expiresAt?.toISOString() ?? null,
      createdAt: a.createdAt.toISOString(),
      requestedBy: a.requestedBy,
    })),
    activities: task.activities.map((a) => ({
      id: a.id,
      action: a.action,
      meta: a.meta as Record<string, unknown> | null,
      createdAt: a.createdAt.toISOString(),
      user: a.user
        ? { id: a.user.id, name: a.user.name, avatarColor: a.user.avatarColor }
        : null,
    })),
  };
});

export type TaskDetail = NonNullable<Awaited<ReturnType<typeof getTaskDetail>>>;

export const getMyTasks = cache(async () => {
  const user = await requireUser();
  const tasks = await db.task.findMany({
    where: {
      assigneeId: user.id,
      archived: false,
      project: { ...(await filtroDeProjetos()), archived: false },
    },
    include: taskInclude,
    orderBy: [{ dueDate: "asc" }, { order: "asc" }],
  });
  return tasks.map(toTaskDTO);
});

export const getWorkspaceOverview = cache(async () => {
  const user = await requireUser();

  const [tasks, projects, recentActivity] = await Promise.all([
    db.task.findMany({
      where: {
        archived: false,
        project: { ...(await filtroDeProjetos()), archived: false },
      },
      include: taskInclude,
      orderBy: { updatedAt: "desc" },
    }),
    db.project.findMany({
      where: { ...(await filtroDeProjetos()), archived: false },
      orderBy: { order: "asc" },
      include: {
        statuses: true,
        tasks: {
          where: { archived: false },
          select: {
            id: true,
            dueDate: true,
            completedAt: true,
            status: { select: { category: true } },
          },
        },
      },
    }),
    db.activity.findMany({
      where: { project: await filtroDeProjetos() },
      include: {
        user: true,
        task: { select: { id: true, number: true, title: true } },
        project: { select: { id: true, name: true, key: true, color: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
  ]);

  return {
    userId: user.id,
    tasks: tasks.map(toTaskDTO),
    projects: projects.map((p) => {
      const total = p.tasks.length;
      const done = p.tasks.filter((t) => t.status.category === "DONE").length;
      const overdue = p.tasks.filter(
        (t) =>
          t.dueDate &&
          t.status.category !== "DONE" &&
          t.dueDate < new Date(new Date().setHours(0, 0, 0, 0)),
      ).length;
      return {
        id: p.id,
        name: p.name,
        key: p.key,
        color: p.color,
        icon: p.icon,
        total,
        done,
        overdue,
        progress: total ? Math.round((done / total) * 100) : 0,
      };
    }),
    activity: recentActivity.map((a) => ({
      id: a.id,
      action: a.action,
      meta: a.meta as Record<string, unknown> | null,
      createdAt: a.createdAt.toISOString(),
      user: a.user ? { id: a.user.id, name: a.user.name, avatarColor: a.user.avatarColor } : null,
      task: a.task,
      project: a.project,
    })),
  };
});

export const searchTasks = cache(async (term: string) => {
  const workspace = await currentWorkspace();
  const value = term.trim();
  if (!value) return [];

  // 1) Elasticsearch, quando configurado: acha por radical ("integrar" encontra
  //    "integrações") e busca também dentro dos comentários.
  const ids = await searchTaskIds(workspace.id, value);

  if (ids) {
    if (ids.length === 0) return [];
    const found = await db.task.findMany({
      where: { id: { in: ids }, project: await filtroDeProjetos() },
      include: taskInclude,
    });
    // preserva a ordem de relevância devolvida pelo índice
    const byId = new Map(found.map((t) => [t.id, t]));
    return ids
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((t) => toTaskDTO(t));
  }

  // 2) Sem índice (ou índice fora do ar): busca literal no Postgres.
  const tasks = await db.task.findMany({
    where: {
      archived: false,
      project: await filtroDeProjetos(),
      OR: [
        { title: { contains: value, mode: "insensitive" } },
        { description: { contains: value, mode: "insensitive" } },
      ],
    },
    include: taskInclude,
    take: 20,
    orderBy: { updatedAt: "desc" },
  });
  return tasks.map(toTaskDTO);
});

export const getProjectDependencies = cache(async (projectId: string) => {
  const deps = await db.dependency.findMany({
    where: { task: { projectId, project: await filtroDeProjetos() } },
    select: { taskId: true, dependsOnId: true },
  });
  return deps;
});

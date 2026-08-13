import "server-only";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { db } from "@/lib/db";
import type { ApiCaller } from "@/server/api-auth";
import { taskJson, taskOf, taskShape } from "@/server/api-core";
import { createTaskViaApi, updateTaskViaApi } from "@/server/api-tasks";
import { searchTaskIds } from "@/server/search";
import { detectBulkMode, MAX_BULK_TASKS, parseBulkTasks, type BulkMode } from "@/lib/bulk-parse";
import { DEFAULT_STATUSES, PALETTE } from "@/lib/constants";
import { projectKeyFrom } from "@/lib/utils";

/**
 * Servidor MCP remoto — é o que o Claude na web enxerga.
 *
 * Mora dentro do Beni de propósito. O conector da web precisa de um endereço
 * público em HTTP, e o servidor por stdio (`~/beni-mcp`) só serve para o
 * Claude que roda na máquina da pessoa. Aqui as ferramentas chamam o banco
 * direto, sem dar a volta pela própria API por HTTP — numa VM lenta, essa
 * volta custaria uma ida à rede em cada chamada.
 */

type TaskShaped = Parameters<typeof taskJson>[0];

const PRIORIDADE: Record<string, string> = {
  URGENT: "urgente",
  HIGH: "alta",
  MEDIUM: "média",
  LOW: "baixa",
  NONE: "—",
};

function linha(task: TaskShaped) {
  const t = taskJson(task);
  const partes = [t.ref, t.title, `[${t.status}]`, t.assignee ? `@${t.assignee.name}` : "sem responsável"];
  if (t.priority !== "NONE") partes.push(`prioridade ${PRIORIDADE[t.priority] ?? t.priority}`);
  if (t.dueDate) partes.push(`prazo ${t.dueDate}`);
  if (t.points) partes.push(`${t.points} pts`);
  if (t.tags.length) partes.push(t.tags.map((x) => `#${x}`).join(" "));
  return partes.join(" · ");
}

function texto(value: string) {
  return { content: [{ type: "text" as const, text: value }] };
}

async function responder(fn: () => Promise<string>) {
  try {
    return texto(await fn());
  } catch (error) {
    return { ...texto(`Erro: ${error instanceof Error ? error.message : String(error)}`), isError: true };
  }
}

export function buildMcpServer(caller: ApiCaller) {
  const server = new McpServer(
    { name: "beni", version: "1.0.0" },
    {
      instructions:
        "Beni é o gerenciador de projetos, tarefas e backlog do usuário. Use beni_projetos para " +
        "descobrir projetos e os nomes de status válidos antes de criar ou mover tarefas. Tarefas " +
        "podem ser citadas pela referência curta (ex.: WEB-12) ou pelo id.",
    },
  );

  server.registerTool(
    "beni_workspace",
    {
      title: "Workspace e time",
      description: "Workspace conectado, quem é você e os integrantes do time com nome e e-mail.",
      inputSchema: {},
    },
    async () =>
      responder(async () => {
        const [workspace, members] = await Promise.all([
          db.workspace.findUnique({ where: { id: caller.workspaceId }, select: { name: true } }),
          db.membership.findMany({
            where: { workspaceId: caller.workspaceId },
            include: { user: { select: { name: true, email: true } } },
          }),
        ]);
        const time = members.map((m) => `  ${m.user.name} <${m.user.email}> — ${m.role}`).join("\n");
        return `Workspace: ${workspace?.name}\nVocê: ${caller.userName}\n\nTime:\n${time}`;
      }),
  );

  server.registerTool(
    "beni_projetos",
    {
      title: "Projetos",
      description: "Projetos com chave (ex.: WEB), total de tarefas, status válidos e sprints.",
      inputSchema: {},
    },
    async () =>
      responder(async () => {
        const projects = await db.project.findMany({
          where: { workspaceId: caller.workspaceId, archived: false },
          include: {
            statuses: { orderBy: { order: "asc" }, select: { name: true } },
            sprints: {
              where: { status: { not: "COMPLETED" } },
              select: { name: true, status: true },
            },
            _count: { select: { tasks: true } },
          },
          orderBy: { createdAt: "asc" },
        });

        if (projects.length === 0) return "Nenhum projeto neste workspace.";
        return projects
          .map((p) => {
            const sprints = p.sprints.length
              ? `\n  sprints: ${p.sprints.map((s) => `${s.name} (${s.status})`).join(", ")}`
              : "";
            return `${p.key} · ${p.name} — ${p._count.tasks} tarefa(s)\n  status: ${p.statuses
              .map((s) => s.name)
              .join(" → ")}${sprints}`;
          })
          .join("\n\n");
      }),
  );

  server.registerTool(
    "beni_tarefas",
    {
      title: "Listar tarefas",
      description:
        "Lista tarefas. status aceita nome exato ou os atalhos 'aberto' e 'concluido'; assignee " +
        "aceita e-mail, nome, 'eu' ou 'ninguem'; overdue traz só as atrasadas.",
      inputSchema: {
        project: z.string().optional(),
        status: z.string().optional(),
        assignee: z.string().optional(),
        q: z.string().optional(),
        overdue: z.boolean().optional(),
        limit: z.number().int().min(1).max(200).optional(),
      },
    },
    async ({ project, status, assignee, q, overdue, limit }) =>
      responder(async () => {
        const where: Record<string, unknown> = {
          archived: false,
          project: project
            ? {
                workspaceId: caller.workspaceId,
                OR: [{ id: project }, { key: { equals: project, mode: "insensitive" } }],
              }
            : { workspaceId: caller.workspaceId },
        };

        if (status === "aberto") where.status = { category: { notIn: ["DONE", "CANCELED"] } };
        else if (status === "concluido") where.status = { category: "DONE" };
        else if (status) where.status = { name: { equals: status, mode: "insensitive" } };

        if (assignee === "eu") where.assigneeId = caller.userId;
        else if (assignee === "ninguem") where.assigneeId = null;
        else if (assignee) {
          where.assignee = {
            OR: [
              { email: { equals: assignee, mode: "insensitive" } },
              { name: { contains: assignee, mode: "insensitive" } },
            ],
          };
        }

        if (q) {
          where.OR = [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ];
        }

        if (overdue) {
          const hoje = new Date();
          hoje.setHours(0, 0, 0, 0);
          where.dueDate = { lt: hoje };
          where.status = { category: { notIn: ["DONE", "CANCELED"] } };
        }

        const tasks = await db.task.findMany({
          where,
          include: taskShape,
          orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { updatedAt: "desc" }],
          take: limit ?? 50,
        });

        if (tasks.length === 0) return "Nenhuma tarefa com esses filtros.";
        return `${tasks.length} tarefa(s):\n${tasks.map((t) => `• ${linha(t)}`).join("\n")}`;
      }),
  );

  server.registerTool(
    "beni_tarefa",
    {
      title: "Detalhe da tarefa",
      description: "Uma tarefa por inteiro: descrição, subtarefas, comentários, anexos e dependências.",
      inputSchema: { tarefa: z.string().describe("Referência curta (WEB-12) ou id") },
    },
    async ({ tarefa }) =>
      responder(async () => {
        const found = await taskOf(caller, tarefa);
        const task = await db.task.findUniqueOrThrow({
          where: { id: found.id },
          include: {
            ...taskShape,
            subtasks: { include: taskShape, orderBy: { order: "asc" } },
            comments: {
              include: { author: { select: { name: true } } },
              orderBy: { createdAt: "asc" },
              take: 30,
            },
            attachments: { select: { name: true, mimeType: true, size: true } },
            blockedBy: { include: { dependsOn: { select: { title: true } } } },
          },
        });

        const linhas = [linha(task)];
        if (task.description) linhas.push(`\nDescrição:\n${task.description}`);
        if (task.subtasks.length) {
          linhas.push(
            `\nSubtarefas (${task.subtasks.length}):\n${task.subtasks
              .map((s) => `  • ${s.title} [${s.status.name}]`)
              .join("\n")}`,
          );
        }
        if (task.blockedBy.length) {
          linhas.push(`\nDepende de:\n${task.blockedBy.map((d) => `  • ${d.dependsOn.title}`).join("\n")}`);
        }
        if (task.attachments.length) {
          linhas.push(
            `\nAnexos:\n${task.attachments
              .map((a) => `  • ${a.name} (${a.mimeType}, ${Math.round(a.size / 1024)} KB)`)
              .join("\n")}`,
          );
        }
        if (task.comments.length) {
          linhas.push(
            `\nComentários:\n${task.comments
              .map((c) => `  ${c.author?.name ?? c.guestName ?? "convidado"}: ${c.body}`)
              .join("\n")}`,
          );
        }
        return linhas.join("\n");
      }),
  );

  server.registerTool(
    "beni_meu_dia",
    {
      title: "Meu dia",
      description:
        "O que importa agora para você: atrasadas, vencendo hoje e em andamento. Bom ponto de partida quando a pergunta é vaga.",
      inputSchema: {},
    },
    async () =>
      responder(async () => {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const amanha = new Date(hoje);
        amanha.setDate(amanha.getDate() + 1);

        const abertas = await db.task.findMany({
          where: {
            assigneeId: caller.userId,
            archived: false,
            status: { category: { notIn: ["DONE", "CANCELED"] } },
            project: { workspaceId: caller.workspaceId },
          },
          include: taskShape,
          orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }],
        });

        const atrasadas = abertas.filter((t) => t.dueDate && t.dueDate < hoje);
        const vencemHoje = abertas.filter((t) => t.dueDate && t.dueDate >= hoje && t.dueDate < amanha);
        const andando = abertas.filter((t) => t.status.category === "IN_PROGRESS");

        const bloco = (titulo: string, lista: typeof abertas) =>
          lista.length
            ? `${titulo} (${lista.length}):\n${lista.map((t) => `  • ${linha(t)}`).join("\n")}`
            : `${titulo}: nada.`;

        return [
          bloco("Atrasadas", atrasadas),
          bloco("Vencem hoje", vencemHoje),
          bloco("Em andamento", andando),
          `\nNo total, ${abertas.length} tarefa(s) abertas atribuídas a você.`,
        ].join("\n\n");
      }),
  );

  server.registerTool(
    "beni_buscar",
    {
      title: "Buscar",
      description:
        "Busca no acervo. Com Elasticsearch ligado, acha por radical ('integrar' encontra 'Integração') e dentro dos comentários.",
      inputSchema: { q: z.string() },
    },
    async ({ q }) =>
      responder(async () => {
        const ids = await searchTaskIds(caller.workspaceId, q, 30);
        const tasks = ids
          ? await db.task.findMany({
              where: { id: { in: ids }, project: { workspaceId: caller.workspaceId } },
              include: taskShape,
            })
          : await db.task.findMany({
              where: {
                archived: false,
                project: { workspaceId: caller.workspaceId },
                OR: [
                  { title: { contains: q, mode: "insensitive" } },
                  { description: { contains: q, mode: "insensitive" } },
                ],
              },
              include: taskShape,
              take: 30,
            });

        if (tasks.length === 0) return `Nada encontrado para "${q}".`;
        return `${tasks.length} resultado(s) (busca: ${ids ? "elasticsearch" : "postgres"}):\n${tasks
          .map((t) => `• ${linha(t)}`)
          .join("\n")}`;
      }),
  );

  server.registerTool(
    "beni_criar_tarefa",
    {
      title: "Criar tarefa",
      description: "Cria uma tarefa. Confira os status válidos com beni_projetos antes de passar status.",
      inputSchema: {
        project: z.string().describe("Chave (WEB), id ou nome do projeto"),
        title: z.string(),
        description: z.string().optional(),
        status: z.string().optional(),
        type: z.enum(["TASK", "BUG", "STORY", "EPIC", "CHORE"]).optional(),
        priority: z.enum(["URGENT", "HIGH", "MEDIUM", "LOW", "NONE"]).optional(),
        assignee: z.string().optional(),
        dueDate: z.string().optional().describe("AAAA-MM-DD"),
        startDate: z.string().optional().describe("AAAA-MM-DD"),
        points: z.number().optional(),
        estimateHours: z.number().optional(),
        tags: z.array(z.string()).optional(),
        parent: z.string().optional(),
      },
    },
    async (input) =>
      responder(async () => `Criada: ${linha(await createTaskViaApi(caller, input))}`),
  );

  server.registerTool(
    "beni_criar_tarefas_em_massa",
    {
      title: "Criar tarefas em massa",
      description:
        "Cria várias tarefas a partir de texto (ata, lista, documento). Reconhece !prioridade, #tipo, " +
        "@responsável, prazos (14/08, hoje, amanhã, sexta, em 10 dias), ~3h e *5 pontos. Use dryRun " +
        "para conferir antes — recomendado quando o texto vem do usuário.",
      inputSchema: {
        project: z.string(),
        text: z.string(),
        mode: z.enum(["auto", "linha", "titulo", "bloco"]).optional(),
        dryRun: z.boolean().optional(),
      },
    },
    async ({ project, text, mode, dryRun }) =>
      responder(async () => {
        const resolvido: BulkMode = mode && mode !== "auto" ? mode : detectBulkMode(text);
        const todas = parseBulkTasks(text, new Date(), resolvido);
        const parsed = todas.slice(0, MAX_BULK_TASKS);
        const sobra =
          todas.length > parsed.length
            ? `\n(${todas.length - parsed.length} linha(s) além do limite ficaram de fora)`
            : "";

        if (dryRun) {
          const itens = parsed
            .map((t) => {
              const detalhes = [
                t.type,
                t.priority && `prioridade ${t.priority}`,
                t.assigneeHint && `@${t.assigneeHint}`,
                t.dueDate && `prazo ${t.dueDate}`,
                t.points && `${t.points} pts`,
              ].filter(Boolean);
              const subs = t.subtasks.length
                ? `\n${t.subtasks.map((s) => `      – ${s}`).join("\n")}`
                : "";
              return `  • ${t.title}${detalhes.length ? ` · ${detalhes.join(" · ")}` : ""}${subs}`;
            })
            .join("\n");
          return `Simulação (lido por ${resolvido}) — nada foi criado ainda:\n${itens}${sobra}\n\nPara criar de verdade, repita sem dryRun.`;
        }

        const criadas = [];
        let subtarefas = 0;
        for (const item of parsed) {
          const task = await createTaskViaApi(caller, {
            project,
            title: item.title,
            description: item.description,
            priority: item.priority ?? undefined,
            type: item.type ?? undefined,
            dueDate: item.dueDate,
            points: item.points,
            estimateHours: item.estimateHours,
            tags: item.tags,
          });
          criadas.push(task);
          for (const title of item.subtasks) {
            await createTaskViaApi(caller, { projectId: task.projectId, title, parent: task.id });
            subtarefas += 1;
          }
        }

        return `${criadas.length} tarefa(s) e ${subtarefas} subtarefa(s) criadas (lido por ${resolvido}):\n${criadas
          .map((t) => `  • ${linha(t)}`)
          .join("\n")}${sobra}`;
      }),
  );

  server.registerTool(
    "beni_atualizar_tarefa",
    {
      title: "Atualizar tarefa",
      description:
        "Altera campos de uma tarefa; só o que for informado é tocado. Mover para status concluído marca como pronta.",
      inputSchema: {
        tarefa: z.string(),
        title: z.string().optional(),
        description: z.string().nullable().optional(),
        status: z.string().optional(),
        type: z.enum(["TASK", "BUG", "STORY", "EPIC", "CHORE"]).optional(),
        priority: z.enum(["URGENT", "HIGH", "MEDIUM", "LOW", "NONE"]).optional(),
        assignee: z.string().nullable().optional(),
        dueDate: z.string().nullable().optional(),
        startDate: z.string().nullable().optional(),
        points: z.number().nullable().optional(),
        estimateHours: z.number().nullable().optional(),
        progress: z.number().min(0).max(100).optional(),
        archived: z.boolean().optional(),
      },
    },
    async ({ tarefa, ...campos }) =>
      responder(async () => {
        const found = await taskOf(caller, tarefa);
        return `Atualizada: ${linha(await updateTaskViaApi(caller, found.id, campos))}`;
      }),
  );

  server.registerTool(
    "beni_comentar",
    {
      title: "Comentar",
      description: "Escreve um comentário na tarefa, em seu nome.",
      inputSchema: { tarefa: z.string(), body: z.string() },
    },
    async ({ tarefa, body }) =>
      responder(async () => {
        const task = await taskOf(caller, tarefa);
        if (!body.trim()) throw new Error("Comentário vazio");
        await db.comment.create({
          data: { taskId: task.id, authorId: caller.userId, body: body.trim() },
        });
        return `Comentário publicado em ${tarefa}.`;
      }),
  );

  server.registerTool(
    "beni_criar_projeto",
    {
      title: "Criar projeto",
      description: "Cria um projeto com o conjunto de status padrão.",
      inputSchema: {
        name: z.string(),
        description: z.string().optional(),
        key: z.string().optional().describe("Chave curta, ex.: WEB"),
      },
    },
    async ({ name, description, key }) =>
      responder(async () => {
        const chave = (key || projectKeyFrom(name)).toUpperCase().slice(0, 6);
        const existente = await db.project.findFirst({
          where: { workspaceId: caller.workspaceId, key: chave },
        });
        if (existente) throw new Error(`Já existe um projeto com a chave ${chave}`);

        const project = await db.project.create({
          data: {
            workspaceId: caller.workspaceId,
            name: name.trim(),
            description: description ?? null,
            key: chave,
            color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
            statuses: {
              create: DEFAULT_STATUSES.map((s, i) => ({
                name: s.name,
                color: s.color,
                category: s.category,
                order: i,
              })),
            },
          },
        });
        return `Projeto criado: ${project.key} · ${project.name}`;
      }),
  );

  server.registerTool(
    "beni_excluir_tarefa",
    {
      title: "Excluir tarefa",
      description:
        "Apaga a tarefa e suas subtarefas, sem volta. Confirme com o usuário antes. Para só tirar da " +
        "vista, use beni_atualizar_tarefa com archived: true.",
      inputSchema: { tarefa: z.string() },
    },
    async ({ tarefa }) =>
      responder(async () => {
        const task = await taskOf(caller, tarefa);
        await db.task.delete({ where: { id: task.id } });
        return `Tarefa ${tarefa} excluída.`;
      }),
  );

  return server;
}

/**
 * Transporte de uma requisição só.
 *
 * O SDK espera uma conexão de vida longa; aqui cada POST é independente. Este
 * transporte entrega a mensagem recebida, junta o que o servidor responder e
 * encerra — o que mantém o protocolo por conta do SDK sem precisar guardar
 * sessão entre requisições.
 */
export async function runMcpRequest(server: McpServer, message: JSONRPCMessage) {
  const respostas: JSONRPCMessage[] = [];
  let resolver: (() => void) | null = null;
  const esperaResposta = new Promise<void>((resolve) => {
    resolver = resolve;
  });

  const transport: Transport = {
    async start() {},
    async send(msg: JSONRPCMessage) {
      respostas.push(msg);
      resolver?.();
    },
    async close() {},
  };

  await server.connect(transport);
  transport.onmessage?.(message);

  // notificação não tem resposta; requisição tem exatamente uma
  const ehRequisicao = "method" in message && "id" in message;
  if (ehRequisicao) {
    await Promise.race([
      esperaResposta,
      new Promise((resolve) => setTimeout(resolve, 25_000)),
    ]);
  }

  await server.close();
  return respostas;
}

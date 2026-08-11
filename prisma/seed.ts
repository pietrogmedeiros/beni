import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL ?? "";
// mesmo motivo de src/lib/db.ts: o driver `pg` ignora o `?schema=` da URL
const schema = connectionString
  ? (new URL(connectionString).searchParams.get("schema") ?? undefined)
  : undefined;

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString }, { schema }),
});

const DEFAULT_STATUSES = [
  { name: "Backlog", color: "#94a3b8", category: "BACKLOG" as const },
  { name: "A fazer", color: "#eab308", category: "TODO" as const },
  { name: "Em andamento", color: "#f59e0b", category: "IN_PROGRESS" as const },
  { name: "Em revisão", color: "#06b6d4", category: "IN_PROGRESS" as const },
  { name: "Concluído", color: "#22c55e", category: "DONE" as const },
];

function daysFromNow(n: number) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d;
}

function pick<T>(arr: T[], i: number) {
  return arr[i % arr.length];
}

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@beni.app";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "beni1234";

  const existing = await db.user.findUnique({ where: { email: adminEmail } });
  if (existing) {
    console.log(`✔ Seed já aplicado (usuário ${adminEmail} existe). Nada a fazer.`);
    return;
  }

  console.log("→ Criando usuários…");
  const hash = await bcrypt.hash(adminPassword, 10);

  const admin = await db.user.create({
    data: {
      email: adminEmail,
      name: "Pietro Medeiros",
      passwordHash: hash,
      avatarColor: "#eab308",
    },
  });

  const people = await Promise.all(
    [
      { name: "Ana Ribeiro", email: "ana@beni.app", color: "#ec4899" },
      { name: "Caio Duarte", email: "caio@beni.app", color: "#14b8a6" },
      { name: "Marina Lopes", email: "marina@beni.app", color: "#f97316" },
      { name: "Rafael Nunes", email: "rafael@beni.app", color: "#22c55e" },
    ].map((p) =>
      db.user.create({
        data: {
          email: p.email,
          name: p.name,
          passwordHash: hash,
          avatarColor: p.color,
        },
      }),
    ),
  );

  const team = [admin, ...people];

  console.log("→ Criando workspace…");
  const workspace = await db.workspace.create({
    data: {
      name: "Estúdio Beni",
      slug: "estudio-beni",
      members: {
        create: team.map((u, i) => ({
          userId: u.id,
          role: i === 0 ? ("OWNER" as const) : ("MEMBER" as const),
        })),
      },
    },
  });

  console.log("→ Criando tags…");
  const tagDefs = [
    { name: "frontend", color: "#eab308" },
    { name: "backend", color: "#14b8a6" },
    { name: "design", color: "#ec4899" },
    { name: "infra", color: "#64748b" },
    { name: "urgente", color: "#ef4444" },
    { name: "melhoria", color: "#22c55e" },
    { name: "documentação", color: "#eab308" },
  ];
  const tags = await Promise.all(
    tagDefs.map((t) =>
      db.tag.create({
        data: { workspaceId: workspace.id, name: t.name, color: t.color },
      }),
    ),
  );

  const projectDefs = [
    {
      name: "Plataforma Web",
      key: "WEB",
      color: "#eab308",
      icon: "Rocket",
      description:
        "Nova aplicação web do produto: onboarding, dashboard e cobrança.",
      tasks: [
        ["Desenhar fluxo de onboarding", "STORY", "HIGH", 4, 3],
        ["Implementar login com e-mail e senha", "TASK", "URGENT", 4, 5],
        ["Configurar pipeline de CI", "CHORE", "MEDIUM", 4, 3],
        ["Dashboard: gráficos de uso", "STORY", "HIGH", 3, 8],
        ["Corrigir estouro de layout no mobile", "BUG", "HIGH", 2, 2],
        ["Página de planos e checkout", "STORY", "MEDIUM", 1, 8],
        ["Integração com gateway de pagamento", "TASK", "URGENT", 2, 5],
        ["Testes e2e do fluxo de assinatura", "TASK", "MEDIUM", 1, 5],
        ["Documentar API pública", "CHORE", "LOW", 0, 3],
        ["Migrar componentes para o design system", "EPIC", "MEDIUM", 2, 13],
        ["Notificações por e-mail", "STORY", "LOW", 0, 5],
        ["Acessibilidade: revisão de contraste", "TASK", "LOW", 1, 2],
        ["Modo escuro em todas as telas", "STORY", "MEDIUM", 4, 3],
        ["Rate limit na API de busca", "TASK", "HIGH", 0, 3],
        ["Relatório de erros com Sentry", "CHORE", "MEDIUM", 3, 2],
      ],
    },
    {
      name: "App Mobile",
      key: "APP",
      color: "#14b8a6",
      icon: "Package",
      description: "Aplicativo nativo para iOS e Android com sincronização offline.",
      tasks: [
        ["Arquitetura de sincronização offline", "EPIC", "URGENT", 2, 13],
        ["Tela de login e biometria", "STORY", "HIGH", 4, 5],
        ["Push notifications", "STORY", "MEDIUM", 1, 5],
        ["Cache local com SQLite", "TASK", "HIGH", 2, 8],
        ["Crash ao abrir sem internet", "BUG", "URGENT", 3, 3],
        ["Publicar build beta na TestFlight", "CHORE", "MEDIUM", 1, 2],
        ["Onboarding com 3 telas", "STORY", "LOW", 0, 3],
        ["Deep links para tarefas", "TASK", "MEDIUM", 0, 5],
        ["Ícones e splash screen", "TASK", "LOW", 4, 1],
        ["Analytics de eventos-chave", "TASK", "MEDIUM", 2, 3],
      ],
    },
    {
      name: "Go-to-Market",
      key: "GTM",
      color: "#f97316",
      icon: "Megaphone",
      description: "Lançamento: site, conteúdo, campanhas e materiais de vendas.",
      tasks: [
        ["Definir posicionamento e mensagem", "STORY", "URGENT", 4, 5],
        ["Landing page de lançamento", "STORY", "HIGH", 3, 8],
        ["Kit de imprensa", "TASK", "MEDIUM", 1, 3],
        ["Sequência de e-mails de ativação", "TASK", "HIGH", 2, 5],
        ["Roteiro do vídeo de demonstração", "TASK", "MEDIUM", 2, 3],
        ["Campanha paga no LinkedIn", "TASK", "LOW", 0, 5],
        ["Playbook de vendas", "CHORE", "MEDIUM", 0, 3],
        ["Programa de indicação", "STORY", "LOW", 0, 8],
        ["Página de comparação com concorrentes", "TASK", "MEDIUM", 1, 3],
      ],
    },
  ];

  let orderCursor = 1000;

  for (const [pIndex, def] of projectDefs.entries()) {
    console.log(`→ Criando projeto ${def.name}…`);
    const project = await db.project.create({
      data: {
        workspaceId: workspace.id,
        name: def.name,
        key: def.key,
        color: def.color,
        icon: def.icon,
        description: def.description,
        order: (pIndex + 1) * 1000,
        startDate: daysFromNow(-30),
        endDate: daysFromNow(60),
      },
    });

    const statuses = [];
    for (const [i, s] of DEFAULT_STATUSES.entries()) {
      statuses.push(
        await db.taskStatus.create({
          data: {
            projectId: project.id,
            name: s.name,
            color: s.color,
            category: s.category,
            order: (i + 1) * 1000,
          },
        }),
      );
    }

    const sprints = [];
    const sprintDefs = [
      {
        name: `Sprint 1 · ${def.key}`,
        goal: "Fundamentos e infraestrutura",
        status: "COMPLETED" as const,
        start: daysFromNow(-28),
        end: daysFromNow(-15),
      },
      {
        name: `Sprint 2 · ${def.key}`,
        goal: "Primeiras entregas de valor para o usuário",
        status: "ACTIVE" as const,
        start: daysFromNow(-14),
        end: daysFromNow(0),
      },
      {
        name: `Sprint 3 · ${def.key}`,
        goal: "Polimento e preparação para o lançamento",
        status: "PLANNED" as const,
        start: daysFromNow(1),
        end: daysFromNow(14),
      },
    ];

    for (const [i, s] of sprintDefs.entries()) {
      sprints.push(
        await db.sprint.create({
          data: {
            projectId: project.id,
            name: s.name,
            goal: s.goal,
            status: s.status,
            startDate: s.start,
            endDate: s.end,
            order: (i + 1) * 1000,
          },
        }),
      );
    }

    const created = [];
    for (const [i, row] of def.tasks.entries()) {
      const [title, type, priority, statusIdx, points] = row as [
        string,
        string,
        string,
        number,
        number,
      ];
      const status = statuses[statusIdx];
      const isDone = status.category === "DONE";
      const isBacklog = status.category === "BACKLOG";

      const start = daysFromNow(-24 + i * 3);
      const due = daysFromNow(-24 + i * 3 + 4 + (points > 5 ? 4 : 0));

      orderCursor += 1000;

      const task = await db.task.create({
        data: {
          projectId: project.id,
          number: i + 1,
          title,
          description:
            i % 3 === 0
              ? `## Contexto\n\nEsta tarefa faz parte da entrega de **${def.name}**.\n\n### Critérios de aceite\n- Funciona em desktop e mobile\n- Coberta por testes\n- Revisada por outra pessoa do time`
              : null,
          statusId: status.id,
          sprintId: isBacklog
            ? null
            : pick(sprints, isDone ? 0 : i % 2 === 0 ? 1 : 2).id,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          type: type as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          priority: priority as any,
          assigneeId: i % 5 === 4 ? null : pick(team, i + pIndex).id,
          reporterId: admin.id,
          startDate: isBacklog ? null : start,
          dueDate: isBacklog ? null : due,
          estimate: points * 1.5,
          points,
          progress: isDone
            ? 100
            : status.category === "IN_PROGRESS"
              ? 30 + ((i * 17) % 50)
              : 0,
          completedAt: isDone ? daysFromNow(-12 + ((i * 3) % 12)) : null,
          order: orderCursor,
          createdAt: daysFromNow(-30 + i),
          tags: {
            create: [
              { tagId: pick(tags, i + pIndex).id },
              ...(priority === "URGENT" ? [{ tagId: tags[4].id }] : []),
            ],
          },
        },
      });
      created.push(task);
    }

    await db.project.update({
      where: { id: project.id },
      data: { taskCounter: def.tasks.length },
    });

    // subtarefas em algumas tarefas
    let counter = def.tasks.length;
    for (const parent of created.slice(0, 3)) {
      for (const [j, label] of [
        "Levantar requisitos",
        "Implementar",
        "Testar e revisar",
      ].entries()) {
        counter += 1;
        orderCursor += 100;
        await db.task.create({
          data: {
            projectId: project.id,
            number: counter,
            title: `${label} — ${parent.title.toLowerCase()}`,
            statusId: statuses[j === 0 ? 4 : j === 1 ? 2 : 1].id,
            parentId: parent.id,
            sprintId: parent.sprintId,
            priority: "MEDIUM",
            assigneeId: pick(team, j + 1).id,
            reporterId: admin.id,
            order: orderCursor,
            createdAt: daysFromNow(-20 + j * 2),
            progress: j === 0 ? 100 : 0,
            completedAt: j === 0 ? daysFromNow(-5) : null,
          },
        });
      }
    }
    await db.project.update({
      where: { id: project.id },
      data: { taskCounter: counter },
    });

    // dependências encadeadas
    for (let i = 1; i < Math.min(created.length, 6); i++) {
      await db.dependency.create({
        data: {
          taskId: created[i].id,
          dependsOnId: created[i - 1].id,
          type: "FINISH_TO_START",
        },
      });
    }

    // comentários e atividade
    const commentBodies = [
      "Consegui destravar isso hoje, seguindo para revisão.",
      "Precisamos alinhar o escopo antes de continuar — marquei 15 min amanhã.",
      "Subi a primeira versão, feedbacks são bem-vindos!",
      "Bloqueado esperando o acesso ao ambiente de homologação.",
    ];
    for (const [i, task] of created.slice(0, 6).entries()) {
      await db.comment.create({
        data: {
          taskId: task.id,
          authorId: pick(team, i).id,
          body: pick(commentBodies, i),
        },
      });
      await db.activity.create({
        data: {
          projectId: project.id,
          taskId: task.id,
          userId: pick(team, i).id,
          action: i % 2 === 0 ? "task.created" : "task.status_changed",
          meta: { title: task.title },
        },
      });
    }
  }

  console.log("→ Criando canais de conversa…");
  const canais = [
    {
      name: "geral",
      topic: "Avisos e conversas do time todo",
      messages: [
        [0, "Bom dia, time! Semana de sprint nova — deem uma olhada no backlog."],
        [1, "Bom dia! Já puxei dois itens do WEB para a Sprint 2."],
        [2, "Subi o ambiente de homologação, podem testar à vontade."],
      ],
    },
    {
      name: "produto",
      topic: "Descobertas, prioridades e decisões de produto",
      messages: [
        [3, "O onboarding em 3 telas testou bem com 5 usuários."],
        [0, "Ótimo. @Ana consegue fechar o texto das telas até quinta?"],
        [1, "Consigo sim, mando na quarta para revisão."],
      ],
    },
    {
      name: "lancamento",
      topic: "Tudo que precisa sair antes do go-live",
      messages: [
        [4, "Landing page está no ar em staging."],
        [2, "Revisei os textos, só faltou o vídeo de demonstração."],
      ],
    },
  ];

  for (const def of canais) {
    const canal = await db.channel.create({
      data: {
        workspaceId: workspace.id,
        kind: "PUBLIC",
        name: def.name,
        topic: def.topic,
        createdById: admin.id,
        members: {
          create: team.map((u, i) => ({ userId: u.id, isAdmin: i === 0 })),
        },
      },
    });

    for (const [i, row] of def.messages.entries()) {
      const [authorIndex, body] = row as [number, string];
      await db.message.create({
        data: {
          channelId: canal.id,
          authorId: pick(team, authorIndex).id,
          body,
          createdAt: new Date(Date.now() - (def.messages.length - i) * 3600_000),
        },
      });
    }
  }

  console.log("\n✅ Seed concluído!");
  console.log(`   Login: ${adminEmail}`);
  console.log(`   Senha: ${adminPassword}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });

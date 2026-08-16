import "server-only";
import { db, dbSchema } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { feedbackAdmins } from "@/server/feedback";

/**
 * Telemetria de uso.
 *
 * Existe para uma pergunta concreta: o que pode virar plano pago sem estragar
 * o produto. Sem isto, a divisão entre grátis e pago é palpite — e palpite
 * errado em preço custa usuário, não só receita.
 *
 * Duas regras que valem mais que o resto:
 *
 * **Guarda o fato, nunca o conteúdo.** Que alguém abriu o Gantt, não o que
 * estava nele. Análise de produto não deveria criar um segundo lugar onde o
 * trabalho dos clientes fica guardado.
 *
 * **Nunca atrapalha quem está usando.** Toda gravação é solta e engole o
 * próprio erro: telemetria que derruba uma ação é pior do que telemetria
 * nenhuma.
 */

/**
 * De onde a pessoa está usando.
 *
 * O app de macOS acrescenta `BeniDesktop` ao agente (ver `desktop/src/main.js`),
 * e é o único sinal que separa app de navegador — o app é um cliente fino da
 * mesma aplicação web, então nada mais no pedido difere.
 */
export type Origem = "app" | "celular" | "navegador";

export function origemDoAgente(agente: string | null | undefined): Origem {
  if (!agente) return "navegador";
  if (agente.includes("BeniDesktop")) return "app";
  if (/Mobile|Android|iPhone|iPad/i.test(agente)) return "celular";
  return "navegador";
}

export type Evento =
  | "visao.lista"
  | "visao.quadro"
  | "visao.gantt"
  | "visao.backlog"
  | "visao.calendario"
  | "visao.painel"
  | "visao.anotacoes"
  | "visao.chat"
  | "tarefa.criar"
  | "tarefa.massa"
  | "anotacao.criar"
  | "link.criar"
  | "aprovacao.pedir"
  | "feedback.enviar"
  | "avatar.trocar"
  | "app.mac"
  | "api.chamada"
  | "mcp.chamada";

/** Grava e segue a vida. Não devolve promessa para ninguém esperar por ela. */
export function registrar(
  name: Evento,
  contexto?: {
    userId?: string;
    workspaceId?: string;
    origem?: Origem;
    meta?: Record<string, unknown>;
  },
) {
  void db.usageEvent
    .create({
      data: {
        name,
        userId: contexto?.userId ?? null,
        workspaceId: contexto?.workspaceId ?? null,
        origem: contexto?.origem ?? null,
        meta: (contexto?.meta ?? undefined) as never,
      },
    })
    .catch((e) => console.error("[telemetria]", (e as Error).message));
}

/** Versão que descobre quem é pela sessão. Usada pelas telas. */
export async function registrarDaSessao(
  name: Evento,
  workspaceId?: string,
  meta?: Record<string, unknown>,
) {
  const sessao = await getSession();
  registrar(name, { userId: sessao?.userId, workspaceId, meta });
}

/** Some com o que é velho demais para decidir qualquer coisa. */
export async function limparEventosAntigos() {
  const corte = new Date(Date.now() - 180 * 24 * 60 * 60_000);
  const { count } = await db.usageEvent.deleteMany({
    where: { createdAt: { lt: corte } },
  });
  if (count > 0) console.log(`[telemetria] ${count} evento(s) antigo(s) removido(s)`);
}

// ------------------------------------------------------------------ painel

export type Painel = {
  ativos: { hoje: number; semana: number; mes: number };
  contas: { total: number; confirmadas: number; novasNaSemana: number };
  /** Quantos workspaces têm 1, 2, 3 ou 4+ pessoas — decide o teto de gente. */
  tamanhoDosWorkspaces: { faixa: string; quantidade: number }[];
  /** Workspaces distintos que usaram cada coisa nos últimos 30 dias. */
  usoPorRecurso: { evento: string; workspaces: number; vezes: number }[];
  /** Links públicos ativos por workspace — decide o teto de link. */
  linksPorWorkspace: { faixa: string; quantidade: number }[];
  /** Anexos somados por workspace — decide o teto de armazenamento. */
  armazenamento: { workspace: string; megabytes: number }[];
  /** Quem voltou em cada um dos últimos 14 dias. */
  ativosPorDia: { dia: string; pessoas: number }[];
  /** Pessoas distintas por origem em 30 dias, e quantas usam as duas. */
  porOrigem: { origem: string; pessoas: number; vezes: number }[];
  /** Quem usou o app de macOS ao menos uma vez em 30 dias. */
  usamOApp: { nome: string; email: string; ultimoUso: string }[];
};

const DIAS = 30;

/**
 * Quem é "de dentro": as contas que administram e os workspaces delas.
 *
 * Enquanto o produto é novo, quem mais usa é quem construiu — e isso distorce
 * tudo. Uma pessoa testando o Gantt trinta vezes por dia faz o Gantt parecer o
 * recurso mais amado do Beni, quando é só o desenvolvedor conferindo o
 * próprio trabalho.
 */
async function deDentro() {
  const emails = await feedbackAdmins();
  if (emails.length === 0) return { usuarios: [] as string[], workspaces: [] as string[] };

  const contas = await db.user.findMany({
    where: { email: { in: emails, mode: "insensitive" } },
    select: { id: true, memberships: { select: { workspaceId: true } } },
  });

  return {
    usuarios: contas.map((c) => c.id),
    workspaces: [...new Set(contas.flatMap((c) => c.memberships.map((m) => m.workspaceId)))],
  };
}

export async function carregarPainel(incluirInternos = false): Promise<Painel> {
  const agora = new Date();
  const desde = (dias: number) => new Date(agora.getTime() - dias * 86_400_000);
  const schema = dbSchema();

  const dentro = incluirInternos
    ? { usuarios: [], workspaces: [] }
    : await deDentro();
  const semUsuarios = { id: { notIn: dentro.usuarios } };
  const foraUsuario = dentro.usuarios;
  const foraWorkspace = dentro.workspaces;

  const [
    ativosHoje,
    ativosSemana,
    ativosMes,
    total,
    confirmadas,
    novasNaSemana,
    porTamanho,
    porRecurso,
    porLinks,
    porArmazenamento,
    porDia,
    porOrigem,
    doApp,
  ] = await Promise.all([
    distintos(desde(1), foraUsuario),
    distintos(desde(7), foraUsuario),
    distintos(desde(30), foraUsuario),
    db.user.count({ where: semUsuarios }),
    db.user.count({ where: { ...semUsuarios, emailVerifiedAt: { not: null } } }),
    db.user.count({ where: { ...semUsuarios, createdAt: { gte: desde(7) } } }),

    // faixas de tamanho de workspace
    db.$queryRawUnsafe<{ faixa: string; quantidade: bigint }[]>(`
      SELECT faixa, COUNT(*)::bigint AS quantidade FROM (
        SELECT CASE
          WHEN COUNT(m.id) = 1 THEN '1 pessoa'
          WHEN COUNT(m.id) = 2 THEN '2 pessoas'
          WHEN COUNT(m.id) = 3 THEN '3 pessoas'
          ELSE '4 ou mais'
        END AS faixa
        FROM "${schema}"."Workspace" w
        LEFT JOIN "${schema}"."Membership" m ON m."workspaceId" = w.id
        WHERE NOT (w.id = ANY($1::text[]))
        GROUP BY w.id
      ) t GROUP BY faixa ORDER BY faixa
    `, foraWorkspace),

    db.$queryRawUnsafe<{ evento: string; workspaces: bigint; vezes: bigint }[]>(`
      SELECT name AS evento,
             COUNT(DISTINCT "workspaceId")::bigint AS workspaces,
             COUNT(*)::bigint AS vezes
      FROM "${schema}"."UsageEvent"
      WHERE "createdAt" >= $1
        AND NOT (COALESCE("workspaceId", '') = ANY($2::text[]))
      GROUP BY name ORDER BY workspaces DESC, vezes DESC
    `, desde(DIAS), foraWorkspace),

    db.$queryRawUnsafe<{ faixa: string; quantidade: bigint }[]>(`
      SELECT faixa, COUNT(*)::bigint AS quantidade FROM (
        SELECT CASE
          WHEN COUNT(s.id) = 0 THEN 'nenhum'
          WHEN COUNT(s.id) = 1 THEN '1 link'
          ELSE '2 ou mais'
        END AS faixa
        FROM "${schema}"."Workspace" w
        LEFT JOIN "${schema}"."Project" p ON p."workspaceId" = w.id
        LEFT JOIN "${schema}"."ProjectShare" s ON s."projectId" = p.id
        WHERE NOT (w.id = ANY($1::text[]))
        GROUP BY w.id
      ) t GROUP BY faixa ORDER BY faixa
    `, foraWorkspace),

    db.$queryRawUnsafe<{ workspace: string; bytes: bigint }[]>(`
      SELECT w.name AS workspace, COALESCE(SUM(a.size), 0)::bigint AS bytes
      FROM "${schema}"."Workspace" w
      LEFT JOIN "${schema}"."Project" p ON p."workspaceId" = w.id
      LEFT JOIN "${schema}"."Task" t ON t."projectId" = p.id
      LEFT JOIN "${schema}"."Attachment" a ON a."taskId" = t.id
      WHERE NOT (w.id = ANY($1::text[]))
      GROUP BY w.id, w.name ORDER BY bytes DESC LIMIT 10
    `, foraWorkspace),

    db.$queryRawUnsafe<{ dia: Date; pessoas: bigint }[]>(`
      SELECT date_trunc('day', "createdAt") AS dia,
             COUNT(DISTINCT "userId")::bigint AS pessoas
      FROM "${schema}"."UsageEvent"
      WHERE "createdAt" >= $1
        AND NOT (COALESCE("userId", '') = ANY($2::text[]))
      GROUP BY 1 ORDER BY 1
    `, desde(14), foraUsuario),

    db.$queryRawUnsafe<{ origem: string; pessoas: bigint; vezes: bigint }[]>(`
      SELECT COALESCE(origem, 'desconhecida') AS origem,
             COUNT(DISTINCT "userId")::bigint AS pessoas,
             COUNT(*)::bigint AS vezes
      FROM "${schema}"."UsageEvent"
      WHERE "createdAt" >= $1
        AND NOT (COALESCE("userId", '') = ANY($2::text[]))
      GROUP BY 1 ORDER BY pessoas DESC
    `, desde(DIAS), foraUsuario),

    db.$queryRawUnsafe<{ nome: string; email: string; ultimo: Date }[]>(`
      SELECT u.name AS nome, u.email, MAX(e."createdAt") AS ultimo
      FROM "${schema}"."UsageEvent" e
      JOIN "${schema}"."User" u ON u.id = e."userId"
      WHERE e.origem = 'app' AND e."createdAt" >= $1
        AND NOT (u.id = ANY($2::text[]))
      GROUP BY u.id, u.name, u.email
      ORDER BY ultimo DESC LIMIT 25
    `, desde(DIAS), foraUsuario),
  ]);

  return {
    ativos: { hoje: ativosHoje, semana: ativosSemana, mes: ativosMes },
    contas: { total, confirmadas, novasNaSemana },
    tamanhoDosWorkspaces: porTamanho.map((r) => ({
      faixa: r.faixa,
      quantidade: Number(r.quantidade),
    })),
    usoPorRecurso: porRecurso.map((r) => ({
      evento: r.evento,
      workspaces: Number(r.workspaces),
      vezes: Number(r.vezes),
    })),
    linksPorWorkspace: porLinks.map((r) => ({
      faixa: r.faixa,
      quantidade: Number(r.quantidade),
    })),
    armazenamento: porArmazenamento.map((r) => ({
      workspace: r.workspace,
      megabytes: Math.round((Number(r.bytes) / 1024 / 1024) * 10) / 10,
    })),
    ativosPorDia: porDia.map((r) => ({
      dia: new Date(r.dia).toISOString().slice(0, 10),
      pessoas: Number(r.pessoas),
    })),
    porOrigem: porOrigem.map((r) => ({
      origem: r.origem,
      pessoas: Number(r.pessoas),
      vezes: Number(r.vezes),
    })),
    usamOApp: doApp.map((r) => ({
      nome: r.nome,
      email: r.email,
      ultimoUso: new Date(r.ultimo).toISOString(),
    })),
  };
}

async function distintos(desde: Date, fora: string[]) {
  const linhas = await db.usageEvent.findMany({
    where: {
      createdAt: { gte: desde },
      userId: { not: null, notIn: fora.length ? fora : undefined },
    },
    distinct: ["userId"],
    select: { userId: true },
  });
  return linhas.length;
}

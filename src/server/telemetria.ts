import "server-only";
import { db, dbSchema } from "@/lib/db";
import { getSession } from "@/lib/auth";

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
  contexto?: { userId?: string; workspaceId?: string; meta?: Record<string, unknown> },
) {
  void db.usageEvent
    .create({
      data: {
        name,
        userId: contexto?.userId ?? null,
        workspaceId: contexto?.workspaceId ?? null,
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
};

const DIAS = 30;

export async function carregarPainel(): Promise<Painel> {
  const agora = new Date();
  const desde = (dias: number) => new Date(agora.getTime() - dias * 86_400_000);
  const schema = dbSchema();

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
  ] = await Promise.all([
    distintos(desde(1)),
    distintos(desde(7)),
    distintos(desde(30)),
    db.user.count(),
    db.user.count({ where: { emailVerifiedAt: { not: null } } }),
    db.user.count({ where: { createdAt: { gte: desde(7) } } }),

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
        GROUP BY w.id
      ) t GROUP BY faixa ORDER BY faixa
    `),

    db.$queryRawUnsafe<{ evento: string; workspaces: bigint; vezes: bigint }[]>(`
      SELECT name AS evento,
             COUNT(DISTINCT "workspaceId")::bigint AS workspaces,
             COUNT(*)::bigint AS vezes
      FROM "${schema}"."UsageEvent"
      WHERE "createdAt" >= $1
      GROUP BY name ORDER BY workspaces DESC, vezes DESC
    `, desde(DIAS)),

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
        GROUP BY w.id
      ) t GROUP BY faixa ORDER BY faixa
    `),

    db.$queryRawUnsafe<{ workspace: string; bytes: bigint }[]>(`
      SELECT w.name AS workspace, COALESCE(SUM(a.size), 0)::bigint AS bytes
      FROM "${schema}"."Workspace" w
      LEFT JOIN "${schema}"."Project" p ON p."workspaceId" = w.id
      LEFT JOIN "${schema}"."Task" t ON t."projectId" = p.id
      LEFT JOIN "${schema}"."Attachment" a ON a."taskId" = t.id
      GROUP BY w.id, w.name ORDER BY bytes DESC LIMIT 10
    `),

    db.$queryRawUnsafe<{ dia: Date; pessoas: bigint }[]>(`
      SELECT date_trunc('day', "createdAt") AS dia,
             COUNT(DISTINCT "userId")::bigint AS pessoas
      FROM "${schema}"."UsageEvent"
      WHERE "createdAt" >= $1
      GROUP BY 1 ORDER BY 1
    `, desde(14)),
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
  };
}

async function distintos(desde: Date) {
  const linhas = await db.usageEvent.findMany({
    where: { createdAt: { gte: desde }, userId: { not: null } },
    distinct: ["userId"],
    select: { userId: true },
  });
  return linhas.length;
}

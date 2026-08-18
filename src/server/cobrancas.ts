import "server-only";
import { db } from "@/lib/db";
import { isFeedbackAdmin } from "@/server/feedback";
import { currentWorkspace, requireUser } from "@/lib/auth";
import {
  hoje,
  planoDeParcelas,
  situacao,
  type Situacao,
} from "@/lib/cobrancas";

/**
 * Cobranças — o financeiro de um projeto.
 *
 * A funcionalidade vive **dentro da gestão de um projeto**, ao lado de Lista,
 * Gantt e Painel: uma cobrança existe por causa de um trabalho, e é o projeto
 * que dá esse contexto. Não há carteira global.
 *
 * Três filtros se somam em toda consulta, e cada um responde uma pergunta
 * diferente:
 *
 * 1. **Quem tem a funcionalidade** — a mesma lista de administradores do
 *    feedback e da telemetria.
 * 2. **De quem é o dinheiro** — o `ownerId` da linha. Se um dia entrar um
 *    segundo administrador, ele ganha a funcionalidade e continua sem ver o
 *    que o outro cobra.
 * 3. **De que projeto** — o `projectId`, sempre validado contra o workspace de
 *    quem pede.
 *
 * Nenhuma função aceita `ownerId` de fora: ele vem sempre da sessão.
 */

export async function podeVerCobrancas() {
  const user = await requireUser();
  return isFeedbackAdmin(user.email);
}

/** Sessão + permissão numa chamada só. Devolve o dono das linhas. */
export async function donoDaCarteira() {
  const user = await requireUser();
  if (!(await isFeedbackAdmin(user.email))) throw new Error("SEM_PERMISSAO");
  return user;
}

/**
 * Confirma que o projeto existe **e** está no workspace de quem pede.
 *
 * Ser administrador dá acesso à funcionalidade, não a qualquer projeto: sem
 * esta checagem, um id de projeto colado na URL abriria o financeiro de um
 * workspace do qual a pessoa não participa.
 */
export async function projetoDaCarteira(projectId: string) {
  const workspace = await currentWorkspace();
  const projeto = await db.project.findFirst({
    where: { id: projectId, workspaceId: workspace.id },
    select: { id: true, name: true, key: true },
  });
  if (!projeto) throw new Error("PROJETO_NAO_ENCONTRADO");
  return projeto;
}

/* -------------------------------------------------------------------------- */
/* Geração                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Cria as parcelas que faltam para uma cobrança.
 *
 * Só **cria** — nunca altera nem apaga o que já existe. Uma parcela que já foi
 * marcada como paga é fato consumado, e regeração que reescreve fato consumado
 * é como se perde histórico de pagamento.
 *
 * É idempotente: roda quantas vezes quiser no mesmo dia e o resultado é o
 * mesmo. O `skipDuplicates` junto do índice único `[cobrancaId, numero]` é o
 * que garante isso mesmo se duas abas dispararem ao mesmo tempo.
 */
export async function garantirParcelas(cobrancaId: string) {
  const cobranca = await db.cobranca.findUnique({
    where: { id: cobrancaId },
    include: { parcelas: { select: { numero: true } } },
  });
  if (!cobranca) return 0;

  // mensalidade encerrada para de gerar, mas o que já venceu continua lá
  const ate = cobranca.encerradaEm ? new Date(cobranca.encerradaEm) : hoje();
  const plano = planoDeParcelas(cobranca, ate);

  const existentes = new Set(cobranca.parcelas.map((p) => p.numero));
  const faltando = plano.filter((p) => !existentes.has(p.numero));
  if (faltando.length === 0) return 0;

  const { count } = await db.parcela.createMany({
    data: faltando.map((p) => ({
      cobrancaId,
      numero: p.numero,
      vencimento: p.vencimento,
      valorCentavos: p.valorCentavos,
    })),
    skipDuplicates: true,
  });
  return count;
}

/**
 * Completa as mensalidades correntes do dono.
 *
 * Roda ao abrir o painel em vez de num agendador. Parece estranho escrever ao
 * ler, mas é o desenho mais confiável para uma carteira pessoal: sem rotina
 * noturna para falhar em silêncio, e quem não abre o painel não precisa das
 * parcelas geradas de qualquer forma. É barato porque só toca em cobrança
 * `MENSAL` aberta.
 */
async function completarMensalidades(ownerId: string, projectId: string) {
  const correntes = await db.cobranca.findMany({
    where: { ownerId, projectId, tipo: "MENSAL", encerradaEm: null },
    select: { id: true },
  });
  for (const c of correntes) await garantirParcelas(c.id);
}

/* -------------------------------------------------------------------------- */
/* Leitura                                                                     */
/* -------------------------------------------------------------------------- */

export type Filtro = "abertas" | "atrasadas" | "pagas" | "todas";

export type ParcelaNaLista = {
  id: string;
  numero: number;
  vencimento: string;
  valorCentavos: number;
  status: string;
  situacao: Situacao;
  pagoEm: string | null;
  valorPagoCentavos: number | null;
  observacao: string | null;
  cobrancaId: string;
  cobrancaTitulo: string;
  cobrancaTipo: string;
  parcelasTotal: number | null;
  clienteId: string;
  clienteNome: string;
};

export type Bloco = { centavos: number; qtd: number };

export type ClienteNaLista = {
  id: string;
  nome: string;
  contato: string | null;
  documento: string | null;
  observacao: string | null;
  arquivado: boolean;
  cobrancasAbertas: number;
  emAbertoCentavos: number;
  atrasadoCentavos: number;
};

export type Painel = {
  projectId: string;
  hoje: string;
  filtro: Filtro;
  clienteId: string | null;
  resumo: {
    atrasado: Bloco;
    vence7: Bloco;
    aReceberMes: Bloco;
    recebidoMes: Bloco;
  };
  parcelas: ParcelaNaLista[];
  clientes: ClienteNaLista[];
};

const dia = (d: Date) => d.toISOString().slice(0, 10);

export async function carregarPainel(
  ownerId: string,
  projectId: string,
  filtro: Filtro = "abertas",
  clienteId: string | null = null,
): Promise<Painel> {
  await completarMensalidades(ownerId, projectId);

  const ref = hoje();
  const fimDoMes = new Date(
    Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 0),
  );
  const inicioDoMes = new Date(
    Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1),
  );
  const em7 = new Date(ref.getTime() + 7 * 24 * 60 * 60 * 1000);

  const doProjeto = {
    cobranca: {
      ownerId,
      projectId,
      ...(clienteId ? { clienteId } : {}),
    },
  };

  const status =
    filtro === "pagas"
      ? { status: "PAGO" as const }
      : filtro === "todas"
        ? {}
        : { status: "PENDENTE" as const };

  const vencimento =
    filtro === "atrasadas" ? { vencimento: { lt: ref } } : {};

  const [linhas, todasAbertas, pagasNoMes, clientes] =
    await Promise.all([
      db.parcela.findMany({
        where: { ...doProjeto, ...status, ...vencimento },
        orderBy: [{ vencimento: "asc" }, { numero: "asc" }],
        // teto de segurança: mensalidade antiga gera muita linha, e o painel
        // responde "quem paga em seguida", não "todo o histórico"
        take: filtro === "pagas" || filtro === "todas" ? 300 : 500,
        include: {
          cobranca: {
            select: {
              id: true,
              titulo: true,
              tipo: true,
              parcelasTotal: true,
              cliente: { select: { id: true, nome: true } },
            },
          },
        },
      }),

      // os totais não podem depender do filtro da tela: o cartão "atrasado"
      // some se a pessoa filtrar por "pagas", e aí o painel esconde justamente
      // o que ele existe para mostrar
      db.parcela.findMany({
        where: { cobranca: { ownerId, projectId }, status: "PENDENTE" },
        select: { valorCentavos: true, vencimento: true },
      }),

      db.parcela.findMany({
        where: {
          cobranca: { ownerId, projectId },
          status: "PAGO",
          pagoEm: { gte: inicioDoMes, lte: new Date(fimDoMes.getTime() + 86_399_000) },
        },
        select: { valorCentavos: true, valorPagoCentavos: true },
      }),

      db.cliente.findMany({
        where: { ownerId },
        orderBy: [{ arquivado: "asc" }, { nome: "asc" }],
        include: {
          cobrancas: {
            // os totais ao lado do cliente são **deste** projeto: o mesmo
            // cliente pode ter cobrança em vários, e somar tudo aqui daria um
            // número que não bate com nada na tela
            where: { projectId },
            select: {
              id: true,
              encerradaEm: true,
              parcelas: {
                where: { status: "PENDENTE" },
                select: { valorCentavos: true, vencimento: true },
              },
            },
          },
        },
      }),

    ]);

  const soma = (itens: { valorCentavos: number }[]): Bloco => ({
    centavos: itens.reduce((s, i) => s + i.valorCentavos, 0),
    qtd: itens.length,
  });

  const atrasadas = todasAbertas.filter((p) => p.vencimento < ref);
  const proximas7 = todasAbertas.filter(
    (p) => p.vencimento >= ref && p.vencimento <= em7,
  );
  const noMes = todasAbertas.filter(
    (p) => p.vencimento >= ref && p.vencimento <= fimDoMes,
  );

  return {
    projectId,
    hoje: dia(ref),
    filtro,
    clienteId,
    resumo: {
      atrasado: soma(atrasadas),
      vence7: soma(proximas7),
      aReceberMes: soma(noMes),
      recebidoMes: {
        // o recebido usa o que **entrou**, não o combinado: desconto e juros
        // fazem os dois divergirem, e caixa é o que entrou
        centavos: pagasNoMes.reduce(
          (s, p) => s + (p.valorPagoCentavos ?? p.valorCentavos),
          0,
        ),
        qtd: pagasNoMes.length,
      },
    },
    parcelas: linhas.map((p) => ({
      id: p.id,
      numero: p.numero,
      vencimento: dia(p.vencimento),
      valorCentavos: p.valorCentavos,
      status: p.status,
      situacao: situacao(p, ref),
      pagoEm: p.pagoEm ? dia(p.pagoEm) : null,
      valorPagoCentavos: p.valorPagoCentavos,
      observacao: p.observacao,
      cobrancaId: p.cobranca.id,
      cobrancaTitulo: p.cobranca.titulo,
      cobrancaTipo: p.cobranca.tipo,
      parcelasTotal: p.cobranca.parcelasTotal,
      clienteId: p.cobranca.cliente.id,
      clienteNome: p.cobranca.cliente.nome,
    })),
    clientes: clientes.map((c) => {
      const abertas = c.cobrancas.flatMap((co) => co.parcelas);
      return {
        id: c.id,
        nome: c.nome,
        contato: c.contato,
        documento: c.documento,
        observacao: c.observacao,
        arquivado: c.arquivado,
        cobrancasAbertas: c.cobrancas.filter((co) => co.encerradaEm === null).length,
        emAbertoCentavos: abertas.reduce((s, p) => s + p.valorCentavos, 0),
        atrasadoCentavos: abertas
          .filter((p) => p.vencimento < ref)
          .reduce((s, p) => s + p.valorCentavos, 0),
      };
    }),
  };
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  carregarPainel,
  donoDaCarteira,
  garantirParcelas,
  projetoDaCarteira,
  type Filtro,
  type Painel,
} from "@/server/cobrancas";
import { diaUtc, hoje } from "@/lib/cobrancas";

/**
 * Ações da carteira de cobranças.
 *
 * Toda ação começa por `donoDaCarteira()`, que resolve sessão e permissão
 * juntas, e **toda** escrita confirma antes que a linha pertence a quem está
 * pedindo. Conferir o dono no `where` do próprio `update` (em vez de buscar,
 * checar e depois gravar) fecha a janela em que a permissão muda no meio.
 */

type Resposta = { ok: true } | { ok: false; erro: string };

const OK = { ok: true } as const;
const erro = (mensagem: string): Resposta => ({ ok: false, erro: mensagem });

/**
 * Recarrega a tela de cobranças de **todos** os projetos.
 *
 * Usa o padrão da rota dinâmica em vez de um caminho concreto porque um mesmo
 * cliente pode ser cobrado em vários projetos: renomeá-lo mudaria a tela de
 * cada um deles, e revalidar só o projeto de onde veio a ação deixaria os
 * outros mostrando o nome antigo.
 */
const revalidar = () => revalidatePath("/p/[projectId]/cobrancas", "page");

/** yyyy-mm-dd vindo de `<input type="date">` vira meia-noite UTC. */
const dataDoFormulario = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida")
  .transform((v) => {
    const [a, m, d] = v.split("-").map(Number);
    return diaUtc(a, m, d);
  });

/* -------------------------------------------------------------------------- */
/* Leitura                                                                     */
/* -------------------------------------------------------------------------- */

export async function dadosDoPainel(
  projectId: string,
  filtro: Filtro = "abertas",
  clienteId: string | null = null,
): Promise<Painel> {
  const dono = await donoDaCarteira();
  await projetoDaCarteira(projectId);
  return carregarPainel(dono.id, projectId, filtro, clienteId);
}

/* -------------------------------------------------------------------------- */
/* Clientes                                                                    */
/* -------------------------------------------------------------------------- */

const cliente = z.object({
  nome: z.string().trim().min(1, "O cliente precisa de um nome").max(120),
  contato: z.string().trim().max(200).optional(),
  documento: z.string().trim().max(40).optional(),
  observacao: z.string().trim().max(2000).optional(),
});

export async function salvarCliente(
  dados: z.input<typeof cliente> & { id?: string },
): Promise<Resposta> {
  const dono = await donoDaCarteira();
  const parsed = cliente.safeParse(dados);
  if (!parsed.success) return erro(parsed.error.issues[0].message);

  const campos = {
    nome: parsed.data.nome,
    contato: parsed.data.contato || null,
    documento: parsed.data.documento || null,
    observacao: parsed.data.observacao || null,
  };

  if (dados.id) {
    const { count } = await db.cliente.updateMany({
      where: { id: dados.id, ownerId: dono.id },
      data: campos,
    });
    if (count === 0) return erro("Cliente não encontrado");
  } else {
    await db.cliente.create({ data: { ...campos, ownerId: dono.id } });
  }

  revalidar();
  return OK;
}

export async function arquivarCliente(
  id: string,
  arquivado: boolean,
): Promise<Resposta> {
  const dono = await donoDaCarteira();
  const { count } = await db.cliente.updateMany({
    where: { id, ownerId: dono.id },
    data: { arquivado },
  });
  if (count === 0) return erro("Cliente não encontrado");
  revalidar();
  return OK;
}

export async function excluirCliente(id: string): Promise<Resposta> {
  const dono = await donoDaCarteira();
  // exclusão leva junto cobranças e parcelas por cascata — por isso ela só
  // existe para cliente sem nada pago. Quem já pagou é histórico, e histórico
  // se arquiva
  const pagas = await db.parcela.count({
    where: { cobranca: { clienteId: id, ownerId: dono.id }, status: "PAGO" },
  });
  if (pagas > 0) {
    return erro(
      "Esse cliente já tem parcela paga. Arquive em vez de excluir, para não perder o histórico.",
    );
  }
  const { count } = await db.cliente.deleteMany({ where: { id, ownerId: dono.id } });
  if (count === 0) return erro("Cliente não encontrado");
  revalidar();
  return OK;
}

/* -------------------------------------------------------------------------- */
/* Cobranças                                                                   */
/* -------------------------------------------------------------------------- */

const cobranca = z
  .object({
    clienteId: z.string().min(1, "Escolha o cliente"),
    titulo: z.string().trim().min(1, "Dê um nome à cobrança").max(160),
    tipo: z.enum(["PARCELADO", "MENSAL", "AVULSO"]),
    valorCentavos: z.number().int().positive("O valor precisa ser maior que zero"),
    parcelasTotal: z.number().int().min(1).max(360).nullable().optional(),
    primeiroVencimento: dataDoFormulario,
    diaVencimento: z.number().int().min(1).max(31).nullable().optional(),
    projectId: z.string().min(1, "Cobrança precisa de um projeto"),
    observacao: z.string().trim().max(2000).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.tipo === "PARCELADO" && !v.parcelasTotal) {
      ctx.addIssue({ code: "custom", message: "Diga em quantas parcelas", path: ["parcelasTotal"] });
    }
  });

export async function criarCobranca(
  dados: z.input<typeof cobranca>,
): Promise<Resposta & { id?: string }> {
  const dono = await donoDaCarteira();
  const parsed = cobranca.safeParse(dados);
  if (!parsed.success) return erro(parsed.error.issues[0].message);
  const d = parsed.data;

  await projetoDaCarteira(d.projectId);

  const dele = await db.cliente.findFirst({
    where: { id: d.clienteId, ownerId: dono.id },
    select: { id: true },
  });
  if (!dele) return erro("Cliente não encontrado");

  const criada = await db.cobranca.create({
    data: {
      ownerId: dono.id,
      clienteId: d.clienteId,
      titulo: d.titulo,
      tipo: d.tipo,
      valorCentavos: d.valorCentavos,
      parcelasTotal: d.tipo === "PARCELADO" ? (d.parcelasTotal ?? null) : null,
      primeiroVencimento: d.primeiroVencimento,
      diaVencimento:
        d.tipo === "MENSAL"
          ? (d.diaVencimento ?? d.primeiroVencimento.getUTCDate())
          : null,
      projectId: d.projectId,
      observacao: d.observacao || null,
    },
  });

  await garantirParcelas(criada.id);
  revalidar();
  return { ok: true, id: criada.id };
}

export async function encerrarCobranca(
  id: string,
  encerrar: boolean,
): Promise<Resposta> {
  const dono = await donoDaCarteira();
  const { count } = await db.cobranca.updateMany({
    where: { id, ownerId: dono.id, tipo: "MENSAL" },
    data: { encerradaEm: encerrar ? hoje() : null },
  });
  if (count === 0) return erro("Mensalidade não encontrada");

  // reabrir precisa recompor os meses que deixaram de ser gerados enquanto
  // estava encerrada
  if (!encerrar) await garantirParcelas(id);

  revalidar();
  return OK;
}

export async function excluirCobranca(id: string): Promise<Resposta> {
  const dono = await donoDaCarteira();
  const pagas = await db.parcela.count({
    where: { cobrancaId: id, cobranca: { ownerId: dono.id }, status: "PAGO" },
  });
  if (pagas > 0) {
    return erro(
      "Essa cobrança já tem parcela paga. Encerre em vez de excluir, para não perder o histórico.",
    );
  }
  const { count } = await db.cobranca.deleteMany({ where: { id, ownerId: dono.id } });
  if (count === 0) return erro("Cobrança não encontrada");
  revalidar();
  return OK;
}

/* -------------------------------------------------------------------------- */
/* Parcelas                                                                    */
/* -------------------------------------------------------------------------- */

const baixa = z.object({
  parcelaId: z.string().min(1),
  pagoEm: dataDoFormulario.optional(),
  /// nulo = entrou exatamente o combinado
  valorPagoCentavos: z.number().int().nullable().optional(),
});

export async function marcarPago(dados: z.input<typeof baixa>): Promise<Resposta> {
  const dono = await donoDaCarteira();
  const parsed = baixa.safeParse(dados);
  if (!parsed.success) return erro(parsed.error.issues[0].message);

  const { count } = await db.parcela.updateMany({
    where: { id: parsed.data.parcelaId, cobranca: { ownerId: dono.id } },
    data: {
      status: "PAGO",
      pagoEm: parsed.data.pagoEm ?? hoje(),
      valorPagoCentavos: parsed.data.valorPagoCentavos ?? null,
    },
  });
  if (count === 0) return erro("Parcela não encontrada");

  revalidar();
  return OK;
}

export async function reabrirParcela(parcelaId: string): Promise<Resposta> {
  const dono = await donoDaCarteira();
  const { count } = await db.parcela.updateMany({
    where: { id: parcelaId, cobranca: { ownerId: dono.id } },
    data: { status: "PENDENTE", pagoEm: null, valorPagoCentavos: null },
  });
  if (count === 0) return erro("Parcela não encontrada");
  revalidar();
  return OK;
}

export async function cancelarParcela(
  parcelaId: string,
  cancelar: boolean,
): Promise<Resposta> {
  const dono = await donoDaCarteira();
  const { count } = await db.parcela.updateMany({
    where: {
      id: parcelaId,
      cobranca: { ownerId: dono.id },
      // cancelar algo já pago apagaria uma entrada de caixa
      status: cancelar ? "PENDENTE" : "CANCELADO",
    },
    data: { status: cancelar ? "CANCELADO" : "PENDENTE" },
  });
  if (count === 0) return erro("Só dá para cancelar parcela em aberto");
  revalidar();
  return OK;
}

const ajuste = z.object({
  parcelaId: z.string().min(1),
  vencimento: dataDoFormulario,
  valorCentavos: z.number().int().positive("O valor precisa ser maior que zero"),
  observacao: z.string().trim().max(500).optional(),
});

export async function ajustarParcela(
  dados: z.input<typeof ajuste>,
): Promise<Resposta> {
  const dono = await donoDaCarteira();
  const parsed = ajuste.safeParse(dados);
  if (!parsed.success) return erro(parsed.error.issues[0].message);

  const { count } = await db.parcela.updateMany({
    where: { id: parsed.data.parcelaId, cobranca: { ownerId: dono.id } },
    data: {
      vencimento: parsed.data.vencimento,
      valorCentavos: parsed.data.valorCentavos,
      observacao: parsed.data.observacao || null,
    },
  });
  if (count === 0) return erro("Parcela não encontrada");
  revalidar();
  return OK;
}

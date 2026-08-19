/**
 * Regras de cobrança que não dependem de banco nem de tela.
 *
 * Dois cuidados moram aqui e valem por todo o resto:
 *
 * **Dinheiro é inteiro em centavos.** Nunca `float`. Somar 0,1 + 0,2 em ponto
 * flutuante já erra na terceira casa, e um painel de cobrança que erra centavo
 * perde a confiança de quem usa na primeira conferência.
 *
 * **Vencimento é dia, não instante.** Toda data guardada é meia-noite **UTC**,
 * e "hoje" é calculado no fuso de quem cobra. Sem isso, às 21h de Brasília o
 * servidor (que roda em UTC) já virou o dia e passa a mostrar como atrasado
 * algo que vence amanhã.
 */

export const FUSO_COBRANCA = process.env.NEXT_PUBLIC_COBRANCA_TZ ?? "America/Sao_Paulo";

/* -------------------------------------------------------------------------- */
/* Dinheiro                                                                    */
/* -------------------------------------------------------------------------- */

const MOEDA = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatarValor(centavos: number) {
  return MOEDA.format(centavos / 100);
}

/** Sem o símbolo — para campo de formulário, onde "R$" atrapalha ao editar. */
export function valorParaCampo(centavos: number) {
  return (centavos / 100).toFixed(2).replace(".", ",");
}

/**
 * Lê o que a pessoa digitou e devolve centavos.
 *
 * Aceita "1.234,56", "1234,56", "1234.56" e "R$ 1.234,56" porque teclado
 * numérico de celular, colagem de planilha e digitação à mão produzem os três.
 * A regra para desempatar ponto e vírgula: **o último separador é o decimal**.
 * Devolve `null` no que não é número, para o formulário poder reclamar em vez
 * de gravar zero silenciosamente.
 */
export function lerValor(texto: string): number | null {
  const limpo = texto.replace(/[^\d.,-]/g, "").trim();
  if (!limpo) return null;

  const ultimoSeparador = Math.max(limpo.lastIndexOf(","), limpo.lastIndexOf("."));
  let inteiro: string;
  let decimais: string;

  if (ultimoSeparador === -1) {
    inteiro = limpo;
    decimais = "";
  } else {
    const depois = limpo.slice(ultimoSeparador + 1);
    // três dígitos depois do último separador é milhar, não centavo:
    // "1.234" são mil duzentos e trinta e quatro, não um e vinte e três
    if (depois.length === 3) {
      inteiro = limpo;
      decimais = "";
    } else {
      inteiro = limpo.slice(0, ultimoSeparador);
      decimais = depois;
    }
  }

  const negativo = inteiro.startsWith("-");
  const digitos = inteiro.replace(/\D/g, "");
  if (!digitos && !decimais) return null;

  const centavos =
    Number(digitos || "0") * 100 + Number((decimais + "00").slice(0, 2) || "0");
  if (!Number.isFinite(centavos)) return null;
  return negativo ? -centavos : centavos;
}

/* -------------------------------------------------------------------------- */
/* Datas                                                                       */
/* -------------------------------------------------------------------------- */

/** Meia-noite UTC do ano/mês/dia dados. Mês em base 1, como se fala. */
export function diaUtc(ano: number, mes: number, dia: number) {
  return new Date(Date.UTC(ano, mes - 1, dia));
}

/**
 * Hoje no fuso de quem cobra, normalizado para meia-noite UTC.
 *
 * É este valor que se compara com `vencimento`. Comparar com `new Date()` cru
 * seria comparar um instante com um dia, e o resultado mudaria conforme a hora
 * em que a página fosse aberta.
 */
export function hoje(agora = new Date()) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO_COBRANCA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
  const [ano, mes, dia] = partes.split("-").map(Number);
  return diaUtc(ano, mes, dia);
}

/**
 * Soma meses preservando o dia de vencimento, sem transbordar.
 *
 * Dia 31 somado a um mês daria 3 de março em ano comum, porque o JavaScript
 * transborda em silêncio. Mensalidade combinada para o dia 31 vence no
 * **último dia** do mês curto, que é o que qualquer pessoa entende por isso.
 */
export function somarMeses(base: Date, meses: number, diaDesejado?: number) {
  const ano = base.getUTCFullYear();
  const mes = base.getUTCMonth() + meses;
  const dia = diaDesejado ?? base.getUTCDate();
  const ultimoDoMes = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  return new Date(Date.UTC(ano, mes, Math.min(dia, ultimoDoMes)));
}

const DIA_MS = 24 * 60 * 60 * 1000;

/** Soma dias corridos. Sem fuso no meio: as datas já são meia-noite UTC. */
export function somarDias(base: Date, dias: number) {
  return new Date(base.getTime() + dias * DIA_MS);
}

/** Dias entre duas datas já normalizadas. Negativo = a primeira ficou para trás. */
export function diasEntre(de: Date, ate: Date) {
  return Math.round((ate.getTime() - de.getTime()) / DIA_MS);
}

/* -------------------------------------------------------------------------- */
/* Situação                                                                    */
/* -------------------------------------------------------------------------- */

export type Situacao = "PAGO" | "CANCELADO" | "ATRASADO" | "HOJE" | "A_VENCER";

/**
 * Situação de leitura de uma parcela.
 *
 * Derivada, nunca guardada: "atrasado" é só `PENDENTE` com vencimento no
 * passado. Guardar como coluna exigiria uma rotina virando a chave à
 * meia-noite — e no dia em que essa rotina falhasse, o painel mentiria sem
 * ninguém perceber.
 */
export function situacao(
  parcela: { status: string; vencimento: Date | string },
  referencia = hoje(),
): Situacao {
  if (parcela.status === "PAGO") return "PAGO";
  if (parcela.status === "CANCELADO") return "CANCELADO";

  const vence = new Date(parcela.vencimento);
  const dias = diasEntre(referencia, vence);
  if (dias < 0) return "ATRASADO";
  if (dias === 0) return "HOJE";
  return "A_VENCER";
}

export const ROTULO_SITUACAO: Record<Situacao, string> = {
  PAGO: "Pago",
  CANCELADO: "Cancelado",
  ATRASADO: "Atrasado",
  HOJE: "Vence hoje",
  A_VENCER: "A vencer",
};

export const ROTULO_TIPO: Record<string, string> = {
  PARCELADO: "Parcelado",
  MENSAL: "Mensalidade",
  AVULSO: "Avulso",
};

/** "em 3 dias", "há 12 dias", "hoje" — o texto que explica a urgência. */
export function prazoEmPalavras(vencimento: Date | string, referencia = hoje()) {
  const dias = diasEntre(referencia, new Date(vencimento));
  if (dias === 0) return "hoje";
  if (dias === 1) return "amanhã";
  if (dias === -1) return "ontem";
  if (dias > 0) return `em ${dias} dias`;
  return `há ${Math.abs(dias)} dias`;
}

/* -------------------------------------------------------------------------- */
/* Geração de parcelas                                                         */
/* -------------------------------------------------------------------------- */

export type PlanoEntrada = {
  tipo: string;
  valorCentavos: number;
  parcelasTotal: number | null;
  primeiroVencimento: Date | string;
  diaVencimento: number | null;
  /** Nulo = de mês em mês. Ver `Cobranca.intervaloDias` no schema. */
  intervaloDias?: number | null;
};

export type ParcelaPlanejada = {
  numero: number;
  vencimento: Date;
  valorCentavos: number;
};

/** Quantos meses de mensalidade manter criados à frente. */
export const HORIZONTE_MENSAL = 12;

/**
 * Cadências prontas para o formulário.
 *
 * `null` é mês de calendário, não 30 dias — a diferença aparece já em
 * fevereiro, e é o combinado mais comum.
 */
export const CADENCIAS: { valor: string; dias: number | null; rotulo: string }[] = [
  { valor: "MES", dias: null, rotulo: "Mensal" },
  { valor: "QUINZENAL", dias: 15, rotulo: "A cada 15 dias" },
  { valor: "SEMANAL", dias: 7, rotulo: "Semanal" },
  { valor: "QUINZENAL_14", dias: 14, rotulo: "A cada 14 dias" },
  { valor: "PERSONALIZADO", dias: 0, rotulo: "Personalizado…" },
];

/**
 * Quais parcelas **deveriam** existir para uma cobrança.
 *
 * Função pura, e de propósito: a geração é a parte que erra em silêncio — um
 * centavo que some no arredondamento, um 31 que vira 3 de março, uma
 * mensalidade que para de gerar. Sendo pura, dá para provar cada um desses
 * casos sem banco.
 *
 * Mensalidade é infinita por natureza, então ela materializa
 * `HORIZONTE_MENSAL` meses à frente e vai sendo completada conforme o tempo
 * passa. `ate` é a data de referência do "hoje" de quem lê.
 */
export function planoDeParcelas(
  cobranca: PlanoEntrada,
  ate = hoje(),
): ParcelaPlanejada[] {
  const primeiro = new Date(cobranca.primeiroVencimento);

  if (cobranca.tipo === "AVULSO") {
    return [{ numero: 1, vencimento: primeiro, valorCentavos: cobranca.valorCentavos }];
  }

  if (cobranca.tipo === "PARCELADO") {
    const n = Math.max(1, cobranca.parcelasTotal ?? 1);
    // divide o total e joga o que sobrou na primeira parcela, para a soma das
    // parcelas bater com o combinado no centavo — R$ 1.000 em 3 vezes é
    // 333,34 + 333,33 + 333,33, não três de 333,33 com um centavo perdido
    const base = Math.floor(cobranca.valorCentavos / n);
    const resto = cobranca.valorCentavos - base * n;
    const dia = primeiro.getUTCDate();
    const passo = cobranca.intervaloDias ?? null;
    return Array.from({ length: n }, (_, i) => ({
      numero: i + 1,
      // com intervalo em dias a data anda em cima da anterior; sem ele, o
      // vencimento é sempre o mesmo dia do mês, encurtando em fevereiro
      vencimento:
        passo && passo > 0
          ? somarDias(primeiro, passo * i)
          : somarMeses(primeiro, i, dia),
      valorCentavos: base + (i === 0 ? resto : 0),
    }));
  }

  // MENSAL
  const dia = cobranca.diaVencimento ?? primeiro.getUTCDate();
  const limite = somarMeses(ate, HORIZONTE_MENSAL, dia);
  const parcelas: ParcelaPlanejada[] = [];
  for (let i = 0; i < 600; i++) {
    const vencimento = somarMeses(primeiro, i, dia);
    if (vencimento > limite) break;
    parcelas.push({ numero: i + 1, vencimento, valorCentavos: cobranca.valorCentavos });
  }
  return parcelas;
}

/**
 * Vocabulário do canal de feedback — usado no formulário, na triagem e no
 * e-mail. Fica fora do servidor porque o formulário é componente de cliente.
 */

export const FEEDBACK_KINDS = [
  {
    value: "PROBLEMA",
    label: "Algo quebrou",
    hint: "Não funcionou, travou ou fez o contrário do esperado",
    emoji: "🔧",
  },
  {
    value: "IDEIA",
    label: "Tenho uma ideia",
    hint: "Faltou alguma coisa, ou daria para melhorar",
    emoji: "💡",
  },
  {
    value: "ELOGIO",
    label: "Isso está bom",
    hint: "O que já funciona e vale manter do jeito que está",
    emoji: "🎉",
  },
  {
    value: "DUVIDA",
    label: "Não entendi",
    hint: "Procurei e não achei como fazer",
    emoji: "🤔",
  },
] as const;

export type FeedbackKindValue = (typeof FEEDBACK_KINDS)[number]["value"];

export const FEEDBACK_STATUSES = [
  { value: "NOVO", label: "Novo", color: "#eab308" },
  { value: "TRIADO", label: "Lido", color: "#94a3b8" },
  { value: "PLANEJADO", label: "Planejado", color: "#6366f1" },
  { value: "FAZENDO", label: "Fazendo", color: "#0ea5e9" },
  { value: "FEITO", label: "Feito", color: "#22a06b" },
  { value: "RECUSADO", label: "Não vou fazer", color: "#a1a1aa" },
] as const;

export type FeedbackStatusValue = (typeof FEEDBACK_STATUSES)[number]["value"];

export function kindLabel(kind: string) {
  return FEEDBACK_KINDS.find((k) => k.value === kind)?.label ?? kind;
}

export function statusLabel(status: string) {
  return FEEDBACK_STATUSES.find((s) => s.value === status)?.label ?? status;
}

export function statusColor(status: string) {
  return FEEDBACK_STATUSES.find((s) => s.value === status)?.color ?? "#a1a1aa";
}

/** Teto do texto. Generoso: relato bom costuma ser longo. */
export const MAX_FEEDBACK_LENGTH = 4000;

/** Quantos prints por envio. Mais que isso vira álbum, não relato. */
export const MAX_FEEDBACK_IMAGES = 3;

/**
 * Quando o convite único aparece: conta com pelo menos dois dias e alguma
 * tarefa criada. Pedir opinião a quem acabou de entrar rende "ainda não sei" —
 * e queima a única chance de perguntar.
 */
export const CONVITE_IDADE_MINIMA_DIAS = 2;
export const CONVITE_TAREFAS_MINIMAS = 3;

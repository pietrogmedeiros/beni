/**
 * Blocos de uma anotação.
 *
 * O documento é uma lista de blocos, cada um com um tipo e um texto simples.
 * Não guardamos HTML: a anotação pode ser publicada por link aberto, e
 * renderizar HTML escrito por usuário numa página pública é convite para
 * injeção de script. Aqui o texto é dado; quem desenha é o nosso componente.
 *
 * Formatação dentro da linha (negrito, itálico, código, link) é interpretada
 * na hora de exibir, a partir de marcações de Markdown — e produz sempre os
 * mesmos elementos, nunca o que o texto pedir.
 */

export const BLOCK_TYPES = [
  "p",
  "h1",
  "h2",
  "h3",
  "bullet",
  "number",
  "todo",
  "quote",
  "code",
  "divider",
  "image",
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];

export type Block = {
  id: string;
  type: BlockType;
  text: string;
  /** Só para `todo`. */
  checked?: boolean;
  /** Só para `image`: id do anexo e legenda. */
  attachmentId?: string;
  caption?: string;
};

export function newBlock(type: BlockType = "p", text = ""): Block {
  return {
    id: Math.random().toString(36).slice(2, 10),
    type,
    text,
  };
}

/**
 * Normaliza o que veio do cliente.
 *
 * Nada que chega pela rede entra no banco sem passar por aqui: tipo
 * desconhecido vira parágrafo, texto é limitado e campos estranhos somem. É a
 * fronteira entre "o que o editor manda" e "o que o documento é".
 */
export function sanitizeBlocks(input: unknown): Block[] {
  if (!Array.isArray(input)) return [];

  const blocos: Block[] = [];
  for (const raw of input.slice(0, 2000)) {
    if (!raw || typeof raw !== "object") continue;
    const b = raw as Record<string, unknown>;

    const type = BLOCK_TYPES.includes(b.type as BlockType) ? (b.type as BlockType) : "p";
    const bloco: Block = {
      id: typeof b.id === "string" ? b.id.slice(0, 24) : newBlock().id,
      type,
      text: typeof b.text === "string" ? b.text.slice(0, 10_000) : "",
    };

    if (type === "todo") bloco.checked = b.checked === true;
    if (type === "image") {
      if (typeof b.attachmentId !== "string" || !b.attachmentId) continue;
      bloco.attachmentId = b.attachmentId.slice(0, 40);
      if (typeof b.caption === "string") bloco.caption = b.caption.slice(0, 300);
    }

    blocos.push(bloco);
  }

  return blocos;
}

/** Primeira linha com texto — usada como título quando ninguém deu um. */
export function firstText(blocks: Block[]) {
  return blocks.find((b) => b.text.trim() && b.type !== "code")?.text.trim() ?? "";
}

/** Resumo curto para a lista de anotações. */
export function excerpt(blocks: Block[], max = 140) {
  const texto = blocks
    .filter((b) => b.type !== "image" && b.type !== "divider")
    .map((b) => b.text.trim())
    .filter(Boolean)
    .join(" · ");
  return texto.length > max ? `${texto.slice(0, max)}…` : texto;
}

export function wordCount(blocks: Block[]) {
  return blocks.reduce((n, b) => n + (b.text.trim() ? b.text.trim().split(/\s+/).length : 0), 0);
}

/** Converte prefixos de Markdown em tipo de bloco, como no Notion. */
export const SHORTCUTS: { pattern: RegExp; type: BlockType }[] = [
  { pattern: /^#\s/, type: "h1" },
  { pattern: /^##\s/, type: "h2" },
  { pattern: /^###\s/, type: "h3" },
  { pattern: /^[-*]\s/, type: "bullet" },
  { pattern: /^\d+[.)]\s/, type: "number" },
  { pattern: /^\[[ xX]?\]\s/, type: "todo" },
  { pattern: /^>\s/, type: "quote" },
  { pattern: /^```/, type: "code" },
  { pattern: /^---$/, type: "divider" },
];

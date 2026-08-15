/**
 * Os mascotes disponíveis como avatar.
 *
 * São a mesma cabeça do favicon com o matiz girado — mesmo personagem, dez
 * cores. Os arquivos são gerados por `beni-avatares.mjs`; a cor aqui é só o
 * que a tela mostra na bolinha de seleção.
 */
export const MASCOTES = [
  { chave: "ambar", cor: "#eab308" },
  { chave: "laranja", cor: "#f97316" },
  { chave: "coral", cor: "#fb7185" },
  { chave: "rosa", cor: "#ec4899" },
  { chave: "lavanda", cor: "#a78bfa" },
  { chave: "azul", cor: "#3b82f6" },
  { chave: "ciano", cor: "#06b6d4" },
  { chave: "verde", cor: "#22c55e" },
  { chave: "limao", cor: "#84cc16" },
  { chave: "areia", cor: "#d6d3d1" },
] as const;

export type MascoteChave = (typeof MASCOTES)[number]["chave"];

export function ehMascoteValido(v: string): v is MascoteChave {
  return MASCOTES.some((m) => m.chave === v);
}

export function urlDoMascote(chave: string) {
  return `/mascote/cores/${chave}.webp`;
}

/** Teto da foto de perfil. Ela é reduzida no navegador antes de subir. */
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
/** Lado do quadrado final: nítido em tela retina no maior uso (56px). */
export const LADO_AVATAR = 256;

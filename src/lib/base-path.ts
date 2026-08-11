/**
 * Prefixo do endereço do app (`/workspace` em produção).
 *
 * `next/link`, o router e o `next/image` aplicam o prefixo sozinhos. Tudo que
 * é montado como string — `EventSource`, `fetch`, links públicos copiados para
 * a área de transferência, cabeçalhos `Location` — precisa passar por aqui,
 * senão cai fora do app e devolve 404.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Prefixa um caminho interno: `/chat` → `/workspace/chat`. */
export function withBase(path: string) {
  if (!BASE_PATH) return path;
  return `${BASE_PATH}${path.startsWith("/") ? path : `/${path}`}`;
}

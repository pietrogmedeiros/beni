import path from "node:path";
import type { NextConfig } from "next";

const root = path.resolve(import.meta.dirname);

/**
 * Prefixo do endereço. Vazio por padrão: o Beni tem domínio próprio
 * (`app.benicio.space`) e responde na raiz.
 *
 * Existe para quem precisar servir sob um caminho — `BASE_PATH=/workspace`, por
 * exemplo. O valor entra nos pacotes do navegador durante o build, então mudar
 * só no runtime não adianta: é preciso reconstruir a imagem.
 */
const basePath = (process.env.BASE_PATH ?? "").replace(/\/$/, "");

const nextConfig: NextConfig = {
  basePath,
  // disponível para o código do cliente montar URLs à mão (EventSource, links
  // públicos), já que só `next/link` e o router aplicam o prefixo sozinhos
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  // Empacota só o necessário para rodar em container.
  output: "standalone",
  // Fixa a raiz do projeto: evita que o Turbopack "suba" e encontre um
  // package-lock.json fora do repositório (o que também quebraria o Docker).
  turbopack: { root },
  outputFileTracingRoot: root,
  // O cliente do Prisma roda só no servidor — não deve ser empacotado.
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg"],

  // Quem digitar só o domínio cai no app em vez de num 404: fora do basePath
  // o Next não atende nada, então a regra precisa de `basePath: false` para
  // enxergar a raiz de verdade.
  async redirects() {
    if (!basePath) return [];
    return [
      { source: "/", destination: basePath, permanent: false, basePath: false },
    ];
  },
};

export default nextConfig;

import path from "node:path";
import type { NextConfig } from "next";

const root = path.resolve(import.meta.dirname);

/**
 * Prefixo do endereço — o Beni é servido em `beni.space/workspace`.
 *
 * O valor entra nos pacotes do navegador durante o build, então não adianta
 * mudar só no runtime: quem quiser servir na raiz precisa buildar com
 * `BASE_PATH=""`. O padrão é `/workspace` justamente para o build de produção
 * sair certo mesmo que a plataforma esqueça de passar a variável.
 */
const basePath = (process.env.BASE_PATH ?? "/workspace").replace(/\/$/, "");

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
};

export default nextConfig;

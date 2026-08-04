import path from "node:path";
import type { NextConfig } from "next";

const root = path.resolve(import.meta.dirname);

const nextConfig: NextConfig = {
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

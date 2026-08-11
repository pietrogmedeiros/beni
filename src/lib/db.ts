import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { resolveDatabaseUrl } from "@/lib/database-url";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient() {
  const adapter = new PrismaPg({ connectionString: resolveDatabaseUrl() });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

/**
 * Cliente preguiçoso: só conecta no primeiro uso.
 *
 * `next build` importa este módulo para coletar as páginas, e nessa hora ainda
 * não existe banco configurado. Criar o cliente na importação fazia o build
 * inteiro falhar com "Banco não configurado" — agora o erro só aparece se
 * alguém realmente consultar sem configuração, que é quando ele ajuda.
 */
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = (globalForPrisma.prisma ??= createClient());
    return Reflect.get(client, prop, client);
  },
});

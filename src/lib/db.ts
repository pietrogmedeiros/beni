import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { resolveDatabaseUrl } from "@/lib/database-url";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Schema em uso. O cliente do Prisma qualifica as tabelas sozinho, mas uma
 * consulta crua não: sem isto, `SELECT ... FROM "Attachment"` procuraria no
 * `public` mesmo com o app inteiro morando no schema `beni`.
 *
 * É função, e não constante: `next build` importa este módulo antes de existir
 * banco configurado, e resolver a URL ali derruba o build inteiro.
 */
export function dbSchema() {
  return new URL(resolveDatabaseUrl()).searchParams.get("schema") ?? "public";
}

function createClient() {
  const url = resolveDatabaseUrl();
  // O `?schema=` da URL é convenção do Prisma; o driver `pg` o ignora. Com
  // driver adapter é preciso dizer o schema em separado — sem isso o app
  // escreveria no `public` mesmo apontado para um schema isolado.
  const schema = new URL(url).searchParams.get("schema") ?? undefined;
  const adapter = new PrismaPg({ connectionString: url }, { schema });
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

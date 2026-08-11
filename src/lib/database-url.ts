/**
 * Resolve a URL de conexão do Postgres.
 *
 * `DATABASE_URL` sempre ganha quando existe. Se não existir, montamos a URL a
 * partir das variáveis `PG*` — é o formato que o EasyPanel entrega, e a senha
 * que ele gera costuma trazer `@`, `#` ou `/`, o que quebra uma URL escrita à
 * mão em silêncio. Aqui cada parte é codificada antes de entrar na string.
 *
 * O `docker-entrypoint.sh` repete essa lógica em JavaScript inline para
 * exportar `DATABASE_URL` antes de chamar o CLI do Prisma (que só lê a URL).
 * Se mudar as regras aqui, mude lá também.
 */
export function resolveDatabaseUrl(
  env: Record<string, string | undefined> = process.env,
): string {
  if (env.DATABASE_URL) return env.DATABASE_URL;

  const host = env.PGHOST;
  if (!host) {
    throw new Error(
      "Banco não configurado: defina DATABASE_URL ou as variáveis PGHOST/PGUSER/PGPASSWORD/PGDATABASE.",
    );
  }

  const user = encodeURIComponent(env.PGUSER ?? "postgres");
  const password = env.PGPASSWORD ? `:${encodeURIComponent(env.PGPASSWORD)}` : "";
  const port = env.PGPORT ?? "5432";
  const database = encodeURIComponent(env.PGDATABASE ?? "postgres");
  const schema = env.PGSCHEMA ?? "public";
  const sslmode = env.PGSSLMODE ? `&sslmode=${env.PGSSLMODE}` : "";

  return `postgresql://${user}${password}@${host}:${port}/${database}?schema=${schema}${sslmode}`;
}

/**
 * Garante que o schema do Beni exista antes das migrations.
 *
 * Em banco compartilhado (o caso do EasyPanel, onde outros projetos vivem na
 * mesma instância) o Beni fica num schema só dele — `?schema=beni`. O Prisma
 * cria as tabelas lá dentro, mas não cria o schema em si: sem isso a primeira
 * migration falha com "schema does not exist". Este script resolve, e é
 * idempotente — rodar de novo não faz nada.
 */
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("✗ DATABASE_URL ausente ao preparar o schema.");
  process.exit(1);
}

const schema = new URL(url).searchParams.get("schema") ?? "public";
if (schema === "public") {
  process.exit(0); // nada a fazer: o public já existe em todo banco
}

const client = new pg.Client({ connectionString: url });
try {
  await client.connect();
  await client.query(`CREATE SCHEMA IF NOT EXISTS "${schema.replace(/"/g, '""')}"`);
  console.log(`✔ Schema "${schema}" pronto`);
} catch (error) {
  console.error(`✗ Não foi possível preparar o schema "${schema}":`, error.message);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}

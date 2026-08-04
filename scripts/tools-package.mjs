/**
 * Gera um package.json mínimo com apenas as dependências que o container
 * precisa em runtime fora do bundle do Next: CLI do Prisma (migrations),
 * tsx (seed) e o driver do Postgres.
 *
 * Usado apenas no estágio `tools` do Dockerfile.
 */
import { readFileSync, writeFileSync } from "node:fs";

const source = JSON.parse(readFileSync(process.argv[2], "utf8"));
const keep = [
  "prisma",
  "tsx",
  "dotenv",
  "pg",
  "@prisma/client",
  "@prisma/adapter-pg",
  "bcryptjs",
];

const dependencies = {};
for (const name of keep) {
  const version = source.dependencies?.[name] ?? source.devDependencies?.[name];
  if (!version) throw new Error(`Dependência ausente no package.json: ${name}`);
  dependencies[name] = version;
}

writeFileSync(
  process.argv[3],
  `${JSON.stringify(
    {
      name: "beni-tools",
      private: true,
      type: "module",
      dependencies,
      allowScripts: source.allowScripts,
    },
    null,
    2,
  )}\n`,
);

#!/bin/sh
set -e

# Falha imediata e explicada quando não há banco configurado. Sem isto o app
# passa 60 segundos tentando conectar em lugar nenhum antes de morrer, e o
# painel mostra só um serviço vermelho com log vazio.
if [ -z "${DATABASE_URL:-}" ] && [ -z "${PGHOST:-}" ]; then
  echo "✗ Banco não configurado — o Beni não tem onde guardar os dados."
  echo ""
  echo "  Defina as variáveis de ambiente do serviço:"
  echo "    PGHOST=<projeto>_<serviço do postgres>   ex.: gob_banco"
  echo "    PGPORT=5432"
  echo "    PGUSER=<usuário>"
  echo "    PGPASSWORD=<senha do serviço>"
  echo "    PGDATABASE=<banco>"
  echo "    PGSCHEMA=beni        (opcional: isola o Beni num schema só dele)"
  echo "    AUTH_SECRET=<string longa e aleatória>"
  echo ""
  echo "  Ou, alternativamente, um DATABASE_URL completo."
  exit 1
fi

if [ -z "${AUTH_SECRET:-}" ]; then
  echo "✗ AUTH_SECRET ausente — sem ele não dá para assinar a sessão e ninguém"
  echo "  consegue entrar. Gere uma string longa e aleatória e defina no serviço."
  exit 1
fi

# O CLI do Prisma só lê DATABASE_URL. Em plataformas que entregam as variáveis
# PG* separadas (EasyPanel), montamos a URL aqui — mesma regra de
# src/lib/database-url.ts, inclusive a codificação da senha.
if [ -z "${DATABASE_URL:-}" ] && [ -n "${PGHOST:-}" ]; then
  DATABASE_URL=$(node -e '
    const e = process.env;
    const user = encodeURIComponent(e.PGUSER || "postgres");
    const pass = e.PGPASSWORD ? ":" + encodeURIComponent(e.PGPASSWORD) : "";
    const db = encodeURIComponent(e.PGDATABASE || "postgres");
    const ssl = e.PGSSLMODE ? "&sslmode=" + e.PGSSLMODE : "";
    process.stdout.write(`postgresql://${user}${pass}@${e.PGHOST}:${e.PGPORT || 5432}/${db}?schema=${e.PGSCHEMA || "public"}${ssl}`);
  ')
  export DATABASE_URL
  echo "→ Banco: ${PGUSER:-postgres}@${PGHOST}:${PGPORT:-5432}/${PGDATABASE:-postgres} (schema ${PGSCHEMA:-public})"
fi

echo "→ Aguardando o banco de dados…"
tries=0
until node scripts/ensure-schema.mjs >/tmp/schema.log 2>&1; do
  tries=$((tries + 1))
  if [ "$tries" -ge 30 ]; then
    echo "✗ Banco inacessível ou schema não pôde ser criado:"
    cat /tmp/schema.log
    exit 1
  fi
  sleep 2
done
cat /tmp/schema.log

tries=0
until npx prisma migrate deploy >/tmp/migrate.log 2>&1; do
  tries=$((tries + 1))
  if [ "$tries" -ge 30 ]; then
    echo "✗ Não foi possível aplicar as migrations após 30 tentativas:"
    cat /tmp/migrate.log
    exit 1
  fi
  sleep 2
done
cat /tmp/migrate.log
echo "✔ Migrations aplicadas"

# O seed é idempotente: não faz nada se o usuário admin já existir.
if [ "${SEED_ON_START:-true}" = "true" ]; then
  echo "→ Populando dados iniciais…"
  npx tsx prisma/seed.ts || echo "⚠ Seed falhou (seguindo mesmo assim)"
fi

echo "→ Iniciando o Beni em http://0.0.0.0:${PORT:-3000}"
exec "$@"

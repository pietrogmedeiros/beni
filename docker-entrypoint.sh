#!/bin/sh
set -e

echo "→ Aguardando o banco de dados…"
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

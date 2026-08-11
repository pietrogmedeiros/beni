# ————————————————————————————————————————————————
# Beni — imagem de produção
# ————————————————————————————————————————————————
FROM node:24-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ————— dependências completas (para o build) —————
FROM base AS deps
COPY package.json package-lock.json* ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

# ————— build —————
FROM base AS builder
# O prefixo do endereço entra nos pacotes do navegador: é decidido aqui, não
# no runtime. Padrão /workspace; passe BASE_PATH="" para servir na raiz.
ARG BASE_PATH
ENV BASE_PATH=${BASE_PATH:-/workspace}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# `npm run build` roda `prisma generate` e depois `next build`
RUN npm run build

# ————— ferramentas de runtime: só o necessário p/ migrar e semear —————
FROM base AS tools
WORKDIR /tools
COPY package.json ./source-package.json
COPY scripts/tools-package.mjs ./tools-package.mjs
RUN node tools-package.mjs source-package.json package.json \
  && npm install --omit=dev --no-audit --no-fund

# ————— runtime —————
FROM base AS runner
ARG BASE_PATH
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV BASE_PATH=${BASE_PATH:-/workspace}
ENV NEXT_PUBLIC_BASE_PATH=${BASE_PATH:-/workspace}

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# servidor Next auto-contido (traz o próprio node_modules mínimo)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# CLI do Prisma + tsx, usados só pelo entrypoint (migrations e seed)
COPY --from=tools --chown=nextjs:nodejs /tools/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/src/generated ./src/generated
# a reindexação da busca roda pelo entrypoint e importa este módulo — ele é
# autocontido de propósito, justamente para caber na imagem de runtime
COPY --from=builder --chown=nextjs:nodejs /app/src/server/search-core.ts ./src/server/search-core.ts
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts /app/tsconfig.json ./

COPY --chown=nextjs:nodejs docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000'+(process.env.BASE_PATH||'')+'/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]

# ————————————————————————————————————————————————
# Beni — imagem de produção
# ————————————————————————————————————————————————
FROM node:24-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ————— build —————
FROM base AS builder
# O prefixo do endereço entra nos pacotes do navegador: é decidido aqui, não
# no runtime. Vazio = raiz do domínio; passe BASE_PATH=/algo para servir sob
# um caminho.
ARG BASE_PATH=""
ENV BASE_PATH=${BASE_PATH}
COPY . .
# A checagem de tipos é feita antes do push (`tsc --noEmit`), não aqui: ela
# custava 102s de cada implantação sem acrescentar informação nova.
ENV SKIP_TYPECHECK=1
# O cache do Turbopack sobrevive entre implantações e corta o tempo de
# compilação pela metade — só o que mudou é recompilado.
# `node_modules` também fica num cache do BuildKit. Assim ele está disponível
# durante a compilação, mas não vira uma camada intermediária enorme — gravar
# essa camada travava o build por dezenas de minutos no servidor do EasyPanel.
# `npm ci` garante que o conteúdo continua exatamente alinhado ao lockfile.
RUN --mount=type=cache,target=/root/.npm \
    --mount=type=cache,target=/app/node_modules \
    --mount=type=cache,target=/app/.next/cache \
    npm ci --ignore-scripts && npm run build

# ————— ferramentas de runtime: só o necessário p/ migrar e semear —————
FROM base AS tools
WORKDIR /tools
COPY package.json ./source-package.json
COPY scripts/tools-package.mjs ./tools-package.mjs
# Tentei podar @prisma/studio-core e @prisma/dev daqui (60 MB que nunca são
# abertos, já que só rodamos migrations): o CLI do Prisma exige o studio-core
# logo no carregamento e quebra com MODULE_NOT_FOUND. Ficam.
RUN --mount=type=cache,target=/root/.npm node tools-package.mjs source-package.json package.json \
  && npm install --omit=dev --no-audit --no-fund

# ————— runtime —————
FROM base AS runner
ARG BASE_PATH=""
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV BASE_PATH=${BASE_PATH}
ENV NEXT_PUBLIC_BASE_PATH=${BASE_PATH}
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

# Diretório dos anexos. Precisa existir e pertencer ao usuário do app antes do
# USER nextjs; em produção monte um volume aqui, senão os arquivos somem a cada
# implantação e os registros no banco apontam para o vazio.
RUN mkdir -p /app/uploads && chown nextjs:nodejs /app/uploads
VOLUME ["/app/uploads"]

COPY --chown=nextjs:nodejs docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Carimbo do build, exposto em /api/version. É a última camada de propósito:
# quando tudo antes vem do cache, a imagem é a mesma e o carimbo continua o
# mesmo — o que também é a resposta certa. Serve para conferir, de fora, se uma
# implantação realmente pegou, em vez de caçar diferenças na tela.
RUN date -u +%Y-%m-%dT%H:%M:%SZ > /app/.build-stamp \
  && chown nextjs:nodejs /app/.build-stamp

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000'+(process.env.BASE_PATH||'')+'/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]

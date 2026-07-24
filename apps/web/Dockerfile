FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps/web apps/web
COPY packages packages
COPY scripts scripts
RUN pnpm install --frozen-lockfile --ignore-scripts
# O Next "assa" os rewrites no build (routes-manifest.json), entao o alvo do
# proxy /api precisa estar definido AQUI, nao so em runtime.
ARG API_PROXY_TARGET=http://api:3001
ENV API_PROXY_TARGET=${API_PROXY_TARGET}
RUN pnpm --filter @viralforge/web build

FROM node:20-alpine AS runner
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app
COPY --from=builder /app/apps/web/.next apps/web/.next
COPY --from=builder /app/apps/web/public apps/web/public
COPY --from=builder /app/apps/web/package.json apps/web/
COPY --from=builder /app/apps/web/next.config.mjs apps/web/
COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/apps/web/node_modules apps/web/node_modules
ENV NODE_ENV=production
EXPOSE 3000
CMD ["apps/web/node_modules/.bin/next", "start", "apps/web", "-p", "3000"]

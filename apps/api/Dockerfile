FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps/api apps/api
COPY packages packages
RUN pnpm install --frozen-lockfile --ignore-scripts
RUN pnpm --filter @viralforge/database exec prisma generate
RUN pnpm --filter @viralforge/shared build
RUN pnpm --filter @viralforge/database build
RUN pnpm --filter @viralforge/api build

FROM node:20-alpine AS runner
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
RUN apk add --no-cache ffmpeg wget
WORKDIR /app
COPY --from=builder /app/packages packages
COPY --from=builder /app/apps/api/dist apps/api/dist
COPY --from=builder /app/apps/api/package.json apps/api/
COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/packages/database/prisma packages/database/prisma
ENV NODE_ENV=production
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=5s --retries=3 --start-period=30s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health/live || exit 1
CMD ["node", "apps/api/dist/apps/api/src/main.js"]

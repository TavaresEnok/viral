FROM node:20-bookworm-slim AS builder
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
RUN apt-get update && apt-get install -y cmake g++ libopencv-dev wget python3 python3-pip && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps/worker apps/worker
COPY packages packages
COPY scripts scripts
RUN pnpm install --frozen-lockfile --ignore-scripts
RUN pnpm --filter @viralforge/database exec prisma generate
RUN pnpm --filter @viralforge/shared build
RUN pnpm --filter @viralforge/database build
RUN pnpm --filter @viralforge/clip-analyzer build
RUN pnpm --filter @viralforge/render-engine build
RUN pnpm --filter @viralforge/face-engine build
RUN pnpm --filter @viralforge/worker build

FROM node:20-bookworm-slim AS runner
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
# ffmpeg + libopencv = engine de render PADRAO (FFmpeg + face-engine).
# chromium = engine OPCIONAL Remotion (RENDER_ENGINE=remotion), usado via
# REMOTION_BROWSER_EXECUTABLE para nao depender de download em runtime.
RUN apt-get update && apt-get install -y ffmpeg libopencv-dev python3 wget chromium && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /app/packages packages
COPY --from=builder /app/apps/worker/dist apps/worker/dist
COPY --from=builder /app/apps/worker/package.json apps/worker/
COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/apps/worker/node_modules apps/worker/node_modules
COPY --from=builder /app/packages/database/prisma packages/database/prisma
# scripts operacionais (make-admin, seed, etc.) rodaveis via tsx dentro da imagem
COPY --from=builder /app/scripts scripts
COPY --from=builder /app/package.json /app/tsconfig.base.json ./
# Symlinks dos pacotes workspace no node_modules raiz, para que scripts em
# /app/scripts (ESM) resolvam @viralforge/* (o pnpm so os cria por-pacote).
RUN mkdir -p node_modules/@viralforge && \
    for p in shared database clip-analyzer render-engine face-engine; do \
      ln -sf /app/packages/$p node_modules/@viralforge/$p; \
    done
ENV NODE_ENV=production
# Remotion usa o chromium do sistema em vez de baixar chrome-headless-shell
ENV REMOTION_BROWSER_EXECUTABLE=/usr/bin/chromium
HEALTHCHECK --interval=15s --timeout=5s --retries=3 --start-period=30s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3012/health || exit 1
CMD ["node", "apps/worker/dist/apps/worker/src/main.js"]

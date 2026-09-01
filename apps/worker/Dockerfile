FROM node:22-trixie-slim AS builder
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
RUN apt-get update && apt-get install -y cmake g++ libopencv-dev wget python3 python3-pip && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps/worker apps/worker
COPY packages packages
COPY scripts scripts
RUN pnpm install --frozen-lockfile --ignore-scripts
# --ignore-scripts acima é hardening deliberado (evita postinstall arbitrário
# de qualquer dependência transitiva). youtube-dl-exec precisa do seu proprio
# postinstall para baixar o binario real do yt-dlp — sem isso, download por
# URL (YouTube/TikTok/Instagram/Kwai) falha com ENOENT em silencio.
# `pnpm rebuild <pkg>` mostrou-se não confiável aqui (o postinstall upstream é
# fire-and-forget, sem await no topo do script — corrida entre o fetch/pipe e
# o pnpm encerrar o processo do script). Invocar o script diretamente com
# `node` é determinístico: o processo só sai quando o script principal termina.
RUN node node_modules/.pnpm/youtube-dl-exec@*/node_modules/youtube-dl-exec/scripts/postinstall.js && \
    test -s node_modules/.pnpm/youtube-dl-exec@*/node_modules/youtube-dl-exec/bin/yt-dlp
RUN pnpm --filter @viralforge/database exec prisma generate
RUN pnpm --filter @viralforge/shared build
RUN pnpm --filter @viralforge/database build
RUN pnpm --filter @viralforge/clip-analyzer build
RUN pnpm --filter @viralforge/render-engine build
RUN pnpm --filter @viralforge/face-engine build
RUN pnpm --filter @viralforge/worker build

FROM node:22-trixie-slim AS runner
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
# ffmpeg + OpenCV = engine de render PADRAO (FFmpeg + face-engine).
# Aqui vao apenas as libs de RUNTIME que o binario face_engine realmente linka
# (verificado com ldd) — libopencv-dev traria headers e todos os modulos, ~1GB
# desnecessario numa imagem de execucao. Sufixo 410 = OpenCV 4.10 do trixie
# (era 406/OpenCV 4.6 no bookworm; o sufixo acompanha a versao do Debian).
# chromium = engine OPCIONAL Remotion (RENDER_ENGINE=remotion), usado via
# REMOTION_BROWSER_EXECUTABLE para nao depender de download em runtime.
# O chromium responde por ~1GB da imagem e SÓ é usado pelo engine opcional
# Remotion. Quem roda apenas o engine padrão (FFmpeg) pode economizar com
# --build-arg INSTALL_CHROMIUM=false.
# Base trixie (Debian 13): traz ffmpeg 7.1 no lugar do 5.1 e libvulkan 1.4
# no lugar do 1.3.239 — o loader antigo rejeitava em silencio o ICD da NVIDIA
# (que declara API 1.4) e caia no llvmpipe, renderizando por software na CPU.
ARG INSTALL_CHROMIUM=true
RUN apt-get update && apt-get install -y \
      ffmpeg python3 wget \
      libopencv-core410 libopencv-dnn410 libopencv-imgcodecs410 \
      libopencv-imgproc410 libopencv-videoio410 \
    && if [ "$INSTALL_CHROMIUM" = "true" ]; then apt-get install -y chromium; fi \
    && rm -rf /var/lib/apt/lists/*
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

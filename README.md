# ViralForge

Plataforma SaaS de reaproveitamento de vídeo: encontra momentos virais em vídeos longos (upload ou YouTube), transcreve, analisa com IA, corta em 9:16 com reenquadramento por detecção facial, queima legendas, e permite editar, exportar e **publicar direto em YouTube/TikTok/Instagram** — com autenticação completa, quotas por plano, billing (Stripe), brand kit, API pública, admin de IA global e telemetria de pipeline.

**Produção:** `http://168.194.13.20` (web na porta 80 → 3002; API interna na 3001 via rewrite `/api`). Serviços via systemd: `modulo-ia-api`, `modulo-ia-web`, `modulo-ia-worker`, `node-agent` (render acelerado, porta 9873 restrita a localhost).

Estado por área: pipeline de cortes, auth, quotas e publicação = **estável**; billing Stripe e app mobile (`apps/mobile`, Capacitor) = **beta/experimental**. Fallback de IA é controlado por `ALLOW_AI_FALLBACK` (ver `.env.example`). Qualidade de modelo é medida com `corepack pnpm model:compare` (golden set humano em `samples/evaluation/`).

## Requisitos

- Node.js 20+
- Docker + Docker Compose
- FFmpeg e FFprobe instalados
- Corepack habilitado

Este ambiente foi validado com `corepack pnpm`.

## Setup

```bash
corepack prepare pnpm@9.15.9 --activate
corepack pnpm install
corepack pnpm dev:infra
corepack pnpm db:migrate
corepack pnpm db:seed
```

Usuário seed (apenas ambiente local — **nunca rode o seed em produção**):

```bash
# Define a senha do usuário demo. Sem esta variável o seed gera uma senha
# aleatória e a imprime uma única vez no console.
SEED_DEMO_PASSWORD='escolha-uma-senha-forte' corepack pnpm db:seed
```

O login é `demo@viralforge.local`. A senha **não** é versionada: senha fixa em repositório público equivale a conta aberta.

## Rodar

Em terminais separados:

```bash
corepack pnpm dev:api
corepack pnpm dev:worker
WEB_PORT=3002 corepack pnpm --filter @viralforge/web dev
```

URLs:

```text
Web: http://localhost:3002
API: http://localhost:3001
MinIO console: http://localhost:9001
```

## API keys

Entre no app e vá em `/dashboard/settings` para configurar:

- DeepSeek API key
- OpenAI API key para Whisper

As chaves são enviadas para o backend e armazenadas criptografadas no banco. Sem chaves, o worker usa fallback local para permitir teste do pipeline.

## Performance do worker

Defaults para uma máquina com cerca de 10 CPUs:

```env
WORKER_CONCURRENCY=1
RENDER_CLIP_CONCURRENCY=5
FFMPEG_THREADS=2
FFMPEG_PRESET=veryfast
REMOTION_CONCURRENCY=8
```

- `WORKER_CONCURRENCY`: quantos jobs da fila rodam ao mesmo tempo. Mantenha `1` para evitar dois projetos pesados competindo.
- `RENDER_CLIP_CONCURRENCY`: quantos cortes do mesmo projeto renderizam em paralelo.
- `FFMPEG_THREADS`: threads por processo FFmpeg. Com 5 cortes paralelos e 2 threads, o render pode ocupar perto de 10 CPUs.
- CPU baixa nas fases de download, transcrição por API e análise por IA é esperado, porque essas etapas dependem de rede/I/O.

## Verificações

```bash
corepack pnpm typecheck
corepack pnpm build
corepack pnpm phase0:test:offline
```

Checklist automatizada de pré-lançamento:

```bash
# Completa: install + typecheck + lint + test + build
corepack pnpm release:check

# Rápida: typecheck + lint + test
corepack pnpm release:check:quick

# CI estrita (warnings falham)
corepack pnpm release:check:ci
```

## Observações

- Upload máximo: 500MB.
- API não processa vídeo; o processamento pesado roda no worker via BullMQ/Redis.
- O projeto local usa Postgres, Redis e MinIO via Docker Compose.
- O download de clips exige autenticação.

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

## Deploy com Docker (single-host)

Todos os serviços sobem em containers, sem instalar nada no host além do Docker:

```bash
docker compose -p viralforge --env-file infra/.env.deploy \
  -f infra/docker-compose.deploy.yml up -d --build
```

Migrações e seed rodam pela imagem do worker (base Debian — o motor de migração
do Prisma não roda no Alpine da API):

```bash
docker compose -p viralforge --env-file infra/.env.deploy \
  -f infra/docker-compose.deploy.yml run --rm --no-deps --entrypoint sh worker \
  -c 'cd packages/database && node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma'
```

Notas do caminho Docker:

- Só o `web` precisa de porta pública; ele faz proxy de `/api` para a API na
  rede interna. `API_PROXY_TARGET` é **build-arg**, porque o Next resolve os
  rewrites em build, não em runtime.
- Defina `cpus`/`mem_limit` por serviço quando o host for compartilhado com
  outra aplicação — o worker sozinho satura CPU durante o render.
- O Chromium (~1GB) só é necessário para o engine opcional Remotion. Rodando só
  o engine padrão (FFmpeg), construa o worker com
  `--build-arg INSTALL_CHROMIUM=false`.

## Armazenamento

Os arquivos ficam em disco local (`STORAGE_ROOT`), compartilhado entre API e
worker por volume. Não há integração S3/MinIO ativa: a API serve os clips
diretamente. Isso implica que **API e worker precisam do mesmo filesystem** —
migrar para S3 é o pré-requisito para rodar o worker em outra máquina.

## Ajustes finos

| Variável | Padrão | Para que serve |
| --- | --- | --- |
| `LLM_MAX_COST_USD` | `0.5` | Teto de custo projetado por análise. Aborta antes de gastar. `0` desativa. |
| `LLM_MAX_OUTPUT_TOKENS` | `8000` | Limite de tokens de resposta do modelo. |
| `LLM_TIMEOUT_MS` | `120000` | Timeout da chamada ao provider. |
| `LLM_MAP_REDUCE` | `true` | Vídeo longo é analisado em janelas em vez de amostrado. `false` volta ao modo antigo. |
| `STORAGE_RETENTION_DAYS` | `14` | Faxina automática de uploads antigos. `0` desativa. |
| `UNVERIFIED_MAX_PROJECTS` | `2` | Teto de projetos para conta sem e-mail verificado. `0` desativa. |
| `QUEUE_METRICS_INTERVAL_MS` | `15000` | Intervalo de amostragem da profundidade da fila. |

## Observabilidade

- API: métricas Prometheus em `GET /metrics`.
- Worker: métricas em `GET /metrics` na `WORKER_HEALTH_PORT` (padrão 3012) —
  inclui `viralforge_queue_depth` (com o estado `dlq`), `viralforge_jobs_total`,
  `viralforge_stage_duration_seconds` e `viralforge_llm_cost_usd_total`.
- Alertas que valem a pena: fila `waiting` crescendo, `dlq` > 0 e aumento de
  `viralforge_jobs_total{status="failed"}`.

## Qualidade dos cortes

O feedback dos usuários vira um benchmark reproduzível:

```bash
corepack pnpm feedback:dataset
corepack pnpm dataset:evaluate -- \
  --dataset benchmarks/feedback/dataset.json \
  --predictions benchmarks/feedback/predictions.json
```

Cortes que o usuário manteve viram ground truth; os que a IA propôs viram
predições. Assim dá para medir se uma troca de modelo melhora ou piora de fato.

## Observações

- Upload máximo: 500MB.
- API não processa vídeo; o processamento pesado roda no worker via BullMQ/Redis.
- O projeto local usa Postgres e Redis via Docker Compose.
- O download de clips exige autenticação.

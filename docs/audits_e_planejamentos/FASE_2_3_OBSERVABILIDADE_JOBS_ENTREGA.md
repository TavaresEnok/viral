# Fases 2 e 3 Parcial - Observabilidade, Jobs e Smoke Tests

Data: 2026-05-22

## Entrega

Foram implementados os blocos seguros e verificáveis das fases de observabilidade, confiabilidade de jobs e testes operacionais.

## Alterações principais

### Health e request tracing

- `GET /health/live`
  - Verifica se o processo responde.
- `GET /health/ready`
  - Verifica DB, Redis e storage local.
- `X-Request-Id`
  - Toda resposta recebe um request id.
  - Erros 500 incluem `requestId` no corpo e no log.

Arquivos:
- `apps/api/src/common/health.controller.ts`
- `apps/api/src/common/request-id.middleware.ts`
- `apps/api/src/common/global-exception.filter.ts`
- `apps/api/src/main.ts`

### Rate limit diferenciado

O throttler agora separa buckets:

- `auth`: login/register/refresh.
- `project-write`: criar projeto, upload, URL do YouTube e retry.
- `global`: demais rotas.

Variáveis novas em `.env.example`:

- `AUTH_RATE_LIMIT`
- `AUTH_RATE_LIMIT_TTL_MS`
- `PROJECT_WRITE_RATE_LIMIT`
- `PROJECT_WRITE_RATE_LIMIT_TTL_MS`

Arquivo:
- `apps/api/src/common/throttler.guard.ts`

### Job IDs determinísticos

BullMQ agora recebe `jobId` determinístico para reduzir duplicação:

- Projeto: `project:{projectId}:process`
- Render de clip: `clip:{clipId}:render`
- Publicação: `clip:{clipId}:publish:{socialAccountId}`

Arquivo:
- `apps/api/src/queue/queue.service.ts`

### Métricas operacionais na tela de Qualidade

A página `/dashboard/quality` passou a mostrar:

- tempo médio total do pipeline;
- tempo médio de download;
- tempo médio de captions;
- tempo médio de ASR;
- tempo médio de IA;
- tempo médio de render;
- uso de GPU remota;
- taxa de fallback;
- taxa de rejeição Pass 2;
- falhas por etapa.

Arquivos:
- `apps/api/src/quality/quality.service.ts`
- `apps/web/src/app/(dashboard)/dashboard/quality/page.tsx`
- `apps/web/src/types/api.types.ts`

### Smoke test de segurança

Adicionado script:

```bash
corepack pnpm smoke:security
```

Ele valida:

- `/health/live`
- `/health/ready`
- headers de segurança;
- `X-Request-Id`;
- login com cookie httpOnly;
- ausência de refresh token no JSON;
- rota protegida negando sem token;
- path traversal básico;
- login inválido falhando.

Arquivos:
- `scripts/security-smoke-test.ts`
- `package.json`

### Systemd preparado

Foram criados unit files e script de instalação para subir automaticamente após reboot:

- `deploy/systemd/viralforge-api.service`
- `deploy/systemd/viralforge-web.service`
- `deploy/systemd/viralforge-worker.service`
- `scripts/install-systemd-services.sh`
- script `corepack pnpm services:install`

Observação: este ambiente não permitiu gravar diretamente em `/etc/systemd/system` sem sudo. O script está pronto para rodar com permissão administrativa.

## Validações executadas

- `corepack pnpm typecheck` passou.
- `corepack pnpm test` passou.
- `corepack pnpm --filter @viralforge/api build` passou.
- `corepack pnpm --filter @viralforge/web build` passou.
- `corepack pnpm smoke:security` passou.

## Pendências reais

- Teste E2E Playwright completo ainda não foi implementado.
- Endpoint/admin de reprocessar DLQ ainda não foi implementado.
- Integrações externas grandes das fases 6, 9 e 10 não foram implementadas nesta passada porque dependem de credenciais, produto e APIs externas.

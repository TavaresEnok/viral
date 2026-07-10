# Fase 0 - Baseline e Metricas: Entrega

Data: 2026-05-22

## Entregue

- Criado model Prisma `PipelineRunMetric` para registrar execucoes de pipeline.
- Criada migration `20260522000000_add_pipeline_run_metrics`.
- Aplicada migration no banco local.
- Instrumentado `VideoProcessorService` para gravar:
  - tempo total do processamento;
  - tempos por etapa em `stageTimings`;
  - duracao do video;
  - origem e qualidade da transcricao;
  - metricas ASR remoto quando houver;
  - modelos/tokens/custo estimado de LLM;
  - candidatos Pass 1, clips Pass 2, aprovados e rejection rate;
  - clips renderizados/falhos;
  - motores de render usados;
  - uso de GPU remota/fallback.
- Criado script `scripts/pipeline-baseline-report.ts`.
- Adicionado comando `baseline:pipeline` no `package.json`.
- Corrigido bug em `scripts/test-clip-analyzer.ts`: o script lia errado o retorno `{ clips, telemetry }` e reportava zero cortes mesmo quando havia cortes.

## Comandos Validados

```bash
corepack pnpm --filter @viralforge/database db:generate
corepack pnpm --filter @viralforge/database exec prisma migrate deploy --schema prisma/schema.prisma
corepack pnpm --filter @viralforge/worker typecheck
corepack pnpm typecheck
corepack pnpm test
corepack pnpm phase0:test:offline
corepack pnpm baseline:pipeline -- --limit=3
```

## Estado Atual

- Typecheck geral: passou.
- Testes: passaram.
- Worker build: passou.
- Database build: passou.
- `viralforge-worker.service`: ativo apos restart.
- `viralforge-api.service`: ativo apos restart.
- Baseline ainda sem registros porque nenhum projeto foi processado depois da migration.

## Como Gerar o Primeiro Baseline Real

1. Processar um video pequeno pela plataforma.
2. Rodar:

```bash
corepack pnpm baseline:pipeline -- --limit=10
```

3. Verificar:

- tempo total;
- gargalo por etapa;
- se GPU remota foi usada;
- rejection rate Pass 2;
- clips renderizados vs falhos;
- fallback usado.

## Proxima Fase Recomendada

Fase 1.2 do plano: migrar rate limit e brute force de memoria para Redis.

Motivo: e uma melhoria de seguranca critica, com impacto direto em producao, e menos arriscada do que trocar todo fluxo de auth para refresh token/httpOnly de uma vez.

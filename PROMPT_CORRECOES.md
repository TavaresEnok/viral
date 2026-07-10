# Prompt de Correções — ViralForge Monorepo

> Copie este prompt inteiro e envie para a IA que fará as correções.
> O prompt é autocontido: inclui contexto, paths, código relevante e o que exatamente mudar.

---

## Contexto do projeto

Você está trabalhando em um monorepo TypeScript chamado **ViralForge** (também referenciado como `clipia`).
Estrutura de pacotes:

```
/
├── apps/
│   ├── api/          NestJS REST API (porta 3001)
│   ├── web/          Next.js frontend (porta 3000)
│   └── worker/       Worker BullMQ que processa vídeos com IA
├── packages/
│   ├── clip-analyzer/  Pacote que chama o LLM para extrair clips virais
│   ├── database/       Prisma client + schema
│   ├── render-engine/  Componentes Remotion para render de vídeo
│   └── shared/         Utilitários compartilhados
```

Gerenciador de pacotes: **pnpm workspaces**.  
Banco: **PostgreSQL via Prisma**.  
Fila: **BullMQ + Redis**.  
LLM padrão: **DeepSeek** via SDK OpenAI-compatível.

---

## Problemas a corrigir — do mais crítico ao menos crítico

---

### CORREÇÃO 1 — Quebrar o God Class `video-processor.service.ts` (CRÍTICO)

**Arquivo:** `apps/worker/src/services/video-processor.service.ts`  
**Problema:** 1970 linhas em um único `@Injectable()`. Impossível testar. Mistura 5 responsabilidades distintas.

**Métodos que devem ser extraídos para novos serviços:**

| Métodos a mover | Novo arquivo a criar |
|---|---|
| `buildTranscript`, `tryBuildYoutubeTranscript`, `loadCachedTranscript`, `saveTranscript`, `saveAsrMetrics` | `apps/worker/src/services/transcript-orchestration.service.ts` |
| `persistClips`, `buildClipData`, `buildClipCreateOps`, `computeFinalScore` | `apps/worker/src/services/clip-persistence.service.ts` |
| `savePipelineRunMetric`, `measure`, `stage`, `upsertProcessingJob` | `apps/worker/src/services/pipeline-metrics.service.ts` |
| `renderClips`, `registerQuotaRender`, `registerQuotaMinutes` | `apps/worker/src/services/render-orchestration.service.ts` |

**O que NÃO mover:** os métodos `process`, `processProject`, `renderSingleClip`, `publishClip`, `resolveOriginalFile`, `onModuleInit`, `onModuleDestroy` ficam no `VideoProcessorService` como orquestrador principal.

**Como fazer:**
1. Crie cada novo arquivo de serviço como `@Injectable()` com as dependências necessárias (Prisma, Logger, etc.).
2. Injete os novos serviços no construtor de `VideoProcessorService`.
3. Substitua as chamadas inline pelas chamadas aos novos serviços.
4. Registre os novos serviços em `apps/worker/src/module.ts` (no array `providers`).
5. Garanta que os tipos compartilhados (`TranscriptWithMetadata`, `PipelineMetricDraft`, `RenderClipsSummary`) sejam movidos para um arquivo `apps/worker/src/types/pipeline.types.ts` e importados por todos os serviços que precisarem.
6. Após a extração, rode `pnpm typecheck` e corrija todos os erros de tipo.

---

### CORREÇÃO 2 — Cobertura de testes nos serviços críticos (CRÍTICO)

Após a extração da Correção 1, crie os seguintes arquivos de teste usando **Vitest**:

#### 2a. `apps/worker/src/services/transcript-orchestration.service.spec.ts`
Teste os cenários:
- `loadCachedTranscript` retorna `null` quando não há transcrição no banco
- `loadCachedTranscript` retorna a transcrição com `segmentsJson` e `wordsJson` parseados corretamente
- `saveTranscript` persiste os campos `source`, `language`, `fullText`, `segmentCount`, `wordCount`
- `buildTranscript` quando `REMOTE_ACCEL_ENABLED !== 'true'` cai para Whisper (mock de `TranscriptionService.transcribeAudio`)
- `buildTranscript` quando `REMOTE_ACCEL_ENABLED === 'true'` tenta remote primeiro e usa o resultado

Use mocks do Prisma com objetos simples (sem banco real). Padrão do projeto: `vi.fn()` e `vi.mock()`.

#### 2b. `apps/worker/src/services/clip-persistence.service.spec.ts`
Teste:
- `buildClipData` transforma `ClipSuggestion[]` em registros válidos para o Prisma
- `safeInt` (ou equivalente na extração) coerce `NaN`, `Infinity`, `undefined` para `0`
- `safeFloat` coerce valores inválidos para `0`
- `computeFinalScore` produz `finalScore` e `breakdown` para um clip com todos os campos preenchidos
- `computeFinalScore` não lança para clip com campos opcionais ausentes

#### 2c. `apps/worker/src/services/rendering.service.spec.ts`
Arquivo já existe em `apps/worker/src/services/`. Adicione testes para:
- `renderClip` quando `renderLayout === 'SMART_REFRAME'` chama `FaceDetectionService.detectFaces`
- `renderClip` quando layout não é SMART não chama face detection
- `prepareRemoteInput` retorna `null` quando `remote.isEnabled()` é false
- `releaseRemoteInput` não lança quando `remoteMediaId` é `null`

#### 2d. `apps/worker/src/services/clip-validation.service.spec.ts` (NOVO)
Teste:
- `validate` filtra clips com `viral_score < minViralScore`
- `validate` remove clips com `duration < 15` ou `duration > 90`
- `validate` deduplica clips com `overlapRatio > 0.65`
- `validate` retorna clips ordenados por score decrescente
- `adjustToSentenceBoundaries` faz snap para início de segmento dentro de 8s
- `adjustToSentenceBoundaries` não faz snap se a diferença for > 8s

#### 2e. `packages/clip-analyzer/src/llm-clip-analyzer.service.spec.ts` (NOVO)
Teste:
- `analyzeTranscript` com `offline: true` retorna clips sem chamar o LLM
- `analyzeTranscript` com `client === undefined` lança erro com mensagem clara
- `analyzeTranscript` quando a API lança erro, `telemetry.pass1Failed === true` e retorna `[]`
- `analyzeTranscript` com resposta JSON malformada retorna `[]` sem lançar
- `buildTranscriptBlock` trunca em `MAX_SEGMENTS` segmentos

**Padrão para mocks do LLM** (use no spec):
```typescript
import { vi } from 'vitest';

const mockCreate = vi.fn().mockResolvedValue({
  usage: { total_tokens: 150 },
  choices: [{ message: { content: JSON.stringify({ clips: [] }) } }],
});

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  })),
}));
```

---

### CORREÇÃO 3 — Token JWT no query param do SSE (SEGURANÇA)

**Problema:** `apps/web/src/hooks/useProjectSSE.ts` passa o JWT como `?token=...` na URL do EventSource. Isso expõe o token em logs do nginx/Sentry e no histórico do navegador.

**Solução: SSE ticket de curta duração**

#### 3a. Backend — novo endpoint em `apps/api/src/jobs/jobs.controller.ts`

Adicione o endpoint `POST /jobs/:projectId/sse-ticket` (requer `JwtAuthGuard` normal):

```typescript
@Post(':projectId/sse-ticket')
@UseGuards(JwtAuthGuard)
async getSseTicket(
  @CurrentUser() user: RequestUser,
  @Param('projectId') projectId: string,
) {
  return this.jobsService.createSseTicket(user.id, projectId);
}
```

#### 3b. Backend — método em `apps/api/src/jobs/jobs.service.ts`

```typescript
async createSseTicket(userId: string, projectId: string): Promise<{ ticket: string; expiresAt: number }> {
  // Verifica que o projeto pertence ao usuário
  const project = await this.prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });
  if (!project) throw new NotFoundException('Projeto não encontrado');

  // Ticket scoped: só vale para este projeto, expira em 90 segundos
  const payload = { sub: userId, projectId, type: 'sse-ticket' };
  const ticket = await this.jwtService.signAsync(payload, { expiresIn: '90s' });
  return { ticket, expiresAt: Date.now() + 90_000 };
}
```

Injete `JwtService` no construtor de `JobsService` (já está disponível via `JwtConfigModule`).

#### 3c. Backend — atualizar `SseAuthGuard` em `apps/api/src/common/sse-auth.guard.ts`

Altere o guard para aceitar tanto JWT normal quanto ticket scoped (verificando que `payload.type === 'sse-ticket'` e `payload.projectId` bate com o param da rota):

```typescript
// No canActivate, após verificar o token:
const payload = await this.jwtService.verifyAsync<{
  sub: string;
  email?: string;
  projectId?: string;
  type?: string;
}>(token);

// Se for ticket scoped, valida o projectId
if (payload.type === 'sse-ticket') {
  const routeProjectId = request.params['projectId'];
  if (payload.projectId !== routeProjectId) {
    throw new UnauthorizedException('Ticket inválido para este projeto');
  }
}

request.user = { id: payload.sub, email: payload.email ?? '' };
return true;
```

#### 3d. Frontend — atualizar `apps/web/src/hooks/useProjectSSE.ts`

Substitua a lógica atual por:

```typescript
'use client';
import { useEffect, useRef, useState } from 'react';
import type { JobStatus } from '@/types/api.types';
import { api } from '@/lib/api';

export function useProjectSSE(projectId: string) {
  const [status, setStatus] = useState<JobStatus | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;

    async function connect() {
      try {
        const { ticket } = await api.jobs.getSseTicket(projectId);
        if (cancelled) return;

        const baseUrl = process.env.NEXT_PUBLIC_API_URL || `http://${window.location.hostname}:3001`;
        const url = `${baseUrl}/jobs/${projectId}/stream?token=${encodeURIComponent(ticket)}`;
        const es = new EventSource(url, { withCredentials: true });
        eventSourceRef.current = es;

        let consecutiveErrors = 0;
        es.onmessage = (event) => {
          consecutiveErrors = 0;
          try { setStatus(JSON.parse(event.data) as JobStatus); } catch { /* ignore */ }
        };
        es.onerror = () => {
          consecutiveErrors++;
          if (consecutiveErrors >= 5) es.close();
        };
      } catch {
        // sem ticket → SSE não disponível, polling vai cobrir
      }
    }

    connect();
    return () => {
      cancelled = true;
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, [projectId]);

  return status;
}
```

#### 3e. Frontend — adicionar `getSseTicket` ao `api` em `apps/web/src/lib/api.ts`

Dentro de `api.jobs`:
```typescript
getSseTicket: (projectId: string) =>
  request<{ ticket: string; expiresAt: number }>(`/jobs/${projectId}/sse-ticket`, { method: 'POST' }),
```

---

### CORREÇÃO 4 — Retry automático com backoff para chamadas ao LLM (RESILIÊNCIA)

**Arquivo:** `packages/clip-analyzer/src/llm-clip-analyzer.service.ts`

**Problema:** se a API do LLM retornar erro de rede ou rate-limit (429), o sistema registra `pass1Failed = true` e retorna `[]` sem tentar novamente. O projeto inteiro falha por uma falha temporária.

**Solução:** adicione uma função `withRetry` local (sem dependência externa) e aplique-a na chamada `this.client.chat.completions.create`:

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 1000,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const isRetryable =
        err instanceof Error &&
        (err.message.includes('429') ||
          err.message.includes('rate') ||
          err.message.includes('timeout') ||
          err.message.includes('ECONNRESET') ||
          err.message.includes('ENOTFOUND'));
      if (!isRetryable || attempt === maxAttempts) throw err;
      await new Promise((res) => setTimeout(res, baseDelayMs * 2 ** (attempt - 1)));
    }
  }
  throw lastError;
}
```

Envolva a chamada no `analyzeTranscript`:
```typescript
// Antes:
const completion = await this.client.chat.completions.create({ ... });

// Depois:
const completion = await withRetry(() => this.client!.chat.completions.create({ ... }));
```

Aplique o mesmo padrão para o Pass 2 se existir.

---

### CORREÇÃO 5 — Swagger / OpenAPI na API NestJS (DOCUMENTAÇÃO)

**Arquivo:** `apps/api/package.json` e `apps/api/src/main.ts`

#### 5a. Instalar a dependência:
```bash
pnpm --filter @viralforge/api add @nestjs/swagger
```

#### 5b. Configurar em `apps/api/src/main.ts`

Adicione após `app.useGlobalFilters(...)`:

```typescript
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

// Swagger disponível apenas fora de produção (ou com SWAGGER_ENABLED=true)
if (process.env.NODE_ENV !== 'production' || process.env.SWAGGER_ENABLED === 'true') {
  const swaggerConfig = new DocumentBuilder()
    .setTitle('ViralForge API')
    .setDescription('API do ViralForge — processamento de vídeo com IA')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);
  new Logger('API').log('Swagger disponível em /api/docs');
}
```

#### 5c. Adicionar `@ApiTags` nos controllers principais

Adicione o decorator `@ApiTags('nome-do-modulo')` nos controllers:
- `apps/api/src/auth/auth.controller.ts` → `@ApiTags('auth')`
- `apps/api/src/projects/projects.controller.ts` → `@ApiTags('projects')`
- `apps/api/src/clips/clips.controller.ts` → `@ApiTags('clips')`
- `apps/api/src/jobs/jobs.controller.ts` → `@ApiTags('jobs')`
- `apps/api/src/billing/billing.controller.ts` → `@ApiTags('billing')`
- `apps/api/src/settings/settings.controller.ts` → `@ApiTags('settings')`
- `apps/api/src/admin/admin.controller.ts` → `@ApiTags('admin')`
- `apps/api/src/publish/publish.controller.ts` → `@ApiTags('publish')`
- `apps/api/src/quality/quality.controller.ts` → `@ApiTags('quality')`
- `apps/api/src/quota/quota.controller.ts` → `@ApiTags('quota')`

Importe `ApiTags` de `@nestjs/swagger`.

---

### CORREÇÃO 6 — Tipos TypeScript para campos `Json?` do Prisma (QUALIDADE DE CÓDIGO)

**Problema:** vários campos no schema Prisma são `Json?` e são usados com `as never` ou `as unknown` no código, perdendo type safety.

#### 6a. Criar `packages/database/src/json-types.ts`

```typescript
// Tipos TypeScript para os campos Json do Prisma

export interface ScoreBreakdown {
  openingScore: number;
  closingScore: number;
  contextScore: number;
  emotionalScore: number;
  quotabilityScore: number;
  rankScore: number;
}

export interface StageTimings {
  [stage: string]: number;
}

export interface RenderEngines {
  [engine: string]: number;
}

export interface QualityWarnings {
  warnings: string[];
  score: number;
}

export interface SubtitleSegment {
  start: number;
  end: number;
  text: string;
}

export interface FaceTrack {
  frame: number;
  x: number;
  y: number;
  width: number;
  height: number;
}
```

#### 6b. Exportar de `packages/database/src/index.ts`

Adicione:
```typescript
export * from './json-types.js';
```

#### 6c. Substituir `as never` nos serviços

Nos arquivos do worker, substitua os casts `as never` por imports e uso dos tipos:
- `scoreBreakdown: score.breakdown as never` → `scoreBreakdown: score.breakdown as unknown as Prisma.InputJsonValue`
- `stageTimings: metric.stageTimings as never` → idem

O objetivo é eliminar `as never` (que suprime erros do TS sem verificação) e usar `satisfies` ou `Prisma.InputJsonValue` explicitamente.

---

### CORREÇÃO 7 — Endpoint de métricas Prometheus básico (OBSERVABILIDADE)

**Problema:** sem métricas de runtime exportadas, não há como monitorar a API em produção sem entrar nos logs.

#### 7a. Instalar dependência:
```bash
pnpm --filter @viralforge/api add prom-client
```

#### 7b. Criar `apps/api/src/common/metrics.controller.ts`

```typescript
import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { register, collectDefaultMetrics, Counter, Histogram } from 'prom-client';
import { MasterSecretGuard } from './master-secret.guard.js';

collectDefaultMetrics();

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duração das requisições HTTP',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5],
});

export const pipelineJobsTotal = new Counter({
  name: 'pipeline_jobs_total',
  help: 'Total de jobs de pipeline processados',
  labelNames: ['status'],
});

@Controller('metrics')
export class MetricsController {
  @Get()
  @UseGuards(MasterSecretGuard)
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async metrics(): Promise<string> {
    return register.metrics();
  }
}
```

#### 7c. Adicionar `MetricsController` ao `HealthModule` (ou criar `MetricsModule`)

Em `apps/api/src/common/health.module.ts`, adicione `MetricsController` ao array `controllers`.

#### 7d. Instrumentar o pipeline no worker

Em `apps/worker/src/services/pipeline-metrics.service.ts` (criado na Correção 1), importe `prom-client` e incremente `pipelineJobsTotal` no método `savePipelineRunMetric`:

```typescript
import { pipelineJobsTotal } from '@viralforge/api/common/metrics.controller.js'; // se export foi feito
// OU redefina localmente com o mesmo nome de métrica para que o Prometheus agregue
```

Alternativa mais simples: exponha um endpoint `/metrics` apenas na API e registre via logs estruturados no worker — o Prometheus pode coletar pela API.

---

### CORREÇÃO 8 — Singleton `PlatformAiConfig` — tornar explícito (MODELO DE DADOS)

**Arquivo:** `packages/database/prisma/schema.prisma`

**Problema:** `model PlatformAiConfig { id String @id @default("default") }` é um antipattern. Se alguém inserir um registro com id diferente, o código que faz `findUnique({ where: { id: 'default' } })` silenciosamente ignora.

**Solução mínima sem migration disruptiva:** adicionar um constraint de check via raw SQL na migration, e tornar explícito no código que usa o modelo.

Em `apps/api/src/admin/admin.service.ts` (ou onde `PlatformAiConfig` for lido/escrito), substitua todos os `prisma.platformAiConfig.findUnique({ where: { id: 'default' } })` por uma constante:

```typescript
const PLATFORM_AI_CONFIG_ID = 'default' as const;
// e use em todas as queries
await this.prisma.platformAiConfig.upsert({
  where: { id: PLATFORM_AI_CONFIG_ID },
  create: { id: PLATFORM_AI_CONFIG_ID, ...data },
  update: data,
});
```

Crie `apps/api/src/admin/platform-ai-config.constants.ts`:
```typescript
export const PLATFORM_AI_CONFIG_ID = 'default' as const;
```

Importe e use essa constante em todo lugar que referencie o id `'default'` hardcoded.

---

## O que NÃO fazer

- Não altere o schema do Prisma sem criar migration (`pnpm --filter @viralforge/database exec prisma migrate dev --name <nome>`).
- Não mova a lógica de publicação (`publishClip`) para fora do `VideoProcessorService` nesta rodada — ela tem muitas dependências de estado local.
- Não instale bibliotecas de retry externas (ex.: `p-retry`) — use a função `withRetry` local da Correção 4.
- Não adicione `console.log` — use `this.logger.log()` (NestJS Logger) ou `this.logger()` (função passada no clip-analyzer).
- Não remova os testes existentes — apenas adicione novos.

---

## Validação final (rode nesta ordem)

```bash
# 1. Verificar tipos
pnpm typecheck

# 2. Lint estrito
pnpm lint:strict

# 3. Testes (todos devem passar, incluindo os novos)
pnpm test

# 4. Build completo
pnpm build

# 5. Validar entrypoints Docker
test -f apps/api/dist/apps/api/src/main.js && echo "API OK"
test -f apps/worker/dist/apps/worker/src/main.js && echo "Worker OK"
```

Se algum passo falhar, corrija antes de considerar a tarefa concluída.

---

## Prioridade de execução sugerida

1. **Correção 3** (SSE ticket) — mudança de segurança, menor risco de quebrar algo
2. **Correção 4** (retry LLM) — aumenta resiliência imediatamente
3. **Correção 1** (quebrar God Class) — pré-requisito para os testes
4. **Correção 2** (testes) — após extração
5. **Correção 5** (Swagger) — não quebra nada, adiciona valor
6. **Correção 6** (tipos Json) — qualidade de código
7. **Correção 7** (Prometheus) — opcional se não houver infraestrutura de coleta
8. **Correção 8** (constante PlatformAiConfig) — baixo risco, alta clareza

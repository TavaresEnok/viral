# Prompt Mestre para Auditoria do ViralForge com DeepSeek v4

Use este documento como prompt inicial para uma IA externa auditar o sistema ViralForge. A IA deve agir como arquiteto principal, auditor de segurança, engenheiro de produto, engenheiro de performance e analista competitivo. A saída esperada é um plano grande, estruturado e verificável para levar o produto de MVP para produção.

## Contexto do Produto

O produto se chama **ViralForge**.

É uma aplicação para transformar vídeos longos em cortes verticais para Reels, Shorts e TikTok. O fluxo principal é:

1. Usuário cria projeto.
2. Usuário envia link do YouTube ou upload de vídeo.
3. Worker baixa vídeo ou usa arquivo enviado.
4. Worker extrai áudio via FFmpeg.
5. Sistema obtém transcrição por legenda do YouTube ou ASR externo.
6. Pipeline LLM em duas passagens escolhe candidatos de cortes.
7. Backend valida e salva os clips.
8. Worker renderiza os cortes em 9:16 com legenda queimada.
9. Front-end mostra resultados e permite abrir editor profissional.

Objetivo estratégico: superar ou pelo menos se aproximar de ferramentas como OpusClip, Vizard, Captions, Klap, Vidyo.ai e similares, começando por qualidade de cortes, confiabilidade, UX e velocidade.

## Stack Atual

Monorepo TypeScript com pnpm.

```text
apps/web       Next.js 14, React 18, Tailwind, Zustand, TanStack Query
apps/api       NestJS, Prisma, JWT, BullMQ producer
apps/worker    Nest application context, BullMQ worker, FFmpeg, YouTube download, ASR, render
packages/database      Prisma schema/client
packages/shared        Tipos compartilhados e crypto secrets
packages/clip-analyzer Pipeline LLM de seleção de cortes
packages/render-engine Remotion renderer para clips verticais
infra/docker-compose.yml Postgres, Redis, MinIO
```

Scripts principais:

```bash
corepack pnpm dev:infra
corepack pnpm dev:api
corepack pnpm dev:worker
WEB_PORT=3002 corepack pnpm --filter @viralforge/web dev
corepack pnpm typecheck
corepack pnpm build
```

Observação: nomes técnicos de pacotes ainda usam `@viralforge/*`, mas o produto/UX deve se chamar `ViralForge`.

## Arquivos e Áreas Relevantes

### Web

```text
apps/web/src/app/page.tsx
apps/web/src/app/(auth)/login/page.tsx
apps/web/src/app/(auth)/register/page.tsx
apps/web/src/app/(dashboard)/layout.tsx
apps/web/src/app/(dashboard)/dashboard/page.tsx
apps/web/src/app/(dashboard)/dashboard/[id]/page.tsx
apps/web/src/app/(dashboard)/dashboard/[id]/editor/page.tsx
apps/web/src/app/(dashboard)/dashboard/[id]/editor/[clipId]/page.tsx
apps/web/src/app/(dashboard)/dashboard/new/page.tsx
apps/web/src/app/(dashboard)/dashboard/settings/page.tsx
apps/web/src/app/(dashboard)/dashboard/billing/page.tsx
apps/web/src/app/(dashboard)/dashboard/brand/page.tsx
apps/web/src/app/(dashboard)/dashboard/analytics/page.tsx
apps/web/src/app/(dashboard)/dashboard/quality/page.tsx
apps/web/src/components/project/NewProjectModal.tsx
apps/web/src/components/project/ProjectGrid.tsx
apps/web/src/components/project/ProjectCard.tsx
apps/web/src/components/clip/ClipGrid.tsx
apps/web/src/components/clip/VideoPlayer.tsx
apps/web/src/components/processing/ProcessingTimeline.tsx
apps/web/src/components/layout/Sidebar.tsx
apps/web/src/components/layout/DashboardShell.tsx
apps/web/src/lib/api.ts
apps/web/src/stores/auth.store.ts
```

### API

```text
apps/api/src/main.ts
apps/api/src/auth/auth.service.ts
apps/api/src/auth/auth.controller.ts
apps/api/src/projects/projects.service.ts
apps/api/src/projects/projects.controller.ts
apps/api/src/clips/clips.service.ts
apps/api/src/clips/clips.controller.ts
apps/api/src/jobs/jobs.service.ts
apps/api/src/settings/settings.service.ts
apps/api/src/quality/quality.service.ts
apps/api/src/queue/queue.service.ts
```

### Worker e Pipeline

```text
apps/worker/src/worker-runner.ts
apps/worker/src/services/video-processor.service.ts
apps/worker/src/services/youtube-download.service.ts
apps/worker/src/services/transcription.service.ts
apps/worker/src/services/ffmpeg.service.ts
apps/worker/src/services/rendering.service.ts
apps/worker/src/services/remotion-render.service.ts
apps/worker/src/services/subtitle.service.ts
apps/worker/src/services/clip-validation.service.ts
apps/worker/src/services/api-key.service.ts
```

### Clip Analyzer

```text
packages/clip-analyzer/src/llm-clip-analyzer.service.ts
packages/clip-analyzer/src/pass1-runner.ts
packages/clip-analyzer/src/pass2-runner.ts
packages/clip-analyzer/src/json-parsing.ts
packages/clip-analyzer/src/text-validation.ts
packages/clip-analyzer/src/schemas/pass1.schema.ts
packages/clip-analyzer/src/schemas/pass2.schema.ts
packages/clip-analyzer/src/prompts/system.txt
packages/clip-analyzer/src/prompts/user-template-pass1.txt
packages/clip-analyzer/src/prompts/user-template-pass2.txt
```

### Render Engine

```text
packages/render-engine/src/VerticalClip.tsx
packages/render-engine/src/AnimatedCaption.tsx
packages/render-engine/src/VideoCanvas.tsx
packages/render-engine/src/theme.ts
packages/render-engine/src/text.ts
packages/render-engine/src/types.ts
```

### Banco

```text
packages/database/prisma/schema.prisma
packages/database/prisma/seed.ts
```

## Snapshot Funcional Atual

### O que já existe

- Autenticação básica com e-mail/senha e JWT.
- Criação de projetos.
- Upload de vídeo e URL do YouTube.
- Fila BullMQ.
- Worker assíncrono.
- Transcrição via YouTube captions ou ASR externo configurado.
- Análise de cortes por LLM em Pass 1 e Pass 2.
- Validação heurística dos cortes.
- Renderização FFmpeg e fallback/integração Remotion.
- Página de resultados limpa, parecida com mockup Lovable.
- Editor profissional para ajuste de in/out e re-render.
- Configuração de providers LLM e ASR.
- Exclusão de projeto e corte.
- Timeout automático para renders/projetos travados.
- Controle inicial de concorrência do worker/render.

### Problemas e riscos já percebidos

- Produto ainda é MVP, não produção.
- Várias áreas parecem mockadas ou incompletas: billing, brand, analytics, quality, talvez landing/autenticação avançada.
- Segurança ainda precisa de auditoria forte.
- Sem rate limit visível.
- Sem recuperação robusta de jobs em falha/stalled além de timeouts básicos.
- Download de arquivos é autenticado, mas precisa revisar path traversal, streaming, range requests, MIME, autorização e exposição de arquivos.
- Login/register precisam de hardening contra brute force, enumeração e senha fraca.
- JWT e secrets estão simples para dev.
- Provider API keys são criptografadas, mas precisa revisar rotação, validação, masking e logs.
- Worker depende de APIs externas; CPU baixa em etapas de rede é normal.
- Render foi otimizado recentemente para paralelismo, mas precisa benchmark real.
- ASR local ainda não está implementado.
- Publicação social, scheduler, pagamentos, times/workspaces e cloud deploy ainda parecem ausentes ou incompletos.
- Testes automatizados são insuficientes.
- Observabilidade real provavelmente é fraca: logs, métricas, tracing, alertas, auditoria de jobs.

## Missão da IA Auditora

Você deve produzir uma auditoria completa e um plano de evolução do ViralForge de MVP para produção.

Não escreva código ainda. Não proponha mudanças vagas. Não diga apenas “melhorar segurança”. Para cada problema, diga:

- Arquivo ou área afetada.
- Evidência no código ou comportamento esperado.
- Severidade: `P0`, `P1`, `P2`, `P3`.
- Tipo: `bug`, `security`, `performance`, `architecture`, `product`, `ux`, `data`, `observability`, `testing`, `devops`, `competitive-gap`.
- Risco real se não corrigir.
- Solução proposta.
- Critério de aceite binário.
- Testes necessários.
- Ordem de implementação.

## Critérios de Severidade

```text
P0 = impede uso, perda de dados, vazamento de dados, execução remota, bypass de auth, cobrança errada, fila travada globalmente.
P1 = bug grave, risco de segurança relevante, falha recorrente de processamento, degradação forte de UX, custo descontrolado.
P2 = melhoria importante para produção, confiabilidade, manutenção, performance, UX ou qualidade.
P3 = polimento, refatoração menor, melhoria futura.
```

## Áreas Obrigatórias de Auditoria

### 1. Produto e UX

Audite:

- Landing page pública.
- Login/register.
- Dashboard de projetos.
- Criação de projeto.
- Página de processamento.
- Página de resultados.
- Player dos cortes.
- Editor profissional.
- Settings / Integrações IA.
- Billing.
- Brand kit.
- Analytics.
- Quality page.
- Responsividade mobile.
- Acessibilidade.
- Empty states.
- Error states.
- Loading states.
- Consistência da marca ViralForge.

Compare com:

- OpusClip.
- Vizard.
- Klap.
- Vidyo.ai.
- Captions.
- Submagic.

Para cada concorrente, identifique:

- Features essenciais que ViralForge não tem.
- Padrões de UX superiores.
- Diferenciais defensáveis que ViralForge poderia criar.
- Gap competitivo por prioridade.

### 2. Segurança

Audite profundamente:

- Autenticação JWT.
- Registro e login.
- Senhas e bcrypt.
- Rate limiting ausente.
- CORS.
- Upload de arquivos.
- Validação MIME/extensão.
- Path traversal.
- Download/thumbnail/subtitle endpoints.
- Autorização multiusuário.
- Exposição de arquivos locais.
- Secrets no `.env`.
- Criptografia de API keys.
- Logs que podem vazar secrets.
- Validação de URL do YouTube.
- SSRF via URL de entrada.
- Prompt injection via transcript ou título de vídeo.
- Queue job spoofing.
- MinIO/Postgres/Redis defaults.
- Headers de segurança.
- CSRF se aplicável.
- XSS em campos vindos da transcrição/títulos/hooks.
- Limites de upload e DoS.
- Limites de custo de IA e render.

Exija recomendações concretas como:

- Rate limit por IP/usuário.
- Sanitização/allowlist de URLs.
- Streaming seguro de arquivos.
- Assinatura ou autorização de jobs.
- Validação de tamanho/duração.
- Quotas por usuário/plano.
- Redaction de logs.
- Rotação de secrets.
- Política de retenção de vídeos.

### 3. Backend/API

Audite:

- Controllers e services NestJS.
- DTOs e ValidationPipe.
- Tratamento de erros.
- Contratos de API.
- Paginação em listagens.
- Queries Prisma e índices.
- Transações.
- Consistência de status de Project/Clip/ProcessingJob.
- Idempotência de retry/upload/Youtube.
- Cancelamento de jobs.
- Exclusão em cascata e arquivos no disco.
- Limpeza de storage órfão.
- API de status/progresso.
- Respostas padronizadas.

### 4. Worker e Fila

Audite:

- BullMQ producer/consumer.
- Concorrência.
- Retentativas.
- Jobs stalled.
- Dead letter queue.
- Idempotência do processamento.
- Reprocessamento.
- Render single clip.
- Render batch.
- Timeouts.
- Marcação automática de falhas.
- Logs e métricas.
- Progress reporting por etapa.
- Resiliência se API externa falha.
- Controle de custo de LLM/ASR.
- Cancelamento manual.
- Consumo de CPU/RAM/disk.

### 5. Transcrição / ASR

Audite:

- Uso de YouTube captions.
- Avaliação de qualidade de transcrição.
- Fallback ASR externo.
- Suporte a ASR local futuro.
- Chunking de áudio.
- Timestamps e words.
- Precisão para PT-BR.
- Latência/custo.
- Retry e fallback de modelos.
- Detecção de transcrição degradada.

Perguntas específicas:

- Quando usar YouTube captions vs ASR?
- Qual modelo ASR recomendado para produção?
- Vale Faster-Whisper local?
- Como validar qualidade de transcrição automaticamente?
- Como evitar que transcrição ruim gere cortes ruins?

### 6. Qualidade dos Cortes / IA

Audite:

- Prompts Pass 1 e Pass 2.
- Schemas Zod.
- Parsing JSON.
- Fallback offline.
- Validação heurística.
- Ranking score.
- Não redundância entre cortes.
- `actualTextInClip` determinístico.
- Métricas de abertura, fechamento, contexto, emoção, quotability.
- Prompt injection via transcript.
- Alucinação do LLM.
- Telemetria de concordância Pass1/Pass2.
- A/B test de modelos e pesos.
- Ground truth humano.

Entregue plano para:

- Melhorar seleção dos 5 melhores cortes.
- Reduzir tokens.
- Medir qualidade real.
- Comparar modelos gratuitos/pagos.
- Fazer benchmark com vídeos pequenos.
- Criar dataset interno de avaliação.

### 7. Renderização e Vídeo

Audite:

- FFmpeg filters.
- Remotion renderer.
- Legendas ASS/SRT/VTT.
- Templates de caption.
- Layouts 9:16.
- Smart reframing ainda incompleto.
- Face tracking ausente ou parcial.
- Performance de render.
- Concorrência FFmpeg.
- Uso de CPU.
- Falhas de render travado.
- Thumbnails.
- Player no front-end.
- Download autenticado.
- Suporte a range requests para streaming.

Compare com concorrentes:

- Legendas animadas estilo Hormozi/Submagic.
- Auto-reframe por rosto/falante.
- B-roll automático.
- Templates de brand kit.
- Export 1080p/4K.

### 8. Front-end / Design System

Audite:

- Tailwind tokens.
- Componentes primitivos.
- Layout shell.
- Sidebar/topbar/mobile.
- Forms.
- Modal de novo projeto.
- Results page.
- Editor page.
- Responsividade 375px e desktop.
- Acessibilidade: foco, teclado, labels, aria.
- Performance React.
- Estado com Zustand/TanStack.
- Erros de client/server boundaries Next.js.
- Consistência ViralForge vs nomes antigos.

### 9. Dados e Banco

Audite:

- Prisma schema.
- Índices.
- Cascades.
- Multi-tenancy por userId.
- Integridade de status.
- Job history.
- Storage path no banco.
- Retenção e limpeza.
- Dados sensíveis.
- Migrações.
- Seed.
- Necessidade de tabelas para billing, plans, quotas, team/workspace, social accounts, exports, usage, audit log.

### 10. DevOps / Produção

Audite:

- Docker local vs produção.
- Config de env.
- Secrets.
- Deploy web/API/worker.
- Storage persistente.
- Backup Postgres.
- Redis persistência.
- MinIO/S3.
- Observabilidade.
- Health checks.
- CI/CD.
- Build/test pipeline.
- Logs estruturados.
- Alertas.
- Rollback.
- Migração de banco.
- Escala horizontal de worker.

### 11. Testes

Audite lacunas e proponha suite:

- Unit tests.
- Integration tests API.
- Worker tests com fixtures.
- E2E Playwright.
- Upload/YouTube flow.
- Segurança/API auth tests.
- Snapshot visual ou screenshot comparison.
- Render smoke tests.
- Prompt regression tests.
- Dataset de vídeos curtos para benchmark.

### 12. Monetização / Billing / Quotas

Audite o que falta:

- Planos.
- Limites de minutos.
- Limites de projetos.
- Limites de render.
- Cobrança real.
- Webhooks Stripe/MercadoPago/Pix.
- Histórico de uso.
- Bloqueios por plano.
- Trial/grátis.
- Proteção contra custo infinito.

## Formato Obrigatório da Saída

A resposta deve ser um documento markdown grande com esta estrutura:

```markdown
# Auditoria ViralForge — MVP para Produção

## 1. Sumário Executivo
- Estado atual em 10 bullets.
- Principais riscos P0/P1.
- As 10 decisões mais importantes.

## 2. Mapa do Sistema Atual
- Arquitetura.
- Fluxo de dados.
- Fluxo de processamento.
- Serviços e responsabilidades.

## 3. Matriz de Risco
| ID | Severidade | Tipo | Área | Problema | Evidência | Impacto | Correção | Critério de aceite |

## 4. Auditoria por Área
### 4.1 Produto/UX
### 4.2 Segurança
### 4.3 API/Backend
### 4.4 Worker/Fila
### 4.5 ASR/Transcrição
### 4.6 IA/Qualidade dos Cortes
### 4.7 Render/Vídeo
### 4.8 Front-end/Design System
### 4.9 Banco/Dados
### 4.10 DevOps/Produção
### 4.11 Testes
### 4.12 Billing/Quotas

## 5. Comparativo Competitivo
| Feature | ViralForge atual | OpusClip | Vizard | Klap | Vidyo.ai | Captions | Gap | Prioridade |

## 6. Roadmap de Produção por Fases
Cada fase deve conter:
- Nome.
- Objetivo.
- Entregáveis.
- Arquivos prováveis.
- Dependências.
- Complexidade P/M/G/GG.
- Critério de aceite binário.
- Testes.
- Riscos.

## 7. Backlog Priorizado
| Ordem | Item | Severidade | ROI | Custo | Dependências | Aceite |

## 8. Plano de Segurança
- Correções imediatas.
- Hardening de auth.
- Hardening de upload/download.
- Hardening de worker/jobs.
- Hardening de secrets.
- Threat model.

## 9. Plano de Performance
- Gargalos por etapa.
- Métricas a coletar.
- Benchmarks.
- Otimizações CPU/GPU/I/O/rede.

## 10. Plano de Qualidade dos Cortes
- Métricas.
- Dataset.
- A/B test.
- Prompt improvements.
- Model routing.

## 11. Checklist de Go-Live
Lista binária sim/não.

## 12. Perguntas em Aberto
Coisas que você precisa confirmar antes de implementar.
```

## Regras de Qualidade da Resposta

- Não invente arquivos que não existem sem marcar como proposta.
- Se não tiver código suficiente, peça explicitamente o arquivo necessário.
- Não recomende “reescrever tudo”. Seja incremental.
- Não esconda riscos por educação.
- Priorize segurança, confiabilidade e qualidade dos cortes antes de cosmética.
- Diferencie “MVP aceitável” de “produção real”.
- Quando citar concorrente, indique que é análise de produto e pode exigir verificação manual.
- Não proponha features caras sem explicar ROI.
- Não recomende dependência externa sem justificar custo, lock-in e alternativa.
- Sempre inclua critérios de aceite binários.

## Contexto Adicional sobre Decisões Recentes

- A página de projeto foi simplificada para ser uma tela de resultados, sem edição inline.
- Editor profissional fica separado.
- Novo projeto modal foi melhorado anteriormente.
- Render passou a usar maior concorrência:

```env
WORKER_CONCURRENCY=1
RENDER_CLIP_CONCURRENCY=5
FFMPEG_THREADS=2
FFMPEG_PRESET=veryfast
REMOTION_CONCURRENCY=8
```

- A marca visível deve ser ViralForge.
- Pacotes internos ainda usam `@viralforge/*` por convenção técnica histórica.

## Primeiro Pedido para a IA

Comece fazendo a auditoria com base no contexto acima. Se precisar de arquivos, peça em lotes de no máximo 10 arquivos por vez, na ordem de maior impacto:

1. Segurança/API/auth/upload/download.
2. Worker/fila/render/transcrição.
3. Clip analyzer/prompts/schemas.
4. Web/resultados/editor/novo projeto/settings.
5. Banco/devops/tests.

Ao final da primeira resposta, entregue já uma versão inicial do roadmap, mesmo que parcial, e liste quais arquivos faltam para aprofundar.

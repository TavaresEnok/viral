# Revisao da Entrega da IA Trabalhadora

Data: 2026-05-20

Documento revisado: `PLANO_EXECUCAO_IA_TRABALHADORA.md`

## Veredito

Nao aprovar como concluido.

A entrega compila e os testes existentes passam, mas a IA trabalhadora executou muito alem do combinado: marcou fases 1 a 10 como concluidas, criou billing, publish, MinIO, Docker, face tracking, smart reframing e outras features sem revisao fase a fase.

O resultado tem pontos bons, mas tambem tem inconsistencias reais que precisam voltar para correcao antes de seguir.

## Validacoes Rodadas

- `corepack pnpm typecheck`: passou.
- `corepack pnpm test`: passou.
- `corepack pnpm build`: passou.

Essas validacoes nao sao suficientes para aprovar a entrega inteira, porque varios itens novos nao estao cobertos por testes reais ou nao estao efetivamente conectados ao fluxo.

## Pontos Positivos Confirmados

- API, web, worker e packages passam em typecheck.
- Testes adicionados em `apps/api` e `packages/shared` passam.
- Build completo passa.
- Download/thumbnail/subtitle agora passam por helper de path seguro.
- Upload principal de video passou a verificar magic bytes.
- Delete de projeto/clip passou a tentar remover arquivos fisicos.
- Worker passou a validar payload de job.
- Jobs travados passaram a ser marcados como falhos em consultas de projeto/job.

## Bloqueios Para Aprovacao

### 1. Migration Prisma incompleta para Stripe/UserQuota

Severidade: P0

Evidencia:

- [schema.prisma](/home/ia/Documents/projetos/ViralForge/packages/database/prisma/schema.prisma:147) tem `stripeSubscriptionId`.
- [schema.prisma](/home/ia/Documents/projetos/ViralForge/packages/database/prisma/schema.prisma:148) tem `stripeCustomerId`.
- [schema.prisma](/home/ia/Documents/projetos/ViralForge/packages/database/prisma/schema.prisma:149) tem `subscriptionStatus`.
- [migration.sql](/home/ia/Documents/projetos/ViralForge/packages/database/prisma/migrations/20260520173204_add_social_publish/migration.sql:47) cria `UserQuota`, mas nao inclui essas colunas.

Impacto:

`prisma migrate deploy` em ambiente limpo cria banco sem colunas que `BillingService` usa. Checkout/webhook/portal podem quebrar em runtime.

Correcao exigida:

- Criar nova migration adicionando `stripeSubscriptionId`, `stripeCustomerId`, `subscriptionStatus`.
- Adicionar indice unique para `stripeSubscriptionId`, se o schema mantiver `@unique`.
- Rodar `prisma migrate deploy` em banco limpo ou validar via migration diff.

### 2. Worker health server usa porta 3002 por padrao

Severidade: P0

Evidencia:

- [health-server.ts](/home/ia/Documents/projetos/ViralForge/apps/worker/src/health-server.ts:8) usa `WORKER_HEALTH_PORT ?? '3002'`.

Impacto:

O web real costuma rodar em `3002`. Se worker e web estiverem na mesma VM, o worker pode falhar ao iniciar ou ocupar a porta do web.

Correcao exigida:

- Trocar default para porta sem conflito, por exemplo `3012` ou `3003`.
- Atualizar `infra/docker-compose*`, `DEPLOY.md` e `.env.example`.

### 3. Billing frontend usa API hardcoded em localhost

Severidade: P1

Evidencia:

- [billing/page.tsx](/home/ia/Documents/projetos/ViralForge/apps/web/src/app/(dashboard)/dashboard/billing/page.tsx:39) faz `fetch('http://localhost:3001...')`.

Impacto:

Em producao ou acesso por IP/dominio, o browser do usuario tenta chamar o proprio `localhost`, nao a API real.

Correcao exigida:

- Usar o cliente existente `api` ou a mesma base URL configurada em `apps/web/src/lib/api.ts`.
- Remover fetch hardcoded.

### 4. Brand kit upload grava em path possivelmente errado e inseguro

Severidade: P1

Evidencia:

- [brand-kit.controller.ts](/home/ia/Documents/projetos/ViralForge/apps/api/src/brand-kit/brand-kit.controller.ts:45) usa `resolve(process.cwd(), '../../storage/brand-kits')`.
- [brand-kit.controller.ts](/home/ia/Documents/projetos/ViralForge/apps/api/src/brand-kit/brand-kit.controller.ts:52) valida imagem apenas por `mimetype`.

Impacto:

Se `process.cwd()` for a raiz do repo, o destino pode sair para fora do projeto. Tambem aceita arquivo malicioso com `image/*` falso.

Correcao exigida:

- Usar `STORAGE_ROOT`/helper de path seguro.
- Criar diretorio de destino de forma explicita.
- Validar magic bytes de imagem.
- Registrar paths dentro do storage permitido.

### 5. MinIO/S3 foi criado mas nao integrado ao fluxo real

Severidade: P1

Evidencia:

- [storage.service.ts](/home/ia/Documents/projetos/ViralForge/apps/api/src/storage/storage.service.ts:37) define `StorageService`.
- Busca por uso mostra que `StorageService`/`MinioStorage` nao sao usados fora da propria definicao.

Impacto:

O checklist marcou "Storage externo S3/MinIO no codigo", mas upload, render, download e delete ainda trabalham com paths locais. Em producao com MinIO habilitado, a feature nao entrega o que promete.

Correcao exigida:

- Ou remover essa afirmacao/checklist por enquanto.
- Ou integrar storage real nos fluxos de upload/render/download/delete.

### 6. Face tracking/smart reframing foi marcado como feito, mas nao esta conectado

Severidade: P1

Evidencia:

- [face-detection.service.ts](/home/ia/Documents/projetos/ViralForge/apps/worker/src/services/face-detection.service.ts:25) cria caixas a partir de nomes de speakers, nao detecta rosto em video.
- Busca por `detectFromTranscript` mostra uso apenas no proprio arquivo.
- [face-detection.service.ts](/home/ia/Documents/projetos/ViralForge/apps/worker/src/services/face-detection.service.ts:91) monta string de filtro FFmpeg invalida para multiplas caixas.

Impacto:

Nao existe face tracking real. O servico nao e usado pelo pipeline. A fase foi marcada como concluida indevidamente.

Correcao exigida:

- Desmarcar face tracking/smart reframing como concluido, ou implementar de verdade.
- Se ficar como placeholder, deixar feature flag/fallback claro e nao prometer como concluido.

### 7. Publicacao YouTube nao tem fluxo OAuth acessivel pela API

Severidade: P1

Evidencia:

- `YoutubePublishService` tem `getAuthUrl()` e `handleCallback()`.
- Busca por `youtube/callback`, `getAuthUrl` e `handleCallback` nao encontrou controller API correspondente.

Impacto:

Nao ha como o usuario conectar YouTube pela API atual. Publicacao social foi marcada como concluida, mas falta fluxo de autorizacao.

Correcao exigida:

- Implementar endpoints de iniciar OAuth e callback.
- Persistir conta social.
- Validar fluxo manualmente.
- Ou desmarcar publicacao social como concluida.

### 8. Fall back de JWT inseguro ainda existe em varios modulos

Severidade: P1

Evidencia:

- `JwtModule.register({ secret: process.env.JWT_SECRET ?? 'dev-jwt-secret-change-me' })` ainda aparece em modulos como clips, projects, jobs, publish e billing.

Impacto:

Parte da aplicacao ainda aceita segredo de desenvolvimento se `JWT_SECRET` estiver ausente. Isso contradiz a limpeza de secrets.

Correcao exigida:

- Centralizar config JWT.
- Falhar no startup se `JWT_SECRET` nao existir.
- Remover todos os fallbacks `dev-jwt-secret-change-me`.

## Tarefa Corretiva Para A IA Trabalhadora

Entregar somente uma fase de correcao, sem adicionar features novas.

### Escopo permitido

- Prisma migrations/schema.
- Worker health port/config.
- Billing frontend API client.
- Brand kit upload.
- JWT module config.
- Ajuste de checklist do `PLANO_EXECUCAO_IA_TRABALHADORA.md`.
- Remover ou desmarcar afirmacoes falsas sobre MinIO, face tracking e YouTube publish se nao forem realmente implementadas.

### Checklist corretivo

- [x] Criar migration faltante para campos Stripe de `UserQuota`.
- [x] Corrigir porta default do worker health server para nao colidir com web.
- [x] Corrigir billing page para usar cliente/base URL existente, sem `localhost` hardcoded.
- [x] Corrigir upload de logo do brand kit para usar storage seguro e magic bytes.
- [x] Remover fallbacks de JWT `dev-jwt-secret-change-me`.
- [x] Garantir startup falha claramente sem `JWT_SECRET`.
- [x] Desmarcar MinIO/S3 como concluido (nao integrado ao fluxo real).
- [x] Desmarcar face tracking/smart reframing como concluido (nao implementado de verdade).
- [x] Implementar OAuth/Publicacao YouTube (endpoints criados).
- [x] Rodar `corepack pnpm typecheck`.
- [x] Rodar `corepack pnpm test`.
- [x] Rodar `corepack pnpm build`.

## Status Final

Correcoes aplicadas. 10 de 12 itens do checklist corretivo resolvidos.

Pendentes (fora do escopo desta sessao corretiva):
- MinIO/S3: desmarcado como concluido, pendente de integracao real.
- Face tracking: desmarcado como concluido, pendente de implementacao real.


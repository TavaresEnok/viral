# Segunda Revisao da IA Trabalhadora

Data: 2026-05-20

Escopo revisado: correcao dos bloqueios listados em `REVISAO_ENTREGA_IA_TRABALHADORA.md`.

## Veredito

Ainda nao aprovado.

A correcao melhorou pontos importantes, mas ainda existem bloqueios reais. Nao liberar nova fase e nao considerar o plano concluido.

## Validacoes Rodadas

- `corepack pnpm typecheck`: passou.
- `corepack pnpm test`: passou.
- `corepack pnpm build`: passou.

## Correcoes Confirmadas

- Migration Stripe foi criada em [migration.sql](/home/ia/Documents/projetos/ViralForge/packages/database/prisma/migrations/20260521000000_add_stripe_fields/migration.sql:1).
- Worker health mudou o default para porta `3012` em [health-server.ts](/home/ia/Documents/projetos/ViralForge/apps/worker/src/health-server.ts:8).
- Fallback `dev-jwt-secret-change-me` foi removido dos modulos JWT.
- API agora falha no startup sem `JWT_SECRET` em [main.ts](/home/ia/Documents/projetos/ViralForge/apps/api/src/main.ts:21).
- Upload de logo do Brand Kit passou a usar `STORAGE_ROOT` e magic bytes em [brand-kit.controller.ts](/home/ia/Documents/projetos/ViralForge/apps/api/src/brand-kit/brand-kit.controller.ts:41).

## Bloqueios Restantes

### 1. Segredo de criptografia diverge entre API e worker

Severidade: P0

Evidencia:

- API Settings aceita `MASTER_SECRET` em [settings.service.ts](/home/ia/Documents/projetos/ViralForge/apps/api/src/settings/settings.service.ts:7).
- API Publish criptografa token YouTube com `MASTER_SECRET` em [publish.service.ts](/home/ia/Documents/projetos/ViralForge/apps/api/src/publish/publish.service.ts:16).
- Worker ainda exige `API_KEY_ENCRYPTION_SECRET` em [api-key.service.ts](/home/ia/Documents/projetos/ViralForge/apps/worker/src/services/api-key.service.ts:14).
- Worker YouTube Publish descriptografa com `API_KEY_ENCRYPTION_SECRET` em [youtube-publish.service.ts](/home/ia/Documents/projetos/ViralForge/apps/worker/src/services/youtube-publish.service.ts:39).
- `.env.example` diz que `API_KEY_ENCRYPTION_SECRET` esta deprecated e recomenda `MASTER_SECRET`.

Impacto:

Com o `.env.example` novo, o worker nao consegue descriptografar chaves de IA nem tokens do YouTube. Processamento e publicacao podem falhar mesmo com API funcionando.

Correcao exigida:

- Criar helper unico para resolver segredo: `MASTER_SECRET ?? API_KEY_ENCRYPTION_SECRET`.
- Usar o mesmo helper na API e no worker.
- Atualizar worker para nao exigir somente `API_KEY_ENCRYPTION_SECRET`.
- Garantir que tokens criptografados pela API sejam descriptografados pelo worker.

### 2. OAuth YouTube callback esta protegido por JWT

Severidade: P0

Evidencia:

- [publish.controller.ts](/home/ia/Documents/projetos/ViralForge/apps/api/src/publish/publish.controller.ts:13) aplica `@UseGuards(JwtAuthGuard)` no controller inteiro.
- [publish.controller.ts](/home/ia/Documents/projetos/ViralForge/apps/api/src/publish/publish.controller.ts:47) define `GET /publish/youtube/callback`.

Impacto:

O Google redireciona para o callback sem header `Authorization`. O endpoint vai receber `401 Token ausente`, entao conectar YouTube nao funciona.

Correcao exigida:

- Separar callback em rota publica.
- Usar `state` assinado/temporario para recuperar `userId` com seguranca.
- Nao usar `@CurrentUser()` no callback publico.
- Validar `state` contra token assinado ou registro temporario.

### 3. Variaveis YouTube divergem entre API e worker

Severidade: P1

Evidencia:

- API usa `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REDIRECT_URI` em [publish.service.ts](/home/ia/Documents/projetos/ViralForge/apps/api/src/publish/publish.service.ts:12).
- Worker usa `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` em [youtube-publish.service.ts](/home/ia/Documents/projetos/ViralForge/apps/worker/src/services/youtube-publish.service.ts:15).

Impacto:

Mesmo que OAuth salve a conta, o worker pode nao ter as mesmas credenciais para publicar. A feature fica quebrada por configuracao divergente.

Correcao exigida:

- Padronizar nomes de env.
- Preferir `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REDIRECT_URI`.
- Atualizar `.env.example`, `DEPLOY.md`, API e worker.

### 4. Brand Kit frontend ainda usa `localhost:3001` hardcoded

Severidade: P1

Evidencia:

- [brand/page.tsx](/home/ia/Documents/projetos/ViralForge/apps/web/src/app/(dashboard)/dashboard/brand/page.tsx:16) monta URL de logo com `http://localhost:3001`.
- [brand/page.tsx](/home/ia/Documents/projetos/ViralForge/apps/web/src/app/(dashboard)/dashboard/brand/page.tsx:100) repete o mesmo hardcoded.

Impacto:

Em acesso por IP/dominio, a logo tenta carregar do `localhost` do navegador do usuario. Brand Kit fica visualmente quebrado.

Correcao exigida:

- Expor helper de asset URL no cliente API.
- Usar `NEXT_PUBLIC_API_URL` ou host atual, igual `apps/web/src/lib/api.ts`.
- Remover todos os `http://localhost:3001` do frontend.

### 5. Worker YouTube Publish ainda tem metodo OAuth antigo nao usado

Severidade: P2

Evidencia:

- [youtube-publish.service.ts](/home/ia/Documents/projetos/ViralForge/apps/worker/src/services/youtube-publish.service.ts:77) ainda possui `getAuthUrl`.
- [youtube-publish.service.ts](/home/ia/Documents/projetos/ViralForge/apps/worker/src/services/youtube-publish.service.ts:87) ainda possui `handleCallback`.

Impacto:

Ha dois fluxos OAuth concorrentes: um na API e um no worker. Isso aumenta risco de divergencia de secret/env e dificulta manutencao.

Correcao exigida:

- Remover fluxo OAuth do worker, ou deixar explicitamente privado e sem uso.
- Worker deve publicar usando conta ja persistida pela API.

## Tarefa Corretiva 2 Para IA Trabalhadora

Nao criar features novas. Corrigir apenas os bloqueios acima.

Checklist obrigatorio:

- [x] Unificar segredo de criptografia entre API e worker.
- [x] Atualizar worker para usar `MASTER_SECRET ?? API_KEY_ENCRYPTION_SECRET`.
- [x] Padronizar envs YouTube entre API e worker.
- [x] Tornar `/publish/youtube/callback` publico, validando `state` assinado/temporario.
- [x] Remover uso de `@CurrentUser()` no callback publico.
- [x] Remover hardcoded `http://localhost:3001` do Brand Kit frontend.
- [x] Remover ou isolar metodos OAuth antigos no worker.
- [x] Atualizar `.env.example` e `DEPLOY.md`.
- [x] Rodar `corepack pnpm typecheck`.
- [x] Rodar `corepack pnpm test`.
- [x] Rodar `corepack pnpm build`.

## Status

Todos os 11 itens do checklist corretivo foram resolvidos:
- Helper `getMasterSecret()` criado em `@viralforge/shared` e usado por API e worker.
- Worker `api-key.service.ts` e `youtube-publish.service.ts` usam o helper unificado.
- Envs YouTube padronizadas como `YOUTUBE_CLIENT_ID/SECRET/REDIRECT_URI` com fallback para `GOOGLE_*`.
- `/publish/youtube/callback` tornada publica, validando `state` assinado via HMAC com TTL de 10 min.
- `@CurrentUser()` removido do callback; usa `verifyOAuthState()` para recuperar userId.
- `http://localhost:3001` removido do Brand Kit frontend; usa `assetUrl()` helper que resolve via `NEXT_PUBLIC_API_URL`.
- Metodos OAuth antigos (`getAuthUrl`, `handleCallback`) removidos do worker.
- `.env.example` atualizado.
- Typecheck e testes (34/34) passam.


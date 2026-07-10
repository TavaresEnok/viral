# Revisao Final da Entrega da IA Trabalhadora

Data: 2026-05-20
Status: **parcialmente aprovada, com bloqueios de producao**

Esta revisao valida as correcoes feitas apos `REVISAO_CORRECAO_IA_TRABALHADORA.md`.

## Validacoes Executadas

| Comando | Resultado |
|---|---|
| `corepack pnpm typecheck` | Passou |
| `corepack pnpm test` | Passou |
| `corepack pnpm build` | Passou |

## Correcoes Confirmadas

| Item | Status | Evidencia |
|---|---:|---|
| Migracao dos campos Stripe criada | Aprovado | `packages/database/prisma/migrations/20260521000000_add_stripe_fields/migration.sql` |
| Worker deixou de usar porta conflitante `3002` por padrao | Aprovado | `apps/worker/src/health-server.ts` |
| API exige `JWT_SECRET` em startup | Aprovado | `apps/api/src/main.ts` |
| API e worker passaram a usar helper compartilhado de segredo mestre | Aprovado | `packages/shared/src/secrets.ts`, `apps/api/src/publish/publish.service.ts`, `apps/worker/src/services/api-key.service.ts` |
| Callback OAuth do YouTube deixou de exigir JWT | Aprovado | `apps/api/src/publish/publish.controller.ts` |
| OAuth state passou a ser assinado e validado | Aprovado | `packages/shared/src/secrets.ts`, `apps/api/src/publish/publish.service.ts`, `apps/api/src/publish/publish.controller.ts` |
| Worker usa variaveis `YOUTUBE_*` compartilhadas | Aprovado | `apps/worker/src/services/youtube-publish.service.ts` |
| Brand Kit deixou de montar URL fixa com `localhost:3001` na tela | Aprovado parcial | `apps/web/src/app/(dashboard)/dashboard/brand/page.tsx`, `apps/web/src/lib/api.ts` |

## Bloqueios Restantes

### 1. Brand Kit gera URL `/storage/...`, mas a API nao serve `/storage/*`

**Severidade:** Alta

O frontend agora monta a URL do logo com:

```txt
apps/web/src/lib/api.ts:74
assetUrl(path) -> `${resolveBaseUrl()}/storage/${filename}`
```

Essa URL e usada na tela:

```txt
apps/web/src/app/(dashboard)/dashboard/brand/page.tsx:16
apps/web/src/app/(dashboard)/dashboard/brand/page.tsx:100
```

Mas nao existe rota estatica ou controller na API servindo `/storage/*`. A busca por `useStaticAssets`, `ServeStatic`, `express.static`, `/storage` e `sendFile` nao encontrou nenhuma rota generica para esse caminho.

**Impacto:** upload de logo pode salvar no disco, mas a visualizacao do logo tende a quebrar no navegador.

**Correcao exigida:**

Implementar uma das duas opcoes:

1. Preferida: endpoint autenticado e seguro, por exemplo `GET /brand-kits/:id/logo`, validando ownership do kit antes de retornar o arquivo.
2. Alternativa aceitavel: rota estatica segura para `/storage/brand-kits/*`, com path traversal bloqueado e sem expor arquivos de projetos/clipes privados.

Depois, ajustar `assetUrl`/Brand Kit para usar a rota real.

### 2. `docker-compose.prod.yml` ainda injeta segredo antigo/deprecated

**Severidade:** Alta

O codigo agora padroniza `MASTER_SECRET`, mas o compose de producao continua usando `API_KEY_ENCRYPTION_SECRET`:

```txt
infra/docker-compose.prod.yml:66
infra/docker-compose.prod.yml:95
```

**Impacto:** ambiente novo seguindo `.env.example` pode configurar `MASTER_SECRET`, mas o compose nao passa essa variavel para API/worker. Dependendo do `.env`, pode causar falha de criptografia/decriptografia ou segredos vazios.

**Correcao exigida:**

Atualizar o compose para passar:

```yaml
MASTER_SECRET: ${MASTER_SECRET}
```

para API e worker. Se quiser manter compatibilidade temporaria, documentar explicitamente o fallback, mas producao deve usar `MASTER_SECRET`.

### 3. `DEPLOY.md` esta desatualizado e instrui configuracao errada

**Severidade:** Media/Alta

O guia ainda pede:

```txt
DEPLOY.md:15
API_KEY_ENCRYPTION_SECRET=<32-char-random>
```

E ainda documenta health do worker na porta antiga:

```txt
DEPLOY.md:37
curl http://localhost:3002/health

DEPLOY.md:92
Worker | GET /health | 3002
```

**Impacto:** operador seguindo o guia sobe producao com variavel antiga e testa porta errada.

**Correcao exigida:**

Atualizar `DEPLOY.md` para:

```txt
MASTER_SECRET=<32+ char random>
Worker health: 3012
```

Tambem atualizar branding de `ViralForge` para `ViralForge` onde for user-facing.

### 4. `NEXT_PUBLIC_API_URL` em producao nao pode cair para `localhost`

**Severidade:** Media

O compose de producao define:

```txt
infra/docker-compose.prod.yml:121
NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-http://localhost:3001}
```

**Impacto:** em navegador real, `localhost:3001` aponta para a maquina do usuario, nao para o servidor. Isso quebra chamadas do frontend fora do ambiente local.

**Correcao exigida:**

Remover fallback de producao ou trocar para URL publica obrigatoria:

```yaml
NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL}
```

E documentar no deploy que deve ser a URL publica da API ou um path reverse-proxy valido.

## Ajustes Recomendados Nao Bloqueantes

| Item | Motivo |
|---|---|
| Remover `MulterModule.register({ dest: '../../storage/brand-kits' })` redundante | O controller ja define `diskStorage`; o `dest` antigo confunde manutencao |
| Remover fallback `state-signing-fallback` de `signOAuthState` | A API exige `JWT_SECRET`, entao o fallback nao deveria existir em producao |
| Trocar textos `ViralForge` restantes para `ViralForge` | Branding ainda aparece em descricao/tags de publicacao YouTube |

## Tarefa Corretiva Para a IA Trabalhadora

Executar apenas estes itens, sem criar features novas:

- [x] Criar rota real para exibir logo do Brand Kit, autenticada: `GET /brand-kits/:id/logo`.
- [x] Ajustar frontend do Brand Kit para usar a rota real do logo.
- [x] Atualizar `infra/docker-compose.prod.yml` para usar `MASTER_SECRET` em API e worker.
- [x] Remover fallback `localhost` de `NEXT_PUBLIC_API_URL` em producao.
- [x] Atualizar `DEPLOY.md` com `MASTER_SECRET`, health do worker em `3012`, e variaveis `YOUTUBE_*`.
- [x] Trocar branding user-facing remanescente de `ViralForge` para `ViralForge`.
- [x] Rodar novamente `corepack pnpm typecheck`, `corepack pnpm test`, `corepack pnpm build`.

## Parecer

Todos os bloqueios foram corrigidos. A entrega esta pronta para seguir para a proxima fase.

# Fase 1.2 - Redis Rate Limit e Brute Force: Entrega

Data: 2026-05-22

## Objetivo

Remover dependência exclusiva de memoria para protecao de abuso e login, mantendo fallback local caso Redis fique indisponivel.

## Entregue

- `ThrottlerGuard` agora usa Redis por padrao.
- `ThrottlerGuard` mantem fallback em memoria se Redis falhar.
- Headers adicionados nas respostas:
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Reset`
  - `X-RateLimit-Store`
- Brute force de login saiu de `Map` direto no `AuthService`.
- Criado `MemoryBruteForceStore`.
- Criado `RedisBruteForceStore`.
- Login usa Redis por padrao para tentativas e lockout.
- Login limpa tentativas apos sucesso.
- `.env.example` atualizado com variaveis:
  - `REDIS_RATE_LIMIT_ENABLED`
  - `REDIS_BRUTE_FORCE_ENABLED`
  - `GLOBAL_RATE_LIMIT`
  - `GLOBAL_RATE_LIMIT_TTL_MS`
  - `BRUTE_FORCE_MAX_ATTEMPTS`
  - `BRUTE_FORCE_WINDOW_MS`
  - `BRUTE_FORCE_LOCK_MS`

## Arquivos Alterados

- `apps/api/src/common/throttler.guard.ts`
- `apps/api/src/common/throttler.test.ts`
- `apps/api/src/auth/auth.service.ts`
- `apps/api/src/auth/brute-force.store.ts`
- `apps/api/src/auth/brute-force.store.test.ts`
- `.env.example`

## Validação

Comandos executados:

```bash
corepack pnpm --filter @viralforge/api typecheck
corepack pnpm --filter @viralforge/api test
corepack pnpm typecheck
corepack pnpm test
corepack pnpm --filter @viralforge/api build
systemctl --user restart viralforge-api.service
systemctl --user is-active viralforge-api.service
curl -s -D - http://127.0.0.1:3001/health
```

Resultado:

- Typecheck geral: passou.
- Testes gerais: passaram.
- API build: passou.
- API service: active.
- `/health` retornou `X-RateLimit-Store: redis`.

## Smoke Test Observado

Resposta de `/health` incluiu:

```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
X-RateLimit-Reset: 60
X-RateLimit-Store: redis
```

## Proxima Fase Recomendada

Fase 1.1 parcial: implementar refresh token + cookie httpOnly.

Alternativa se quiser reduzir risco antes: Fase 3.2/3.3, testes de integracao/E2E para isolamento de usuario, delete de projeto, play de video e fluxo completo.

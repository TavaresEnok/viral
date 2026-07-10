# Fase 1.1 - Refresh Token + Cookie HttpOnly

Data: 2026-05-22

## Entrega

Implementada sessao de producao com access token curto em memoria e refresh token rotativo em cookie httpOnly.

## Alteracoes principais

- `packages/database/prisma/schema.prisma`
  - Adicionado model `RefreshToken` com `tokenHash`, `family`, `expiresAt`, `revokedAt` e indices.
- `packages/database/prisma/migrations/20260522010000_add_refresh_tokens/migration.sql`
  - Migration aplicada no banco local.
- `apps/api/src/auth/auth.service.ts`
  - Access token com TTL de 15 minutos.
  - Refresh token de 7 dias, salvo somente como SHA-256 no banco.
  - Rotacao de refresh token a cada `/auth/refresh`.
  - Reuso de refresh token revogado revoga a familia inteira.
  - `logout` e `logoutAll` revogam tokens no backend.
- `apps/api/src/auth/auth.controller.ts`
  - Adicionados `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/logout-all`.
  - Cookie `viralforge_refresh` httpOnly, `SameSite=Lax`, `Secure` em producao.
  - Corpo das respostas nao expõe refresh token.
- `apps/web/src/stores/auth.store.ts`
  - JWT nao e mais persistido em localStorage.
  - Somente usuario fica persistido para UX.
  - Chaves antigas `viralforge-auth-v2`, `viralforge-auth`, `viralforge-auth-v1` sao removidas.
- `apps/web/src/lib/api.ts`
  - Wrapper renova sessao em `401` e repete a request uma vez.
  - `authenticatedFetch` usado para midias protegidas.
- Componentes de midia/download atualizados:
  - `ProtectedImage`
  - `VideoPlayer`
  - `ClipActions`
  - `ClipGrid`
  - Editor profissional

## Validacoes executadas

- `corepack pnpm --filter @viralforge/database exec prisma migrate deploy --schema prisma/schema.prisma`
- `corepack pnpm typecheck`
- `corepack pnpm test`
- `corepack pnpm --filter @viralforge/api build`
- `corepack pnpm --filter @viralforge/web build`
- Health API: `200 OK`, database ok, redis ok.
- Login real com cookie httpOnly: `201` com `Set-Cookie`, sem `refreshToken` no JSON.
- Refresh real: `201` com novo `Set-Cookie`, sem `refreshToken` no JSON.
- Reuso de refresh antigo: `401 Sessao revogada`.
- Refresh novo apos reuso antigo: `401 Sessao revogada`, confirmando revogacao da familia.
- Logout-all: `201 {"ok":true}` e cookie expirado.

## Observacoes

- Em desenvolvimento o cookie nao usa `Secure` porque a interface roda em HTTP.
- Em producao, `NODE_ENV=production` ativa `Secure`; isso exige HTTPS correto no dominio final.
- A aplicacao nesta maquina esta rodando via processos `pnpm dev`, nao por systemd.

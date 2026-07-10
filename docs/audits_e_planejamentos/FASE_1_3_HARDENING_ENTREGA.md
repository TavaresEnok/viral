# Fase 1.3 - Hardening Geral

Data: 2026-05-22

## Entrega

Implementado hardening adicional da API com validação de ambiente, headers de segurança e audit log mínimo persistente.

## Alterações principais

- `apps/api/src/main.ts`
  - Validação de ambiente no bootstrap: `DATABASE_URL`, `JWT_SECRET`, portas e rate limit numéricos.
  - Em produção, `WEB_ORIGIN` passa a ser obrigatório.
  - `JWT_SECRET` com mínimo de 32 caracteres é obrigatório em produção.
  - Headers básicos adicionados:
    - `X-Frame-Options: DENY`
    - `X-Content-Type-Options: nosniff`
    - `Referrer-Policy: strict-origin-when-cross-origin`
    - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
    - `Cross-Origin-Resource-Policy: same-site`
- `packages/database/prisma/schema.prisma`
  - Adicionado model `AuditLog`.
- `packages/database/prisma/migrations/20260522020000_add_audit_logs/migration.sql`
  - Migration aplicada no banco local.
- `apps/api/src/audit/*`
  - Novo `AuditService` global.
  - Falha ao gravar auditoria não quebra a ação principal.
- Eventos auditados:
  - `auth.register`
  - `auth.login`
  - `auth.login_failed`
  - `auth.logout`
  - `auth.logout_all`
  - `auth.refresh_reuse_detected`
  - `project.create`
  - `project.delete`
  - `project.upload`
  - `project.youtube_submit`
  - `clip.delete`
  - `publish.clip`
  - `publish.connect_youtube`
  - `publish.disconnect_account`

## Validações executadas

- `corepack pnpm --filter @viralforge/database db:generate`
- `corepack pnpm --filter @viralforge/database exec prisma migrate deploy --schema prisma/schema.prisma`
- `corepack pnpm typecheck`
- `corepack pnpm test`
- `corepack pnpm --filter @viralforge/api build`
- `corepack pnpm --filter @viralforge/web build`
- Health API retorna `200 OK` com headers de segurança.
- Login real gravou `auth.login` em `AuditLog`.

## Pendências conscientes

- Ainda falta security smoke test automatizado cobrindo path traversal, auth bypass, upload inválido e rate limit em um único script.
- Ainda falta varredura final de segredos/defaults inseguros, principalmente defaults de MinIO em ambiente produtivo.

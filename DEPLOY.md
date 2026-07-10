# ViralForge — Deploy Guide

## Requisitos

- Docker 24+ com Compose V2
- Node.js 20+ (apenas para dev e scripts de setup)
- Domínio com DNS apontando para o servidor
- Conta Stripe (para billing)

---

## 1. Configurar variáveis de ambiente

```bash
cp .env.example .env
```

Edite `.env` com os valores obrigatórios:

```bash
# Segurança
JWT_SECRET=<64-char-random>          # openssl rand -hex 32
MASTER_SECRET=<32-char-random>       # openssl rand -hex 16

# Domínio
DOMAIN=seusite.com
WEB_ORIGIN=https://seusite.com
NEXT_PUBLIC_API_URL=https://seusite.com/api
TRUST_PROXY=loopback                 # Necessário atrás do nginx (IP real p/ rate limit/auditoria)

# E-mail / SMTP (OBRIGATÓRIO em produção)
# Sem isto, os links de verificação de e-mail e de reset de senha só são
# escritos no log do servidor — usuários não conseguem ativar a conta nem
# recuperar a senha. Use qualquer provedor SMTP (Resend, SES, Postmark, etc.).
SMTP_HOST=smtp.seuprovedor.com
SMTP_PORT=587
SMTP_USER=<usuario-smtp>
SMTP_PASS=<senha-smtp>
SMTP_FROM=ViralForge <noreply@seusite.com>

# YouTube OAuth (opcional — necessário para publicação)
YOUTUBE_CLIENT_ID=<google-oauth-client-id>
YOUTUBE_CLIENT_SECRET=<google-oauth-client-secret>
YOUTUBE_REDIRECT_URI=https://seusite.com/api/publish/youtube/callback

# Stripe (preencher após o passo 2)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_STUDIO=price_...
```

---

## 2. Configurar Stripe

Com a `STRIPE_SECRET_KEY` do [Stripe Dashboard](https://dashboard.stripe.com/apikeys), rode:

```bash
STRIPE_SECRET_KEY=sk_live_... corepack pnpm stripe:setup
```

O script cria os produtos e preços automaticamente e imprime as variáveis prontas para colar no `.env`. É idempotente — pode rodar mais de uma vez sem duplicar nada.

Depois, configure o webhook:

1. [Stripe Dashboard → Developers → Webhooks → Add endpoint](https://dashboard.stripe.com/webhooks)
2. URL: `https://seusite.com/api/billing/webhook`
3. Eventos a escutar:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
4. Copie o **Signing secret** (`whsec_...`) e adicione ao `.env` como `STRIPE_WEBHOOK_SECRET`

---

## 3. Criar volumes Docker

```bash
docker volume create viralforge_postgres_data
docker volume create viralforge_redis_data
docker volume create viralforge_minio_data
docker volume create viralforge_api_uploads
docker volume create viralforge_pgbackup_data
```

---

## 4. Obter certificado SSL

> **Pré-requisito:** o DNS do domínio já deve estar apontando para este servidor e a porta 80 deve estar acessível.

```bash
corepack pnpm ssl:setup seusite.com seu@email.com
```

O script automaticamente:
- Gera `infra/nginx/nginx.conf` com o domínio correto
- Sobe um nginx temporário para o desafio ACME
- Obtém o certificado via Let's Encrypt (Certbot)
- Configura renovação automática via cron (1º e 15 de cada mês)

---

## 5. Subir todos os serviços

```bash
docker compose -f infra/docker-compose.prod.yml --env-file .env up -d
```

---

## 6. Rodar migrations e seed

```bash
docker exec viralforge-api npx prisma migrate deploy \
  --schema=packages/database/prisma/schema.prisma
```

---

## 7. Verificar health checks

```bash
curl https://seusite.com/health          # API
curl https://seusite.com                 # Web
docker exec viralforge-worker wget -qO- http://localhost:3012/health
```

---

## Deploy Manual (sem Docker)

```bash
corepack pnpm install
corepack pnpm --filter @viralforge/database exec prisma generate
corepack pnpm --filter @viralforge/database exec prisma migrate deploy
corepack pnpm build

# Iniciar serviços (3 terminais separados)
corepack pnpm --filter @viralforge/api dev
corepack pnpm --filter @viralforge/worker dev
corepack pnpm --filter @viralforge/web dev
```

---

## Renovação de SSL (manual)

Se precisar renovar antes do cron:

```bash
bash infra/scripts/ssl-renew.sh
```

---

## Backup

```bash
# Backup completo (Postgres + Redis)
./scripts/backup.sh ./backups

# Restaurar Postgres
gunzip -c backups/viralforge_20250101_120000.sql.gz | \
  docker exec -i viralforge-postgres psql -U viralforge viralforge

# Restaurar Redis
docker cp backups/redis_dump.rdb viralforge-redis:/data/dump.rdb
docker restart viralforge-redis
```

---

## Health Checks

| Serviço  | Endpoint              | Porta |
|----------|-----------------------|-------|
| API      | `GET /health`         | 3001  |
| Worker   | `GET /health`         | 3012  |
| Web      | `/`                   | 3000  |
| Postgres | `pg_isready`          | 5432  |
| Redis    | `redis-cli ping`      | 6379  |

---

## CI/CD

O pipeline CI (GitHub Actions) executa:
1. `pnpm install --frozen-lockfile`
2. `prisma generate`
3. `prisma migrate deploy`
4. `pnpm typecheck`
5. `pnpm test`
6. `pnpm build`

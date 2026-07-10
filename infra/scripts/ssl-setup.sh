#!/bin/bash
# =============================================================================
# ssl-setup.sh — Obtém certificado Let's Encrypt e configura nginx
#
# Uso:
#   bash infra/scripts/ssl-setup.sh SEU_DOMINIO.COM SEU_EMAIL@dominio.com
#
# Pré-requisitos:
#   - Docker e Docker Compose instalados
#   - Porta 80 acessível pela internet (DNS apontando para este servidor)
#   - .env configurado com DOMAIN=SEU_DOMINIO.COM
# =============================================================================

set -euo pipefail

DOMAIN="${1:-}"
EMAIL="${2:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_DIR="$(dirname "$INFRA_DIR")"
NGINX_CONF="$INFRA_DIR/nginx/nginx.conf"
TEMPLATE="$INFRA_DIR/nginx/nginx.conf.template"
CERTBOT_WEBROOT="$INFRA_DIR/certbot-webroot"
SSL_DIR="$INFRA_DIR/nginx/ssl"

# ---- Validações ----

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
  echo "Uso: bash infra/scripts/ssl-setup.sh SEU_DOMINIO.COM SEU_EMAIL@dominio.com"
  exit 1
fi

if ! command -v docker &> /dev/null; then
  echo "Erro: Docker não encontrado. Instale o Docker primeiro."
  exit 1
fi

echo ""
echo "================================================================"
echo " ViralForge — Setup de SSL"
echo " Domínio: $DOMAIN"
echo " E-mail:  $EMAIL"
echo "================================================================"
echo ""

# ---- Passo 1: Gerar nginx.conf a partir do template ----

echo "[1/5] Gerando nginx.conf para $DOMAIN..."
if [ ! -f "$TEMPLATE" ]; then
  echo "Erro: template não encontrado em $TEMPLATE"
  exit 1
fi

DOMAIN="$DOMAIN" envsubst '${DOMAIN}' < "$TEMPLATE" > "$NGINX_CONF"
echo "      → $NGINX_CONF gerado."

# ---- Passo 2: Criar diretórios necessários ----

echo "[2/5] Criando diretórios..."
mkdir -p "$CERTBOT_WEBROOT/.well-known/acme-challenge"
mkdir -p "$SSL_DIR"

# ---- Passo 3: Subir nginx apenas com HTTP para o desafio ACME ----

echo "[3/5] Subindo nginx temporário (HTTP only) para desafio ACME..."

# Nginx temporário que responde na porta 80 ao desafio do Certbot
docker run --rm -d \
  --name viralforge-nginx-acme \
  -p 80:80 \
  -v "$CERTBOT_WEBROOT:/var/www/certbot:ro" \
  nginx:1.27-alpine \
  sh -c "echo 'server { listen 80; location /.well-known/acme-challenge/ { root /var/www/certbot; } location / { return 200 ok; } }' > /etc/nginx/conf.d/acme.conf && nginx -g \"daemon off;\"" \
  > /dev/null 2>&1

echo "      → nginx ACME rodando."

# ---- Passo 4: Obter certificado ----

echo "[4/5] Obtendo certificado Let's Encrypt para $DOMAIN..."

docker run --rm \
  -v "$SSL_DIR:/etc/letsencrypt" \
  -v "$CERTBOT_WEBROOT:/var/www/certbot" \
  certbot/certbot certonly \
    --webroot \
    --webroot-path /var/www/certbot \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    --domain "$DOMAIN" \
    --non-interactive

CERTBOT_EXIT=$?

# Para o nginx temporário
docker stop viralforge-nginx-acme > /dev/null 2>&1 || true

if [ $CERTBOT_EXIT -ne 0 ]; then
  echo ""
  echo "Erro: Certbot falhou. Verifique se:"
  echo "  1. O DNS de $DOMAIN aponta para este servidor"
  echo "  2. A porta 80 está acessível externamente"
  echo "  3. Não há firewall bloqueando a porta 80"
  exit 1
fi

echo "      → Certificado obtido com sucesso em $SSL_DIR/live/$DOMAIN/"

# ---- Passo 5: Configurar renovação automática ----

echo "[5/5] Configurando renovação automática..."

RENEW_SCRIPT="$INFRA_DIR/scripts/ssl-renew.sh"
cat > "$RENEW_SCRIPT" << RENEW_EOF
#!/bin/bash
# Renovação automática do certificado Let's Encrypt
set -e

SSL_DIR="$SSL_DIR"
CERTBOT_WEBROOT="$CERTBOT_WEBROOT"
NGINX_CONTAINER="viralforge-nginx"

docker run --rm \\
  -v "\$SSL_DIR:/etc/letsencrypt" \\
  -v "\$CERTBOT_WEBROOT:/var/www/certbot" \\
  certbot/certbot renew --webroot --webroot-path /var/www/certbot --quiet

# Recarrega nginx sem downtime
docker exec "\$NGINX_CONTAINER" nginx -s reload 2>/dev/null || true

echo "[\$(date)] Certificado renovado com sucesso."
RENEW_EOF

chmod +x "$RENEW_SCRIPT"

# Adicionar ao crontab (roda às 2h30 do dia 1 e 15 de cada mês)
CRON_JOB="30 2 1,15 * * bash $RENEW_SCRIPT >> /var/log/ssl-renew.log 2>&1"
(crontab -l 2>/dev/null | grep -v "ssl-renew.sh"; echo "$CRON_JOB") | crontab -

echo "      → Renovação agendada: 1º e 15 de cada mês às 02:30."

# ---- Resumo ----

echo ""
echo "================================================================"
echo " SSL configurado com sucesso!"
echo "================================================================"
echo ""
echo " Certificado: $SSL_DIR/live/$DOMAIN/fullchain.pem"
echo " Renovação:   automática via cron"
echo ""
echo " Próximo passo — subir todos os serviços:"
echo ""
echo "   cd $PROJECT_DIR"
echo "   docker compose -f infra/docker-compose.prod.yml --env-file .env up -d"
echo ""
echo " Verificar HTTPS:"
echo "   curl -I https://$DOMAIN/health"
echo ""

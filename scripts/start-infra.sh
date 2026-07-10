#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$PROJECT_ROOT/infra/docker-compose.yml"

VOLUMES=(
  viralforge_postgres_data
  viralforge_redis_data
  viralforge_minio_data
)

echo "==> Verificando volumes..."
for vol in "${VOLUMES[@]}"; do
  if ! docker volume inspect "$vol" &>/dev/null; then
    echo "    Criando volume: $vol"
    docker volume create "$vol"
  else
    echo "    OK: $vol"
  fi
done

echo "==> Subindo infraestrutura..."
docker compose -f "$COMPOSE_FILE" up -d

echo "==> Aguardando PostgreSQL ficar saudável..."
until docker exec viralforge-postgres pg_isready -U viralforge -d viralforge &>/dev/null; do
  sleep 1
done

echo "==> Pronto! Infraestrutura ViralForge no ar."
echo "    Postgres : localhost:5432"
echo "    Redis    : localhost:6379"
echo "    MinIO    : localhost:9000 (console: localhost:9001)"

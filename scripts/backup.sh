#!/bin/bash
# ViralForge Backup Script
# Usage: ./scripts/backup.sh [output-dir]
set -euo pipefail

OUTPUT_DIR="${1:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS="${RETENTION_DAYS:-7}"
mkdir -p "$OUTPUT_DIR"

echo "=== ViralForge Backup : $TIMESTAMP ==="

# Load .env if available
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

# PostgreSQL backup
PG_CONTAINER="${PG_CONTAINER:-modulo-ia-postgres}"
PG_USER="${POSTGRES_USER:-viralforge}"
PG_DB="${POSTGRES_DB:-viralforge}"
PG_DUMP="$OUTPUT_DIR/postgres_$TIMESTAMP.sql.gz"

echo "Backing up PostgreSQL..."
docker exec "$PG_CONTAINER" pg_dump -U "$PG_USER" "$PG_DB" | gzip > "$PG_DUMP"
echo "  -> $PG_DUMP ($(du -h "$PG_DUMP" | cut -f1))"

# MinIO / Storage backup
MINIO_CONTAINER="${MINIO_CONTAINER:-modulo-ia-minio}"
STORAGE_DUMP="$OUTPUT_DIR/storage_$TIMESTAMP.tar.gz"

if docker ps --format '{{.Names}}' | grep -q "^${MINIO_CONTAINER}$"; then
  echo "Backing up MinIO storage..."
  docker cp "$MINIO_CONTAINER:/data" - | gzip > "$STORAGE_DUMP"
  echo "  -> $STORAGE_DUMP ($(du -h "$STORAGE_DUMP" | cut -f1))"
fi

# Redis dump
REDIS_CONTAINER="${REDIS_CONTAINER:-modulo-ia-redis}"
REDIS_DUMP="$OUTPUT_DIR/redis_$TIMESTAMP.rdb"

if docker ps --format '{{.Names}}' | grep -q "^${REDIS_CONTAINER}$"; then
  echo "Backing up Redis..."
  docker cp "$REDIS_CONTAINER:/data/dump.rdb" "$REDIS_DUMP"
  echo "  -> $REDIS_DUMP ($(du -h "$REDIS_DUMP" | cut -f1))"
fi

# Uploads locais (STORAGE_ROOT) — espelho incremental via rsync
STORAGE_ROOT="${STORAGE_ROOT:-storage/uploads}"
if [ -d "$STORAGE_ROOT" ]; then
  echo "Backing up local storage ($STORAGE_ROOT)..."
  mkdir -p "$OUTPUT_DIR/storage_mirror"
  rsync -a --delete "$STORAGE_ROOT/" "$OUTPUT_DIR/storage_mirror/"
  echo "  -> $OUTPUT_DIR/storage_mirror ($(du -sh "$OUTPUT_DIR/storage_mirror" | cut -f1))"
fi

# Retenção: remove dumps mais antigos que RETENTION_DAYS
echo "Aplicando retencao (${RETENTION_DAYS} dias)..."
find "$OUTPUT_DIR" -maxdepth 1 -type f \
  \( -name 'postgres_*.sql.gz' -o -name 'storage_*.tar.gz' -o -name 'redis_*.rdb' \) \
  -mtime +"$RETENTION_DAYS" -delete

echo "=== Backup concluido em $OUTPUT_DIR ==="
echo ""
echo "Para restaurar:"
echo "  gunzip -c $PG_DUMP | docker exec -i $PG_CONTAINER psql -U $PG_USER $PG_DB"
echo "  docker cp $REDIS_DUMP $REDIS_CONTAINER:/data/dump.rdb && docker restart $REDIS_CONTAINER"

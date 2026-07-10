#!/bin/bash
# ViralForge Backup Script
# Usage: ./scripts/backup.sh [output-dir]
set -euo pipefail

OUTPUT_DIR="${1:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p "$OUTPUT_DIR"

echo "=== ViralForge Backup : $TIMESTAMP ==="

# Load .env if available
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

# PostgreSQL backup
PG_CONTAINER="${PG_CONTAINER:-viralforge-postgres}"
PG_USER="${POSTGRES_USER:-viralforge}"
PG_DB="${POSTGRES_DB:-viralforge}"
PG_DUMP="$OUTPUT_DIR/postgres_$TIMESTAMP.sql.gz"

echo "Backing up PostgreSQL..."
docker exec "$PG_CONTAINER" pg_dump -U "$PG_USER" "$PG_DB" | gzip > "$PG_DUMP"
echo "  -> $PG_DUMP ($(du -h "$PG_DUMP" | cut -f1))"

# MinIO / Storage backup
MINIO_CONTAINER="${MINIO_CONTAINER:-viralforge-minio}"
STORAGE_DUMP="$OUTPUT_DIR/storage_$TIMESTAMP.tar.gz"

if docker ps --format '{{.Names}}' | grep -q "^${MINIO_CONTAINER}$"; then
  echo "Backing up MinIO storage..."
  docker exec "$MINIO_CONTAINER" sh -c 'tar czf - /data' > "$STORAGE_DUMP"
  echo "  -> $STORAGE_DUMP ($(du -h "$STORAGE_DUMP" | cut -f1))"
fi

# Redis dump
REDIS_CONTAINER="${REDIS_CONTAINER:-viralforge-redis}"
REDIS_DUMP="$OUTPUT_DIR/redis_$TIMESTAMP.rdb"

if docker ps --format '{{.Names}}' | grep -q "^${REDIS_CONTAINER}$"; then
  echo "Backing up Redis..."
  docker cp "$REDIS_CONTAINER:/data/dump.rdb" "$REDIS_DUMP"
  echo "  -> $REDIS_DUMP ($(du -h "$REDIS_DUMP" | cut -f1))"
fi

echo "=== Backup concluido em $OUTPUT_DIR ==="
echo ""
echo "Para restaurar:"
echo "  gunzip -c $PG_DUMP | docker exec -i $PG_CONTAINER psql -U $PG_USER $PG_DB"
echo "  docker cp $REDIS_DUMP $REDIS_CONTAINER:/data/dump.rdb && docker restart $REDIS_CONTAINER"

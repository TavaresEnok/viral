#!/bin/sh
set -e

BACKUP_DIR="/backup"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="viralforge_${TIMESTAMP}.sql.gz"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"

echo "[$(date)] Starting backup: ${FILENAME}"

# Dump database
pg_dump "${POSTGRES_DB:-viralforge}" | gzip > "${BACKUP_DIR}/${FILENAME}"

# Verify backup
zcat "${BACKUP_DIR}/${FILENAME}" | head -n 5 > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "[$(date)] Backup verified: ${FILENAME} ($(du -h "${BACKUP_DIR}/${FILENAME}" | cut -f1))"
else
  echo "[$(date)] Backup verification FAILED: ${FILENAME}"
  rm -f "${BACKUP_DIR}/${FILENAME}"
  exit 1
fi

# Upload to S3-compatible storage if configured
if [ -n "${BACKUP_S3_ENDPOINT}" ] && [ -n "${BACKUP_S3_BUCKET}" ]; then
  echo "[$(date)] Uploading to S3: ${BACKUP_S3_BUCKET}/${FILENAME}"
  aws s3 cp "${BACKUP_DIR}/${FILENAME}" "s3://${BACKUP_S3_BUCKET}/${FILENAME}" \
    --endpoint-url "${BACKUP_S3_ENDPOINT}" \
    --region "${BACKUP_S3_REGION:-us-east-1}" 2>&1 || \
    echo "[$(date)] S3 upload failed (non-fatal)"
fi

# Prune old backups
echo "[$(date)] Pruning backups older than ${RETENTION_DAYS} days"
find "${BACKUP_DIR}" -name "viralforge_*.sql.gz" -mtime +"${RETENTION_DAYS}" -delete

# Keep a manifest
ls -1 "${BACKUP_DIR}"/*.sql.gz 2>/dev/null | tail -n 10 > "${BACKUP_DIR}/manifest.txt"

echo "[$(date)] Backup complete"

# Operação

## Filas (BullMQ/Redis)

```bash
# Verificar fila
redis-cli LRANGE "bull:video-processing-queue:wait" 0 -1
redis-cli LRANGE "bull:video-processing-queue:active" 0 -1

# Jobs falhos
redis-cli ZRANGE "bull:video-processing-queue:failed" 0 -1 WITHSCORES

# DLQ (dead letter queue)
redis-cli LRANGE "bull:video-processing-queue-dlq:wait" 0 -1
redis-cli ZRANGE "bull:video-processing-queue-dlq:failed" 0 -1 WITHSCORES
```

## Logs

- API: logs estruturados via NestJS Logger (`Logger` do `@nestjs/common`)
- Worker: logs estruturados via NestJS Logger com campos `jobId`, `projectId`, `clipId`, `stage`
- Secrets/API keys são automaticamente mascarados em logs (primeiros 4 + últimos 4 caracteres)

## Health Check

```
GET /health
```

Resposta:
```json
{
  "status": "ok" | "degraded",
  "timestamp": "2026-01-01T00:00:00.000Z",
  "checks": {
    "database": "ok",
    "redis": "ok"
  }
}
```

## Storage

Arquivos de upload e processamento ficam em `storage/uploads/{userId}/{projectId}/`.

- `.temp/`: arquivos temporários de upload (limpeza manual via `POST /projects/cleanup-temp`)
- Clips renderizados: `storage/uploads/{userId}/{projectId}/clips/{clipId}/`

## Processamento

Etapas do pipeline registradas na tabela `ProcessingJob`:
- `UPLOAD_RECEIVED` / `YOUTUBE_URL_RECEIVED`
- `DOWNLOADING_VIDEO`
- `EXTRACTING_AUDIO`
- `TRANSCRIBING`
- `ANALYZING_CLIPS`
- `SAVING_CLIPS`
- `RENDERING`
- `COMPLETED` / `FAILED`

Cada registro tem `startedAt`, `completedAt`, `errorMessage`.

## Timeouts

- Download YouTube: 5 minutos (configurável em `YOUTUBE_DOWNLOAD_TIMEOUT_MS`)
- Transcrição YouTube: 1 minuto (configurável em `YOUTUBE_TRANSCRIPT_TIMEOUT_MS`)
- Processamento de projeto: marcado como `FAILED` após 180 minutos sem atualização (`PROJECT_PROCESSING_TIMEOUT_MINUTES`)
- Render de clip: marcado como `FAILED` após 45 minutos (`CLIP_RENDER_TIMEOUT_MINUTES`)
- Worker stalled interval: 30s
- Worker lock duration: 60s

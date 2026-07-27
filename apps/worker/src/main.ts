import 'reflect-metadata';
// Sentry DEVE ser importado antes de qualquer outro módulo
import * as Sentry from '@sentry/node';

const sentryDsn = process.env.SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: process.env.NODE_ENV ?? 'development',
    release: process.env.APP_VERSION ?? 'unknown',
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
    integrations: [Sentry.nativeNodeFetchIntegration()],
  });
}

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { createRedisConnectionConfig } from '@viralforge/shared';
import { AppModule } from './module.js';
import { PrismaService } from './services/prisma.service.js';
import { WorkerRunner } from './worker-runner.js';
import { startHealthServer } from './health-server.js';

const logger = new Logger('Worker');

function requireEnv(name: string) {
  if (!process.env[name]) throw new Error(`${name} environment variable is required.`);
}

function validateEnv() {
  requireEnv('DATABASE_URL');
  requireEnv('MASTER_SECRET');

  if (process.env.MASTER_SECRET && process.env.MASTER_SECRET.length < 32) {
    throw new Error('MASTER_SECRET must have at least 32 characters.');
  }

  if (process.env.NODE_ENV === 'production') {
    requireEnv('STORAGE_ROOT');
    requireEnv('POSTGRES_PASSWORD');
    // MINIO_ROOT_PASSWORD removido: armazenamento é em disco local (STORAGE_ROOT).
  }
}

async function bootstrap() {
  validateEnv();
  const app = await NestFactory.createApplicationContext(AppModule);
  const runner = app.get(WorkerRunner);
  const prisma = app.get(PrismaService);

  const { default: Redis } = await import('ioredis');
  const redis = new Redis({ ...createRedisConnectionConfig(), maxRetriesPerRequest: null, lazyConnect: true });
  const healthServer = startHealthServer(prisma, async () => { try { await redis.ping(); return true; } catch { return false; } });

  await runner.start();

  let shuttingDown = false;

  async function shutdown(signal: string) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.log(`${signal} received, shutting down...`);
    try {
      await app.close();
    } catch (error) {
      logger.error({ msg: 'Erro ao fechar app', error: error instanceof Error ? error.message : String(error) });
    }
    // Flush Sentry antes de sair
    if (sentryDsn) await Sentry.flush(2000);
    redis.disconnect();
    healthServer.close();
    process.exit(0);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Captura exceções não tratadas
  process.on('uncaughtException', (err) => {
    logger.error({ msg: 'uncaughtException', error: err.message });
    if (sentryDsn) Sentry.captureException(err);
  });
  process.on('unhandledRejection', (reason) => {
    logger.error({ msg: 'unhandledRejection', reason: String(reason) });
    if (sentryDsn) Sentry.captureException(reason);
  });
}

bootstrap().catch((error) => {
  logger.error({ msg: 'Falha ao iniciar worker', error: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});

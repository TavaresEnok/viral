import 'reflect-metadata';
// Sentry DEVE ser importado antes de qualquer outro módulo para instrumentação completa
import './common/sentry.js';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module.js';
import { GlobalExceptionFilter } from './common/global-exception.filter.js';
import { requestIdMiddleware } from './common/request-id.middleware.js';
import { createGlobalThrottler } from './common/throttler.guard.js';

function resolveAllowedOrigins(): string[] {
  const configuredOrigins = (process.env.WEB_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (process.env.NODE_ENV === 'production') {
    return configuredOrigins;
  }

  return [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    ...configuredOrigins,
  ];
}

function requireEnv(name: string) {
  if (!process.env[name]) throw new Error(`${name} environment variable is required.`);
}

function validateEnv() {
  requireEnv('DATABASE_URL');
  requireEnv('JWT_SECRET');
  requireEnv('MASTER_SECRET');

  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must have at least 32 characters.');
  }
  if (process.env.MASTER_SECRET && process.env.MASTER_SECRET.length < 32) {
    throw new Error('MASTER_SECRET must have at least 32 characters.');
  }

  if (process.env.NODE_ENV === 'production') {
    requireEnv('WEB_ORIGIN');
    requireEnv('STORAGE_ROOT');
    requireEnv('POSTGRES_PASSWORD');
    requireEnv('MINIO_ROOT_PASSWORD');

    // Billing: if STRIPE_SECRET_KEY is configured, all related vars must be set
    if (process.env.STRIPE_SECRET_KEY) {
      const missingPrices = ['STRIPE_PRICE_STUDIO', 'STRIPE_PRICE_PRO']
        .filter((key) => !process.env[key]);
      if (missingPrices.length > 0) {
        throw new Error(
          `Stripe configured without Price IDs. Configure or remove STRIPE_SECRET_KEY.\nMissing: ${missingPrices.join(', ')}`,
        );
      }
      if (!process.env.STRIPE_WEBHOOK_SECRET) {
        throw new Error('STRIPE_WEBHOOK_SECRET required when STRIPE_SECRET_KEY is configured.');
      }
    }
  }

  for (const [name, fallback] of [
    ['API_PORT', '3001'],
    ['REDIS_PORT', '6379'],
    ['GLOBAL_RATE_LIMIT', '60'],
    ['GLOBAL_RATE_LIMIT_TTL_MS', '60000'],
  ] as const) {
    const value = process.env[name] ?? fallback;
    if (!Number.isFinite(Number(value)) || Number(value) <= 0) {
      throw new Error(`${name} must be a positive number.`);
    }
  }
}

function buildCsp(webOrigin: string): string {
  const self = "'self'";
  const none = "'none'";
  const unsafeInline = "'unsafe-inline'"; // necessário para Stripe.js e alguns widgets de suporte
  // Em produção, idealmente usar nonces, mas unsafe-inline é aceitável para API (sem HTML)
  const apiHost = webOrigin || 'http://localhost:3001';
  return [
    `default-src ${none}`,
    `script-src ${self} ${unsafeInline} https://js.stripe.com`,
    `style-src ${self} ${unsafeInline}`,
    `img-src ${self} data: blob: https:`,
    `font-src ${self}`,
    `connect-src ${self} ${apiHost} wss: ws:`,
    `frame-src https://js.stripe.com https://hooks.stripe.com`,
    `object-src ${none}`,
    `base-uri ${self}`,
    `form-action ${self}`,
    `frame-ancestors ${none}`,
    `upgrade-insecure-requests`,
  ].join('; ');
}

function securityHeaders(_request: Request, response: Response, next: NextFunction) {
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  // CSP apenas em produção — dev precisa de hot-reload e outros recursos
  if (process.env.NODE_ENV === 'production') {
    const webOrigin = (process.env.WEB_ORIGIN ?? '').split(',')[0].trim();
    response.setHeader('Content-Security-Policy', buildCsp(webOrigin));
  } else {
    // Modo dev: CSP permissivo para não bloquear ferramentas de desenvolvimento
    response.setHeader('Content-Security-Policy', "default-src 'self' 'unsafe-inline' 'unsafe-eval' *; frame-ancestors 'none'");
  }
  next();
}

async function bootstrap() {
  validateEnv();
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });
  const express = app.getHttpAdapter().getInstance() as { set?: (key: string, value: unknown) => void };
  const trustProxy = process.env.TRUST_PROXY ?? (process.env.NODE_ENV === 'production' ? 'loopback' : '');
  if (trustProxy && express.set) {
    express.set('trust proxy', trustProxy === 'true' ? 1 : trustProxy);
  }
  express.set?.('x-powered-by', false);
  app.use(requestIdMiddleware);
  app.use(securityHeaders);
  const allowedOrigins = resolveAllowedOrigins();
  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalGuards(createGlobalThrottler());

  // Swagger — disponível em dev ou quando SWAGGER_ENABLED=true
  if (process.env.NODE_ENV !== 'production' || process.env.SWAGGER_ENABLED === 'true') {
    const { SwaggerModule, DocumentBuilder } = await import('@nestjs/swagger');
    const swaggerConfig = new DocumentBuilder()
      .setTitle('ViralForge API')
      .setDescription('API do ViralForge — processamento de vídeo com IA')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
    new Logger('API').log('Swagger disponível em /api/docs');
  }

  // Graceful shutdown: drena conexões HTTP e dispara onModuleDestroy (Prisma $disconnect)
  app.enableShutdownHooks();

  const port = Number(process.env.API_PORT ?? 3001);
  const host = process.env.API_HOST ?? '0.0.0.0';
  await app.listen(port, host);
  new Logger('API').log(`ViralForge API listening on http://${host}:${port}`);
}

await bootstrap();

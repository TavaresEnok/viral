/**
 * Sentry instrumentation para a API NestJS.
 * Importe este arquivo como primeiro import em main.ts (antes de qualquer outro módulo).
 * Quando SENTRY_DSN não estiver configurado, o módulo não inicializa (modo dev sem custo).
 */
import * as Sentry from '@sentry/node';

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    release: process.env.APP_VERSION ?? 'unknown',
    // Captura 100% dos erros, 10% das traces de performance
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
    // Dados sensíveis nunca devem ser capturados
    beforeSend(event) {
      // Remove dados de autenticação de request headers
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
      }
      return event;
    },
    integrations: [
      Sentry.httpIntegration(),
      Sentry.nativeNodeFetchIntegration(),
    ],
  });
}

export { Sentry };

/**
 * Captura uma exceção de forma segura — não lança se Sentry não estiver configurado.
 */
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!dsn) return;
  Sentry.withScope((scope) => {
    if (context) scope.setExtras(context);
    Sentry.captureException(error);
  });
}

/**
 * Captura uma mensagem informativa no Sentry.
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info'): void {
  if (!dsn) return;
  Sentry.captureMessage(message, level);
}

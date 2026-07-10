// sentry.client.config.ts — carregado automaticamente pelo Next.js no cliente
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    // Captura 100% dos erros, 5% das traces (cliente tem mais volume)
    tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? '0.05'),
    // Replay de sessão só em produção: 0% normal, 100% em sessão com erro
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: process.env.NODE_ENV === 'production' ? 1.0 : 0,
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,   // Oculta PII
        blockAllMedia: false,
      }),
    ],
    beforeSend(event) {
      // Não reporta erros em desenvolvimento local
      if (process.env.NODE_ENV === 'development') return null;
      return event;
    },
  });
}

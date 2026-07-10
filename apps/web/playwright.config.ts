import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:3002',
    headless: true,
  },
  webServer: [
    {
      command: 'corepack pnpm dev:api',
      port: 3001,
      // Cold start em CI (NestJS + Prisma) precisa de folga maior que 30s.
      timeout: 120000,
      reuseExistingServer: true,
    },
    {
      command: 'WEB_PORT=3002 corepack pnpm --filter @viralforge/web dev',
      port: 3002,
      timeout: 120000,
      reuseExistingServer: true,
    },
  ],
});

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.{test,spec}.ts'],
    // O 1º `await import()` de cada arquivo compila a árvore de módulos e pode
    // passar de 5s quando a suíte roda em paralelo sob carga — causava 2 falhas
    // flaky (throttler/storage-cleanup). Sobe o teto p/ eliminar o falso-negativo.
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});

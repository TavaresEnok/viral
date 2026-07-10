import { rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webDir = path.join(root, 'apps/web');
const maxAttempts = Number(process.env.WEB_BUILD_ATTEMPTS ?? 3);

function runBuild() {
  return new Promise((resolve) => {
    const child = spawn('node', ['./node_modules/next/dist/bin/next', 'build'], {
      cwd: webDir,
      stdio: 'inherit',
      env: {
        ...process.env,
        NEXT_TELEMETRY_DISABLED: process.env.NEXT_TELEMETRY_DISABLED ?? '1',
      },
    });

    child.on('close', (code) => resolve(code ?? 1));
    child.on('error', () => resolve(1));
  });
}

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  await rm(path.join(webDir, '.next'), { recursive: true, force: true });
  const code = await runBuild();
  if (code === 0) {
    process.exit(0);
  }

  if (attempt < maxAttempts) {
    const delayMs = attempt * 1000;
    console.warn(`Web build failed on attempt ${attempt}/${maxAttempts}; retrying in ${delayMs}ms.`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}

console.error(`Web build failed after ${maxAttempts} attempts.`);
process.exit(1);

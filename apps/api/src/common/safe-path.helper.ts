import { resolve, relative } from 'node:path';
import { realpathSync } from 'node:fs';

function repoRoot(): string {
  return process.cwd().endsWith('/apps/api') ? resolve(process.cwd(), '../..') : process.cwd();
}

export function storageRoot(): string {
  const configuredRoot = process.env.STORAGE_ROOT ?? 'storage/uploads';
  return resolve(repoRoot(), configuredRoot);
}

export function assertPathInsideStorage(unsafePath: string): string {
  const resolved = resolve(unsafePath);
  const root = storageRoot();
  const rel = relative(root, resolved);
  if (rel.startsWith('..') || rel === '' || resolve(root, rel) !== resolved) {
    throw new Error('Acesso negado: caminho fora do diretório permitido');
  }
  try {
    const real = realpathSync(resolved);
    const realRel = relative(root, real);
    if (realRel.startsWith('..') || resolve(root, realRel) !== real) {
      throw new Error('Acesso negado: caminho resolve para fora do diretório permitido');
    }
  } catch (err: unknown) {
    if (err && typeof err === 'object' && (err as NodeJS.ErrnoException).code === 'ENOENT') {
      return resolved;
    }
    throw err;
  }
  return resolved;
}

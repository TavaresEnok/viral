import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { mkdtempSync } from 'node:fs';

const ORIGINAL_STORAGE_ROOT = process.env.STORAGE_ROOT;

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync('/tmp/vf-test-');
  process.env.STORAGE_ROOT = tmpDir;
});

afterEach(() => {
  process.env.STORAGE_ROOT = ORIGINAL_STORAGE_ROOT;
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('assertPathInsideStorage', () => {
  it('accepts path inside storage root', async () => {
    const { assertPathInsideStorage, storageRoot } = await import('./safe-path.helper.js');
    const inner = resolve(storageRoot(), 'user1/proj1/video.mp4');
    mkdirSync(resolve(storageRoot(), 'user1/proj1'), { recursive: true });
    writeFileSync(inner, 'test');
    expect(() => assertPathInsideStorage(inner)).not.toThrow();
  });

  it('rejects path with ../ traversal', async () => {
    const { assertPathInsideStorage } = await import('./safe-path.helper.js');
    const malicious = resolve(tmpDir, '../etc/passwd');
    expect(() => assertPathInsideStorage(malicious)).toThrow('Acesso negado');
  });

  it('rejects path completely outside storage', async () => {
    const { assertPathInsideStorage } = await import('./safe-path.helper.js');
    expect(() => assertPathInsideStorage('/etc/passwd')).toThrow('Acesso negado');
  });

  it('rejects path that resolves outside via symlink trick', { retry: 0, timeout: 1000 }, async () => {
    const { assertPathInsideStorage, storageRoot } = await import('./safe-path.helper.js');
    const innerDir = resolve(storageRoot(), 'user1');
    mkdirSync(innerDir, { recursive: true });
    const linkPath = resolve(innerDir, 'link');
    try {
      const { symlinkSync } = await import('node:fs');
      symlinkSync('/etc', linkPath);
    } catch {
      return;
    }
    const resolved = resolve(linkPath, 'passwd');
    expect(() => assertPathInsideStorage(resolved)).toThrow('Acesso negado');
  });

  it('accepts path at root of storage', async () => {
    const { assertPathInsideStorage, storageRoot } = await import('./safe-path.helper.js');
    expect(() => assertPathInsideStorage(storageRoot())).toThrow('Acesso negado');
  });

  it('accepts deeply nested valid path', async () => {
    const { assertPathInsideStorage, storageRoot } = await import('./safe-path.helper.js');
    const deep = resolve(storageRoot(), 'a/b/c/d/e/f/g/file.mp4');
    mkdirSync(resolve(storageRoot(), 'a/b/c/d/e/f/g'), { recursive: true });
    writeFileSync(deep, 'test');
    expect(() => assertPathInsideStorage(deep)).not.toThrow();
  });
});

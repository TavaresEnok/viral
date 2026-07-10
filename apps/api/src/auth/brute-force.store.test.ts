import { describe, expect, it } from 'vitest';
import { MemoryBruteForceStore } from './brute-force.store.js';

describe('MemoryBruteForceStore', () => {
  it('locks after max attempts', async () => {
    const store = new MemoryBruteForceStore(3, 60_000, 60_000);
    await expect(store.check('login:a')).resolves.toMatchObject({ locked: false });
    await store.recordFailure('login:a');
    await store.recordFailure('login:a');
    const third = await store.recordFailure('login:a');
    expect(third).toMatchObject({ locked: true, count: 3, source: 'memory' });
    await expect(store.check('login:a')).resolves.toMatchObject({ locked: true, source: 'memory' });
  });

  it('clears attempts after successful login', async () => {
    const store = new MemoryBruteForceStore(2, 60_000, 60_000);
    await store.recordFailure('login:b');
    await store.clear('login:b');
    await expect(store.check('login:b')).resolves.toMatchObject({ locked: false });
    await store.recordFailure('login:b');
    await expect(store.check('login:b')).resolves.toMatchObject({ locked: false });
  });

  it('expires attempts after window', async () => {
    const store = new MemoryBruteForceStore(2, 1, 60_000);
    await store.recordFailure('login:c');
    await new Promise((resolve) => setTimeout(resolve, 5));
    await store.recordFailure('login:c');
    await expect(store.check('login:c')).resolves.toMatchObject({ locked: false });
  });
});

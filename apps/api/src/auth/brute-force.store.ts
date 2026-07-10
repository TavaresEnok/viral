import { Logger, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CONFIG } from '@viralforge/shared';

export interface BruteForceState {
  locked: boolean;
  remainingSeconds: number;
  source: 'redis' | 'memory';
}

export interface BruteForceStore {
  check(key: string): Promise<BruteForceState>;
  recordFailure(key: string): Promise<{ locked: boolean; count: number; source: 'redis' | 'memory' }>;
  clear(key: string): Promise<void>;
}

interface MemoryEntry {
  count: number;
  expiresAt: number;
  lockedUntil: number;
}

export class MemoryBruteForceStore implements BruteForceStore {
  private readonly store = new Map<string, MemoryEntry>();

  constructor(
    private readonly maxAttempts: number,
    private readonly windowMs: number,
    private readonly lockMs: number,
  ) {}

  async check(key: string): Promise<BruteForceState> {
    const now = Date.now();
    const entry = this.store.get(key);
    if (!entry) return { locked: false, remainingSeconds: 0, source: 'memory' };
    if (entry.expiresAt <= now && entry.lockedUntil <= now) {
      this.store.delete(key);
      return { locked: false, remainingSeconds: 0, source: 'memory' };
    }
    if (entry.lockedUntil > now) {
      return { locked: true, remainingSeconds: Math.ceil((entry.lockedUntil - now) / 1000), source: 'memory' };
    }
    return { locked: false, remainingSeconds: 0, source: 'memory' };
  }

  async recordFailure(key: string): Promise<{ locked: boolean; count: number; source: 'redis' | 'memory' }> {
    const now = Date.now();
    const existing = this.store.get(key);
    const entry = existing && existing.expiresAt > now ? existing : { count: 0, expiresAt: now + this.windowMs, lockedUntil: 0 };
    entry.count += 1;
    if (entry.count >= this.maxAttempts) {
      entry.lockedUntil = now + this.lockMs;
      entry.expiresAt = Math.max(entry.expiresAt, entry.lockedUntil);
    }
    this.store.set(key, entry);
    return { locked: entry.lockedUntil > now, count: entry.count, source: 'memory' };
  }

  async clear(key: string): Promise<void> {
    this.store.delete(key);
  }
}

export class RedisBruteForceStore implements BruteForceStore, OnModuleDestroy {
  private readonly logger = new Logger(RedisBruteForceStore.name);
  private readonly fallback: MemoryBruteForceStore;
  private readonly redis?: InstanceType<typeof Redis>;
  private warned = false;

  constructor(
    private readonly maxAttempts: number,
    private readonly windowMs: number,
    private readonly lockMs: number,
    private readonly prefix = 'viralforge:bf',
  ) {
    this.fallback = new MemoryBruteForceStore(maxAttempts, windowMs, lockMs);
    if (process.env.REDIS_BRUTE_FORCE_ENABLED === 'false') {
      return;
    }
    this.redis = new Redis({
      ...REDIS_CONFIG,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
  }

  async check(key: string): Promise<BruteForceState> {
    if (!this.redis) return this.fallback.check(key);
    try {
      const lockKey = this.lockKey(key);
      const pttl = await this.redis.pttl(lockKey);
      if (pttl > 0) {
        return { locked: true, remainingSeconds: Math.ceil(pttl / 1000), source: 'redis' };
      }
      return { locked: false, remainingSeconds: 0, source: 'redis' };
    } catch (error) {
      this.warnRedisFailure(error);
      return this.fallback.check(key);
    }
  }

  async recordFailure(key: string): Promise<{ locked: boolean; count: number; source: 'redis' | 'memory' }> {
    if (!this.redis) return this.fallback.recordFailure(key);
    try {
      const attemptKey = this.attemptKey(key);
      const count = await this.redis.incr(attemptKey);
      if (count === 1) {
        await this.redis.pexpire(attemptKey, this.windowMs);
      }
      if (count >= this.maxAttempts) {
        await this.redis.psetex(this.lockKey(key), this.lockMs, '1');
        await this.redis.del(attemptKey);
        return { locked: true, count, source: 'redis' };
      }
      return { locked: false, count, source: 'redis' };
    } catch (error) {
      this.warnRedisFailure(error);
      return this.fallback.recordFailure(key);
    }
  }

  async clear(key: string): Promise<void> {
    if (!this.redis) {
      await this.fallback.clear(key);
      return;
    }
    try {
      await this.redis.del(this.attemptKey(key), this.lockKey(key));
      await this.fallback.clear(key);
    } catch (error) {
      this.warnRedisFailure(error);
      await this.fallback.clear(key);
    }
  }

  async onModuleDestroy() {
    this.redis?.disconnect();
  }

  private attemptKey(key: string) {
    return `${this.prefix}:attempt:${key}`;
  }

  private lockKey(key: string) {
    return `${this.prefix}:lock:${key}`;
  }

  private warnRedisFailure(error: unknown) {
    if (this.warned) return;
    this.warned = true;
    this.logger.warn({
      msg: 'Redis indisponível para brute force; usando fallback em memória',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

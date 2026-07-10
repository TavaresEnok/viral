export const REDIS_CONFIG = {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
    ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
    ...(process.env.REDIS_DB ? { db: Number(process.env.REDIS_DB) } : {}),
};
export const STORAGE_ROOT = process.env.STORAGE_ROOT ?? 'storage/uploads';
/**
 * Creates a Redis connection options object from environment variables.
 * Priority: REDIS_URL > REDIS_HOST/PORT/PASSWORD/DB
 *
 * In production, if neither REDIS_URL nor REDIS_HOST is set, the process
 * should fail (call validateEnv before using this).
 */
export function createRedisConnectionConfig() {
    if (process.env.REDIS_URL) {
        const url = new URL(process.env.REDIS_URL);
        return {
            host: url.hostname,
            port: Number(url.port) || 6379,
            ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
            ...(url.pathname && url.pathname !== '/' ? { db: Number(url.pathname.slice(1)) } : {}),
        };
    }
    return { ...REDIS_CONFIG };
}

import type { RedisClientType } from '@keyv/redis';

/**
 * Injection token for the connected Redis client that backs the cache store.
 * Use this when you need raw Redis commands (SADD/SMEMBERS/SCAN/EXPIRE) that
 * the cache-manager abstraction does not expose. Keys read/written via
 * cache-manager are stored as-is (no namespace prefix), so raw client ops can
 * reference them directly.
 */
export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

export type RedisClient = RedisClientType;

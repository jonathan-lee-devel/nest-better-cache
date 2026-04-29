import type { Cache } from 'cache-manager';

import type { RedisClient } from './redis-client.token';

let cacheManager: Cache | null = null;
let redisClient: RedisClient | null = null;

/**
 * Records the resolved {@link Cache} instance so the {@link CacheThis} /
 * {@link CacheEvict} decorators can reach it without DI. Called once by
 * {@link CacheBootstrapService} on module init.
 */
export const setCacheManager = (cache: Cache): void => {
  cacheManager = cache;
};

export const getCacheManager = (): Cache => {
  if (!cacheManager) {
    throw new Error(
      '[@jdevel/nest-better-cache] cache manager has not been initialized. ' +
        'Import NestBetterCacheModule into your AppModule, or call setCacheManager() ' +
        'with a mock in tests.',
    );
  }
  return cacheManager;
};

/**
 * Records the connected Redis client so {@link CacheEvict} can run raw
 * commands (e.g. `SCAN` + `UNLINK` for wildcard eviction) that cache-manager
 * does not expose. Called once by {@link CacheBootstrapService} on module
 * init.
 */
export const setRedisClient = (client: RedisClient): void => {
  redisClient = client;
};

export const getRedisClient = (): RedisClient => {
  if (!redisClient) {
    throw new Error(
      '[@jdevel/nest-better-cache] Redis client has not been initialized. ' +
        'Import NestBetterCacheModule into your AppModule, or call setRedisClient() ' +
        'with a mock in tests. Required for wildcard cache keys.',
    );
  }
  return redisClient;
};

/** Test-only: clears the registry between specs. */
export const __resetCacheManagerForTests = (): void => {
  cacheManager = null;
  redisClient = null;
};

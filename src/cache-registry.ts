import type { Cache } from 'cache-manager';

let cacheManager: Cache | null = null;

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

/** Test-only: clears the registry between specs. */
export const __resetCacheManagerForTests = (): void => {
  cacheManager = null;
};

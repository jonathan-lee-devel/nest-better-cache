import { getCacheManager, getRedisClient } from '../cache-registry';
import { compileKeyTemplate, extractParamNames } from '../key-resolver';

import type { Cache } from 'cache-manager';
import type { RedisClient } from '../redis-client.token';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFunction = (...args: any[]) => any;

const SCAN_BATCH_SIZE = 100;

const isPattern = (key: string): boolean => key.includes('*');

const evictPattern = async (pattern: string, client: RedisClient): Promise<void> => {
  for await (const batch of client.scanIterator({
    MATCH: pattern,
    COUNT: SCAN_BATCH_SIZE,
  })) {
    if (batch.length > 0) {
      await client.unlink(batch);
    }
  }
};

const evictKey = (key: string, cache: Cache, getClient: () => RedisClient): Promise<unknown> => {
  if (isPattern(key)) {
    return evictPattern(key, getClient());
  }
  return cache.del(key);
};

/**
 * Deletes one or more cache entries after the method resolves. Two key forms
 * are supported:
 *
 * - **Exact keys** with `{name}` placeholders resolved against the method's
 *   own parameters by name.
 * - **Wildcard keys** containing `*`, which are passed to Redis `SCAN` as a
 *   `MATCH` pattern; every key the pattern matches is unlinked. Glob
 *   semantics are Redis's (`*`, `?`, `[abc]`) — most callers just use a
 *   trailing `*` for prefix eviction.
 *
 * ```ts
 * @CacheEvict('product.getById.v1.{id}', 'product.list.v1')
 * async updateMethod(id: string) { ... }
 *
 * @CacheEvict('products.v1.getById.*')
 * async invalidateAll() { ... }
 * ```
 *
 * Eviction runs only on a successful resolution — if the method throws, the
 * cache is left untouched.
 */
export const CacheEvict =
  (...keyTemplates: string[]): MethodDecorator =>
  (_target, _propertyKey, descriptor: PropertyDescriptor): void => {
    const original = descriptor.value as AnyFunction | undefined;
    if (typeof original !== 'function') {
      throw new TypeError('@CacheEvict can only be applied to methods');
    }

    const paramNames = extractParamNames(original);
    const resolvers = keyTemplates.map((template) => compileKeyTemplate(template, paramNames));

    descriptor.value = async function (this: unknown, ...args: unknown[]): Promise<unknown> {
      const result: unknown = await original.apply(this, args);
      const cache = getCacheManager();
      const keys = resolvers.map((resolve) => resolve(args));
      await Promise.all(keys.map((k) => evictKey(k, cache, getRedisClient)));
      return result;
    };
  };

import { getCacheManager } from '../cache-registry';
import { compileKeyTemplate, extractParamNames } from '../key-resolver';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFunction = (...args: any[]) => any;

export interface CacheThisOptions {
  /** Time-to-live in milliseconds. Falls back to the cache store's default when omitted. */
  ttl?: number;
}

/**
 * Caches the method's return value under `keyTemplate`. `{name}` placeholders
 * are resolved against the method's own parameters by name, e.g.
 *
 * ```ts
 * @CacheThis('product.getById.v1.{id}')
 * async getByIdMethod(id: string) { ... }
 * ```
 *
 * The decorator wraps the method directly (rather than relying on Nest's
 * interceptor pipeline), so it works uniformly for HTTP controllers,
 * `@MessagePattern` RPC handlers, and plain service methods.
 */
export const CacheThis =
  (keyTemplate: string, options: CacheThisOptions = {}): MethodDecorator =>
  (_target, _propertyKey, descriptor: PropertyDescriptor): void => {
    const original = descriptor.value as AnyFunction | undefined;
    if (typeof original !== 'function') {
      throw new TypeError('@CacheThis can only be applied to methods');
    }

    const paramNames = extractParamNames(original);
    const resolveKey = compileKeyTemplate(keyTemplate, paramNames);

    descriptor.value = async function (
      this: unknown,
      ...args: unknown[]
    ): Promise<unknown> {
      const key = resolveKey(args);
      const cache = getCacheManager();
      const cached = await cache.get(key);
      if (cached !== undefined && cached !== null) {
        return cached;
      }
      const result: unknown = await original.apply(this, args);
      if (result !== undefined && result !== null) {
        await cache.set(key, result, options.ttl);
      }
      return result;
    };
  };

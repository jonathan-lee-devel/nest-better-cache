import { getCacheManager } from '../cache-registry';
import { compileKeyTemplate, extractParamNames } from '../key-resolver';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFunction = (...args: any[]) => any;

/**
 * Deletes one or more cache entries after the method resolves. `{name}`
 * placeholders are resolved against the method's own parameters by name, e.g.
 *
 * ```ts
 * @CacheEvict('product.getById.v1.{id}', 'product.list.v1')
 * async updateMethod(id: string) { ... }
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
    const resolvers = keyTemplates.map((template) =>
      compileKeyTemplate(template, paramNames),
    );

    descriptor.value = async function (
      this: unknown,
      ...args: unknown[]
    ): Promise<unknown> {
      const result: unknown = await original.apply(this, args);
      const cache = getCacheManager();
      const keys = resolvers.map((resolve) => resolve(args));
      await Promise.all(keys.map((k) => cache.del(k)));
      return result;
    };
  };

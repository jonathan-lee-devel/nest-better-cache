import {
  __resetCacheManagerForTests,
  setCacheManager,
} from '../cache-registry';
import { CacheEvict } from '../decorators/cache-evict.decorator';

import type { Cache } from 'cache-manager';

const buildCache = (): jest.Mocked<Cache> =>
  ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn().mockResolvedValue(undefined),
  }) as unknown as jest.Mocked<Cache>;

describe('@CacheEvict', () => {
  let cache: jest.Mocked<Cache>;

  beforeEach(() => {
    cache = buildCache();
    setCacheManager(cache);
  });

  afterEach(() => {
    __resetCacheManagerForTests();
    jest.clearAllMocks();
  });

  it('evicts each configured key after the method resolves', async () => {
    class ProductService {
      @CacheEvict('product.getById.v1.{id}', 'product.list.v1')
      async updateMethod(id: string) {
        return { id, updated: true };
      }
    }

    const result = await new ProductService().updateMethod('42');

    expect(result).toEqual({ id: '42', updated: true });
    expect(cache.del).toHaveBeenCalledWith('product.getById.v1.42');
    expect(cache.del).toHaveBeenCalledWith('product.list.v1');
  });

  it('does not evict if the underlying method throws', async () => {
    class ProductService {
      @CacheEvict('product.getById.v1.{id}')
      async updateMethod(id: string) {
        throw new Error(`failed to update ${id}`);
      }
    }

    await expect(new ProductService().updateMethod('42')).rejects.toThrow(
      'failed to update 42',
    );
    expect(cache.del).not.toHaveBeenCalled();
  });

  it('passes through when no keys are configured', async () => {
    class ProductService {
      @CacheEvict()
      async updateMethod() {
        return 'ok';
      }
    }

    const result = await new ProductService().updateMethod();
    expect(result).toBe('ok');
    expect(cache.del).not.toHaveBeenCalled();
  });
});

import { __resetCacheManagerForTests, setCacheManager, setRedisClient } from '../cache-registry';
import { CacheEvict } from '../decorators/cache-evict.decorator';

import type { RedisClient } from '../redis-client.token';
import type { Cache } from 'cache-manager';

const buildCache = (): jest.Mocked<Cache> =>
  ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn().mockResolvedValue(undefined),
  }) as unknown as jest.Mocked<Cache>;

interface RedisStub {
  scanIterator: jest.Mock;
  unlink: jest.Mock;
}

const buildRedis = (batches: string[][] = []): RedisStub => ({
  scanIterator: jest.fn().mockImplementation(async function* () {
    for (const batch of batches) {
      yield batch;
    }
  }),
  unlink: jest.fn().mockResolvedValue(0),
});

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

    await expect(new ProductService().updateMethod('42')).rejects.toThrow('failed to update 42');
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

  it('evicts every key matching a wildcard pattern via SCAN+UNLINK', async () => {
    const redis = buildRedis([
      ['products.v1.getById.1', 'products.v1.getById.2'],
      ['products.v1.getById.3'],
    ]);
    setRedisClient(redis as unknown as RedisClient);

    class ProductService {
      @CacheEvict('products.v1.getById.*')
      async invalidateAll() {
        return 'ok';
      }
    }

    await new ProductService().invalidateAll();

    expect(redis.scanIterator).toHaveBeenCalledWith({
      MATCH: 'products.v1.getById.*',
      COUNT: 100,
    });
    expect(redis.unlink).toHaveBeenCalledTimes(2);
    expect(redis.unlink).toHaveBeenNthCalledWith(1, [
      'products.v1.getById.1',
      'products.v1.getById.2',
    ]);
    expect(redis.unlink).toHaveBeenNthCalledWith(2, ['products.v1.getById.3']);
    expect(cache.del).not.toHaveBeenCalled();
  });

  it('does not call UNLINK when SCAN yields no matches', async () => {
    const redis = buildRedis([]);
    setRedisClient(redis as unknown as RedisClient);

    class ProductService {
      @CacheEvict('products.v1.getById.*')
      async invalidateAll() {
        return 'ok';
      }
    }

    await new ProductService().invalidateAll();

    expect(redis.scanIterator).toHaveBeenCalled();
    expect(redis.unlink).not.toHaveBeenCalled();
  });

  it('resolves placeholders inside wildcard patterns', async () => {
    const redis = buildRedis([['products.v1.org.42.item.1']]);
    setRedisClient(redis as unknown as RedisClient);

    class ProductService {
      @CacheEvict('products.v1.org.{orgId}.*')
      async invalidateOrg(orgId: string) {
        return orgId;
      }
    }

    await new ProductService().invalidateOrg('42');

    expect(redis.scanIterator).toHaveBeenCalledWith({
      MATCH: 'products.v1.org.42.*',
      COUNT: 100,
    });
    expect(redis.unlink).toHaveBeenCalledWith(['products.v1.org.42.item.1']);
  });

  it('mixes literal and wildcard keys in a single decorator call', async () => {
    const redis = buildRedis([['products.v1.list.page1']]);
    setRedisClient(redis as unknown as RedisClient);

    class ProductService {
      @CacheEvict('products.v1.getById.{id}', 'products.v1.list.*')
      async updateMethod(id: string) {
        return id;
      }
    }

    await new ProductService().updateMethod('42');

    expect(cache.del).toHaveBeenCalledWith('products.v1.getById.42');
    expect(cache.del).toHaveBeenCalledTimes(1);
    expect(redis.scanIterator).toHaveBeenCalledWith({
      MATCH: 'products.v1.list.*',
      COUNT: 100,
    });
    expect(redis.unlink).toHaveBeenCalledWith(['products.v1.list.page1']);
  });
});

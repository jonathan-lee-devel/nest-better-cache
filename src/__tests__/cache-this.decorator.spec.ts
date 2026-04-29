import { __resetCacheManagerForTests, setCacheManager } from '../cache-registry';
import { CacheThis } from '../decorators/cache-this.decorator';

import type { Cache } from 'cache-manager';

const buildCache = (): jest.Mocked<Cache> =>
  ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  }) as unknown as jest.Mocked<Cache>;

describe('@CacheThis', () => {
  let cache: jest.Mocked<Cache>;

  beforeEach(() => {
    cache = buildCache();
    setCacheManager(cache);
  });

  afterEach(() => {
    __resetCacheManagerForTests();
    jest.clearAllMocks();
  });

  it('returns the cached value, skipping the underlying call', async () => {
    cache.get.mockResolvedValue({ id: '42', cached: true });
    const fetch = jest.fn();

    class ProductService {
      @CacheThis('product.getById.v1.{id}')
      async getByIdMethod(id: string) {
        fetch(id);
        return { id, cached: false };
      }
    }

    const result = await new ProductService().getByIdMethod('42');

    expect(result).toEqual({ id: '42', cached: true });
    expect(cache.get).toHaveBeenCalledWith('product.getById.v1.42');
    expect(fetch).not.toHaveBeenCalled();
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('calls the method and stores the result on a miss, honoring ttl', async () => {
    cache.get.mockResolvedValue(null);

    class ProductService {
      @CacheThis('product.getById.v1.{id}', { ttl: 60_000 })
      async getByIdMethod(id: string) {
        return { id, fresh: true };
      }
    }

    const result = await new ProductService().getByIdMethod('42');

    expect(result).toEqual({ id: '42', fresh: true });
    expect(cache.set).toHaveBeenCalledWith(
      'product.getById.v1.42',
      { id: '42', fresh: true },
      60_000,
    );
  });

  it('matches placeholders to parameters by name across multiple args', async () => {
    cache.get.mockResolvedValue(null);

    class ProductService {
      @CacheThis('product.search.v1.{q}.{page}')
      async search(q: string, page: number) {
        return [q, page];
      }
    }

    await new ProductService().search('shoes', 2);
    expect(cache.get).toHaveBeenCalledWith('product.search.v1.shoes.2');
  });

  it('preserves the `this` context of the original method', async () => {
    cache.get.mockResolvedValue(null);

    class ProductService {
      private readonly suffix = '!';

      @CacheThis('product.{id}')
      async method(id: string) {
        return id + this.suffix;
      }
    }

    const svc = new ProductService();
    const result = await svc.method('x');
    expect(result).toBe('x!');
  });

  it('resolves dot-notation placeholders against object parameters', async () => {
    cache.get.mockResolvedValue(null);

    interface Query {
      categoryId: string;
      isActive: boolean;
    }
    interface User {
      requestingUserSubject: string;
    }

    class ProductsController {
      @CacheThis(
        'products.{organizationId}.{query.categoryId}.{query.isActive}.{user.requestingUserSubject}',
      )
      async list(organizationId: string, user: User, query: Query) {
        return [organizationId, user, query];
      }
    }

    await new ProductsController().list(
      'org-1',
      { requestingUserSubject: 'sub-9' },
      { categoryId: 'cat-3', isActive: true },
    );

    expect(cache.get).toHaveBeenCalledWith('products.org-1.cat-3.true.sub-9');
  });

  it('fails fast at decoration time when a placeholder does not match any parameter', () => {
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      class Bad {
        @CacheThis('product.{nope}')
        async method(id: string) {
          return id;
        }
      }
    }).toThrow(/does not match any method parameter/);
  });
});

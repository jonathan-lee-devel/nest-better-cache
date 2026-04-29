import { Reflector } from '@nestjs/core';
import { firstValueFrom, of } from 'rxjs';

import type { CallHandler, ExecutionContext } from '@nestjs/common';
import type { Cache } from 'cache-manager';

import {
  CACHE_THIS_KEY_METADATA,
  CACHE_THIS_TTL_METADATA,
} from '../cache.constants';
import { CacheThisInterceptor } from '../interceptors/cache-this.interceptor';

const handler = () => undefined;

const buildContext = (): ExecutionContext =>
  ({
    getHandler: () => handler,
    getClass: () => class {},
  }) as unknown as ExecutionContext;

interface MockCallHandler extends CallHandler {
  handle: jest.Mock;
}

const buildNext = (value: unknown): MockCallHandler => ({
  handle: jest.fn(() => of(value)),
});

const buildCache = (overrides: Partial<Cache> = {}): jest.Mocked<Cache> =>
  ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    ...overrides,
  }) as unknown as jest.Mocked<Cache>;

describe('CacheThisInterceptor', () => {
  it('returns the cached value without invoking the handler when present', async () => {
    const reflector = new Reflector();
    jest
      .spyOn(reflector, 'get')
      .mockImplementation((key) =>
        key === CACHE_THIS_KEY_METADATA ? 'organizations.v1.list' : undefined,
      );
    const cache = buildCache({
      get: jest.fn().mockResolvedValue([{ id: 1 }]),
    });
    const interceptor = new CacheThisInterceptor(cache, reflector);
    const next = buildNext('fresh');

    const result = await firstValueFrom(
      interceptor.intercept(buildContext(), next),
    );

    expect(result).toEqual([{ id: 1 }]);
    expect(cache.get).toHaveBeenCalledWith('organizations.v1.list');
    expect(next.handle).not.toHaveBeenCalled();
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('invokes the handler and stores its result on a miss, honoring ttl', async () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'get').mockImplementation((key) => {
      if (key === CACHE_THIS_KEY_METADATA) return 'organizations.v1.list';
      if (key === CACHE_THIS_TTL_METADATA) return 60_000;
      return undefined;
    });
    const cache = buildCache({ get: jest.fn().mockResolvedValue(null) });
    const interceptor = new CacheThisInterceptor(cache, reflector);
    const next = buildNext({ id: 1 });

    const result = await firstValueFrom(
      interceptor.intercept(buildContext(), next),
    );

    expect(result).toEqual({ id: 1 });
    expect(next.handle).toHaveBeenCalled();
    expect(cache.set).toHaveBeenCalledWith(
      'organizations.v1.list',
      { id: 1 },
      60_000,
    );
  });

  it('passes through when no key metadata is present', async () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'get').mockReturnValue(undefined);
    const cache = buildCache();
    const interceptor = new CacheThisInterceptor(cache, reflector);
    const next = buildNext('value');

    const result = await firstValueFrom(
      interceptor.intercept(buildContext(), next),
    );

    expect(result).toBe('value');
    expect(cache.get).not.toHaveBeenCalled();
  });
});

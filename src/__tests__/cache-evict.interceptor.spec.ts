import { Reflector } from '@nestjs/core';
import { firstValueFrom, of } from 'rxjs';

import type { CallHandler, ExecutionContext } from '@nestjs/common';
import type { Cache } from 'cache-manager';

import { CACHE_EVICT_KEYS_METADATA } from '../cache.constants';
import { CacheEvictInterceptor } from '../interceptors/cache-evict.interceptor';

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

const buildCache = (): jest.Mocked<Cache> =>
  ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn().mockResolvedValue(undefined),
  }) as unknown as jest.Mocked<Cache>;

describe('CacheEvictInterceptor', () => {
  it('evicts every configured key after the handler resolves', async () => {
    const reflector = new Reflector();
    jest
      .spyOn(reflector, 'get')
      .mockImplementation((key) =>
        key === CACHE_EVICT_KEYS_METADATA
          ? ['organizations.v1.list', 'organizations.v1.detail']
          : undefined,
      );
    const cache = buildCache();
    const interceptor = new CacheEvictInterceptor(cache, reflector);
    const next = buildNext('updated');

    const result = await firstValueFrom(
      interceptor.intercept(buildContext(), next),
    );

    expect(result).toBe('updated');
    expect(cache.del).toHaveBeenCalledTimes(2);
    expect(cache.del).toHaveBeenCalledWith('organizations.v1.list');
    expect(cache.del).toHaveBeenCalledWith('organizations.v1.detail');
  });

  it('passes through untouched when no keys are configured', async () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'get').mockReturnValue(undefined);
    const cache = buildCache();
    const interceptor = new CacheEvictInterceptor(cache, reflector);
    const next = buildNext('updated');

    const result = await firstValueFrom(
      interceptor.intercept(buildContext(), next),
    );

    expect(result).toBe('updated');
    expect(cache.del).not.toHaveBeenCalled();
  });
});

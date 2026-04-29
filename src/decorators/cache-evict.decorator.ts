import { applyDecorators, SetMetadata, UseInterceptors } from '@nestjs/common';

import { CACHE_EVICT_KEYS_METADATA } from '../cache.constants';
import { CacheEvictInterceptor } from '../interceptors/cache-evict.interceptor';

export const CacheEvict = (
  ...keys: string[]
): MethodDecorator & ClassDecorator =>
  applyDecorators(
    SetMetadata(CACHE_EVICT_KEYS_METADATA, keys),
    UseInterceptors(CacheEvictInterceptor),
  );

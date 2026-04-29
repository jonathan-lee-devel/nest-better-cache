import { applyDecorators, SetMetadata, UseInterceptors } from '@nestjs/common';

import {
  CACHE_THIS_KEY_METADATA,
  CACHE_THIS_TTL_METADATA,
} from '../cache.constants';
import { CacheThisInterceptor } from '../interceptors/cache-this.interceptor';

export interface CacheThisOptions {
  /** Time-to-live in milliseconds. Falls back to the cache store's default when omitted. */
  ttl?: number;
}

export const CacheThis = (
  key: string,
  options: CacheThisOptions = {},
): MethodDecorator & ClassDecorator =>
  applyDecorators(
    SetMetadata(CACHE_THIS_KEY_METADATA, key),
    SetMetadata(CACHE_THIS_TTL_METADATA, options.ttl),
    UseInterceptors(CacheThisInterceptor),
  );

import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Cache } from 'cache-manager';
import { Observable, tap } from 'rxjs';

import { CACHE_EVICT_KEYS_METADATA } from '../cache.constants';

@Injectable()
export class CacheEvictInterceptor implements NestInterceptor {
  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly reflector: Reflector,
  ) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const handler = context.getHandler();
    const keys = this.reflector.get<string[] | undefined>(
      CACHE_EVICT_KEYS_METADATA,
      handler,
    );
    if (!keys?.length) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(() => {
        void Promise.all(keys.map((k) => this.cache.del(k)));
      }),
    );
  }
}

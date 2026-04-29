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
import { from, Observable, of, switchMap, tap } from 'rxjs';

import {
  CACHE_THIS_KEY_METADATA,
  CACHE_THIS_TTL_METADATA,
} from '../cache.constants';

@Injectable()
export class CacheThisInterceptor implements NestInterceptor {
  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly reflector: Reflector,
  ) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const handler = context.getHandler();
    const key = this.reflector.get<string | undefined>(
      CACHE_THIS_KEY_METADATA,
      handler,
    );
    if (!key) {
      return next.handle();
    }
    const ttl = this.reflector.get<number | undefined>(
      CACHE_THIS_TTL_METADATA,
      handler,
    );

    return from(this.cache.get(key)).pipe(
      switchMap((cached) => {
        if (cached !== undefined && cached !== null) {
          return of(cached);
        }
        return next.handle().pipe(
          tap((value) => {
            if (value !== undefined && value !== null) {
              void this.cache.set(key, value, ttl);
            }
          }),
        );
      }),
    );
  }
}

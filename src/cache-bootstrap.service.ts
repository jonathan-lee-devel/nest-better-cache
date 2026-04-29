import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { Cache } from 'cache-manager';

import { setCacheManager } from './cache-registry';

@Injectable()
export class CacheBootstrapService implements OnModuleInit {
  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  onModuleInit(): void {
    setCacheManager(this.cache);
  }
}

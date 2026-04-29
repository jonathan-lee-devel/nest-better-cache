import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { Cache } from 'cache-manager';

import { setCacheManager, setRedisClient } from './cache-registry';
import { REDIS_CLIENT, type RedisClient } from './redis-client.token';

@Injectable()
export class CacheBootstrapService implements OnModuleInit {
  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    @Inject(REDIS_CLIENT) private readonly redis: RedisClient,
  ) {}

  onModuleInit(): void {
    setCacheManager(this.cache);
    setRedisClient(this.redis);
  }
}

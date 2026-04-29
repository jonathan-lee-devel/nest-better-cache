import KeyvRedis, { createClient } from '@keyv/redis';
import { CacheModule } from '@nestjs/cache-manager';
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import type { RedisClientType } from '@keyv/redis';
import type { FactoryProvider } from '@nestjs/common';

import { CacheBootstrapService } from './cache-bootstrap.service';

/**
 * Injection token for the connected Redis client that backs the cache store.
 * Use this when you need raw Redis commands (SADD/SMEMBERS/SCAN/EXPIRE) that
 * the cache-manager abstraction does not expose. Keys read/written via
 * cache-manager are stored as-is (no namespace prefix), so raw client ops can
 * reference them directly.
 */
export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

export type RedisClient = RedisClientType;

const redisClientProvider: FactoryProvider<Promise<RedisClient>> = {
  provide: REDIS_CLIENT,
  inject: [ConfigService],
  useFactory: async (configService: ConfigService) => {
    const client = createClient({
      url: configService.getOrThrow<string>('REDIS_URL'),
    });
    await client.connect();
    return client;
  },
};

@Global()
@Module({
  imports: [ConfigModule],
  providers: [redisClientProvider],
  exports: [REDIS_CLIENT],
})
export class NestBetterCacheRedisClientModule {}

@Global()
@Module({
  imports: [
    NestBetterCacheRedisClientModule,
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [NestBetterCacheRedisClientModule],
      inject: [REDIS_CLIENT],
      useFactory: (client: RedisClient) => ({
        stores: [new KeyvRedis(client, { useUnlink: true })],
      }),
    }),
  ],
  providers: [CacheBootstrapService],
  exports: [NestBetterCacheRedisClientModule, CacheModule],
})
export class NestBetterCacheModule {}

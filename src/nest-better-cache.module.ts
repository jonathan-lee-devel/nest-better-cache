import KeyvRedis, { createClient } from '@keyv/redis';
import { CacheModule } from '@nestjs/cache-manager';
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import type { FactoryProvider } from '@nestjs/common';

import { CacheBootstrapService } from './cache-bootstrap.service';
import { REDIS_CLIENT, type RedisClient } from './redis-client.token';

export { REDIS_CLIENT, type RedisClient } from './redis-client.token';

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

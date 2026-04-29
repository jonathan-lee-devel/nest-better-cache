# @jdevel/nest-better-cache

A better caching library for NestJS. Wraps `@nestjs/cache-manager` + `@keyv/redis`
behind two declarative decorators backed by NestJS interceptors.

## Install

```bash
npm install @jdevel/nest-better-cache
```

Peer dependencies (install in your app):

```bash
npm install @nestjs/cache-manager @nestjs/config @keyv/redis cache-manager
```

## Setup

Import `NestBetterCacheModule` into your application root. It registers a
global Redis-backed cache and reads `REDIS_URL` from your `ConfigService`.

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestBetterCacheModule } from '@jdevel/nest-better-cache';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), NestBetterCacheModule],
})
export class AppModule {}
```

## Example Usage

```ts
import { Controller, Get, Post } from '@nestjs/common';
import { CacheThis, CacheEvict } from '@jdevel/nest-better-cache';

@Controller('organizations')
export class OrganizationsController {
  @Get()
  @CacheThis('organizations.v1.list')
  async getMethod() {
    // ...
  }

  @Post()
  @CacheEvict('organizations.v1.list')
  async updateMethod() {
    // ...
  }
}
```

`@CacheThis(key, { ttl? })` returns the cached value when present; otherwise it
runs the method and stores the result. `@CacheEvict(...keys)` runs the method
then deletes each key. Both decorators apply to controller route handlers — the
underlying interceptors fire when Nest dispatches an `ExecutionContext`.

## Raw Redis access

The connected Redis client is exposed under the `REDIS_CLIENT` token for
operations that `cache-manager` does not surface (e.g. `SADD`, `SCAN`):

```ts
import { Inject } from '@nestjs/common';
import { REDIS_CLIENT, RedisClient } from '@jdevel/nest-better-cache';

class TagService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: RedisClient) {}
}
```

## Scripts

```bash
npm run build          # tsc
npm run test           # jest
npm run test:watch     # jest --watch
npm run test:cov       # jest --coverage
npm run lint           # eslint src/
npm run lint:fix       # eslint src/ --fix
npm run format         # prettier --write
npm run format:check   # prettier --check
```

## License

MIT

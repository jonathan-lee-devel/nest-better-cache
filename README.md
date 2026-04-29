# @jdevel/nest-better-cache

A better caching library for NestJS. Wraps `@nestjs/cache-manager` + `@keyv/redis`
behind two declarative decorators that match cache-key placeholders to method
parameter names by signature — so the same decorator works on HTTP controllers,
`@MessagePattern` RPC handlers, and plain service methods.

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
import { CacheThis, CacheEvict } from '@jdevel/nest-better-cache';

class ProductService {
  @CacheThis('product.getById.v1.{id}')
  async getByIdMethod(id: string) {
    // ...
  }

  @CacheEvict('product.getById.v1.{id}', 'product.list.v1')
  async updateMethod(id: string) {
    // ...
  }
}
```

`@CacheThis(key, { ttl? })` returns the cached value when present; otherwise it
runs the method and stores the result. `@CacheEvict(...keys)` runs the method
then deletes each key — eviction is skipped if the method throws.

### Dynamic keys

`{name}` placeholders are matched against the decorated method's parameter
names. `{id}` resolves to whatever the parameter literally named `id` receives
at runtime.

```ts
@MessagePattern('product.getById')
@CacheThis('product.getById.v1.{id}')
async getById(@Payload('id') id: string) {
  // call: client.send('product.getById', { id: '42' })
  // cache key: product.getById.v1.42
}
```

```ts
@CacheThis('search.v1.{q}.{page}', { ttl: 60_000 })
async search(q: string, page: number) {
  // search('shoes', 2) → cache key: search.v1.shoes.2
}
```

Placeholder values must be a string, number, boolean, or bigint. The library
fails fast in two cases:

- **At decoration time** if a placeholder names no method parameter.
- **At runtime** if the parameter value is `null`, `undefined`, or non-primitive.

Silent fallthrough would let a misconfigured key quietly skip caching or
collide on a partially substituted key.

### Notes on the design

The decorators wrap the method directly (rather than registering a NestJS
interceptor), which is why parameter-name matching works uniformly across
contexts. The tradeoff is that the cache instance must be available before any
decorated method is invoked — `NestBetterCacheModule` populates it on module
init via `CacheBootstrapService`. In tests that don't bootstrap a Nest module,
call `setCacheManager(mockCache)` manually.

Parameter names are extracted via `Function.prototype.toString()` parsing.
This is robust under standard TypeScript compilation but breaks under
aggressive minifier-driven parameter renaming — typically a non-issue for
Node.js servers.

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

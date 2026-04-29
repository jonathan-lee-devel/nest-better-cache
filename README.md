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

### Wildcard eviction

`@CacheEvict` keys may contain `*`, in which case the key is treated as a
Redis `SCAN`/`MATCH` pattern and every matching entry is unlinked. This is
the typical way to invalidate a whole family of cached results — e.g. every
`getById` row after a bulk update:

```ts
@CacheEvict('products.v1.getById.*')
async reindexAll() { ... }
```

Wildcards compose with placeholders, so you can scope the pattern to one
tenant / org / user:

```ts
@CacheEvict('products.v1.org.{orgId}.*')
async invalidateOrg(orgId: string) { ... }
```

A single decorator call may mix exact keys and wildcard patterns; exact keys
go through `cache-manager`'s `del`, patterns go through Redis `SCAN` +
`UNLINK`. Pattern syntax is Redis's (`*`, `?`, `[abc]`) — most callers just
need a trailing `*` for prefix eviction.

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

## Real-world Examples of Cleaner Cache Patterns

### Before

```ts
import { CacheThis } from '@jdevel/nest-better-cache';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

export class OrganizationsController {
  constructor(
    @Inject(CACHE_MANAGER) readonly cache: Cache,
    private readonly organizationService: OrganizationService,
  ) {}

  async getOrganizationById(organizationId: string) {
    const key = `v1.getOrganizationById.${organizationId}`;
    const cached = await this.cache.get(key);
    if (cached) return cached;

    const organization = await this.organizationService.getOrganizationById(organizationId);
    await this.cache.set(key, organization, ORGANIZATION_CACHE_TTL_MS);
    return organization;
  }

  async updateOrganizationById(organizationId: string, updateDto: UpdateOrganizationDto) {
    const key = `v1.getOrganizationById.${organizationId}`;

    const organization = await this.organizationService.updateOrganizationById(
      organizationId,
      updateDto,
    );
    await this.cache.delete(key);

    return organization;
  }
}
```

### After

```ts
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { CacheEvict, CacheThis } from '@jdevel/nest-better-cache';

export class OrganizationsController {
  constructor(private readonly organizationService: OrganizationService) {}

  // Will only update the cache on a non-null return result of the decorated get method
  @CacheThis('v1.getOrganizationById.{organizationId}', { ttl: ORGANIZATION_CACHE_TTL_MS })
  async getOrganizationById(organizationId: string) {
    return this.organizationService.getOrganizationById(organizationId);
  }

  // Will only evict the cache upon successful execution of the decorated update method
  @CacheEvict('v1.getOrganizationById.{organizationId}')
  async updateOrganizationById(organizationId: string, updateDto: UpdateOrganizationDto) {
    return this.organizationService.updateOrganizationById(organizationId, updateDto);
  }
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

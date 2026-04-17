# tagcache

> Tagged cache for Cloudflare Workers and edge runtimes.

## Install

```sh
bun add tagcache
# or
npm install tagcache
```

## Usage

```ts
import { createCache } from "tagcache"
import { kvBackend } from "@tagcache/kv"

const cache = createCache({
  backend: kvBackend({ namespace: env.CACHE_KV }),
  ctx, // ExecutionContext for SWR background revalidation
})

// Function wrapping with tags
const user = await cache.getOrSet(
  `user:${id}`,
  "1h",
  () => db.getUser(id),
  { tags: [`user:${id}`] },
)

// Tag invalidation
await cache.invalidateTag(`user:${id}`)
```

## API

### `createCache(options): Cache`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `backend` | `CacheBackend` | required | Persistent storage backend |
| `l1` | `CacheBackend` | - | Per-colo L1 cache (e.g., Cache API) |
| `coalesce` | `boolean` | `true` | Deduplicate concurrent requests to same key |
| `swr` | `boolean` | `true` | Stale-while-revalidate via `ctx.waitUntil` |
| `grace` | `number \| string` | - | Serve stale data on factory failure for this duration |
| `stats` | `boolean` | `false` | Enable hit/miss/error counters |
| `ctx` | `ExecutionContext` | - | Workers execution context for background tasks |
| `now` | `() => number` | `Date.now` | Injectable clock (for testing) |

### `Cache` methods

- **`get<T>(key): Promise<T | undefined>`** — Read a value
- **`set<T>(key, data, opts?): Promise<void>`** — Write a value with optional TTL and tags
- **`getOrSet<T>(key, ttl, factory, opts?): Promise<T>`** — Read-through with factory function
- **`del(key): Promise<void>`** — Delete a key
- **`invalidateTag(tag): Promise<void>`** — Invalidate all entries with this tag
- **`stats(): Snapshot`** — Get hit/miss/error counters

### TTL format

Accepts `number` (seconds) or string: `"500ms"`, `"30s"`, `"10m"`, `"1h"`, `"1d"`

## Backends

- [`@tagcache/cache-api`](../cache-api) — Cloudflare Cache API (L1)
- [`@tagcache/kv`](../kv) — Cloudflare KV
- [`@tagcache/d1`](../d1) — Cloudflare D1

## License

MIT

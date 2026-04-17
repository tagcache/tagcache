# tagcache

> Tagged cache for Cloudflare Workers and edge runtimes.
> Built on Cache API, KV, and D1. Zero Node dependencies.

[![CI](https://github.com/tagcache/tagcache/actions/workflows/ci.yml/badge.svg)](https://github.com/tagcache/tagcache/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/tagcache.svg)](https://www.npmjs.com/package/tagcache)
[![license](https://img.shields.io/npm/l/tagcache.svg)](./LICENSE)

## Packages

| Package | Size (min+gz) | Description |
|---------|:---:|-------------|
| [`tagcache`](./packages/core) | ~935 B | Core — cache, tags, SWR, coalescing, grace |
| [`@tagcache/cache-api`](./packages/cache-api) | ~384 B | Cloudflare Cache API backend (L1) |
| [`@tagcache/kv`](./packages/kv) | ~286 B | Cloudflare KV backend |
| [`@tagcache/d1`](./packages/d1) | ~517 B | Cloudflare D1 backend |

**Typical usage (core + kv):** ~1.2 KB | **Full L1+L2 (core + cache-api + kv):** ~1.6 KB

## Quickstart

```ts
import { createCache } from "tagcache"
import { cacheApi } from "@tagcache/cache-api"
import { kvBackend } from "@tagcache/kv"

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext) {
    const cache = createCache({
      l1: cacheApi(),
      backend: kvBackend({ namespace: env.CACHE_KV }),
      ctx,
    })

    const user = await cache.getOrSet(
      `user:${id}`,
      "1h",
      () => fetchUser(id),
      { tags: [`user:${id}`] },
    )

    return Response.json(user)
  },
}
```

## Features

- **Tag invalidation** — `invalidateTag("user:123")` expires all related entries
- **Request coalescing** — concurrent requests to the same key share one factory call
- **Stale-while-revalidate** — serve stale data immediately, refresh in background via `ctx.waitUntil`
- **Grace period** — serve stale data when factory fails, for a configurable duration
- **Multi-tier** — L1 (per-colo Cache API) + L2 (global KV or D1) read-through
- **Stats** — opt-in hit/miss/error counters

## Why

| Alternative | Why it doesn't fit edge |
|-------------|-------------------------|
| `bentocache` | Node-focused, redis client, ~50 KB |
| `cache-manager` | Same, older |
| `keyv` | No tags, no function wrapping |
| `lru-cache` | In-memory only |
| `unstable_cache` | Framework-locked to Next.js |

## Development

```sh
bun install
bun run test
bun run build
bun run size
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution guidelines.

## License

MIT © Minchul Kwon

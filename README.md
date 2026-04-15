# tagcache

> Tagged cache for Cloudflare Workers and edge runtimes.
> Built on Cache API, KV, and D1. Zero Node dependencies.

[![CI](https://github.com/tagcache/tagcache/actions/workflows/ci.yml/badge.svg)](https://github.com/tagcache/tagcache/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/tagcache.svg)](https://www.npmjs.com/package/tagcache)
[![license](https://img.shields.io/npm/l/tagcache.svg)](./LICENSE)

## Status

**Pre-alpha.** Scaffold complete, implementation in progress. See [CONTEXT.md](./CONTEXT.md) for design.

## Packages

| Package | npm | Size budget |
|---------|-----|-------------|
| [`tagcache`](./packages/core) | `tagcache` | ≤ 1.8 KB |
| [`@tagcache/cache-api`](./packages/cache-api) | Cloudflare Cache API backend | ≤ 250 B |
| [`@tagcache/kv`](./packages/kv) | Cloudflare KV backend | ≤ 450 B |
| [`@tagcache/d1`](./packages/d1) | Cloudflare D1 backend | ≤ 500 B |

## Quickstart (planned)

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

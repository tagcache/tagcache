# @tagcache/cache-api

> Cloudflare Cache API backend for [tagcache](../core).

Per-colo L1 cache using the Workers Cache API. Best used as `l1` in a multi-tier setup.

## Install

```sh
bun add @tagcache/cache-api
```

## Usage

```ts
import { createCache } from "tagcache"
import { cacheApi } from "@tagcache/cache-api"
import { kvBackend } from "@tagcache/kv"

const cache = createCache({
  l1: cacheApi(),                              // per-colo L1
  backend: kvBackend({ namespace: env.CACHE_KV }), // persistent L2
  ctx,
})
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `cache` | `Cache` | `caches.open("tagcache")` | Custom Cache instance |
| `keyPrefix` | `string` | `""` | Prefix for cache keys |

## License

MIT

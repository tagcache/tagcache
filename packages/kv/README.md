# @tagcache/kv

> Cloudflare KV backend for [tagcache](../core).

Eventually consistent, cross-colo persistent cache. Tag invalidation uses KV keys with `tag:` prefix storing invalidation timestamps.

## Install

```sh
bun add @tagcache/kv
```

## Usage

```ts
import { createCache } from "tagcache"
import { kvBackend } from "@tagcache/kv"

const cache = createCache({
  backend: kvBackend({ namespace: env.CACHE_KV }),
  ctx,
})
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `namespace` | `KVNamespace` | required | Workers KV namespace binding |
| `keyPrefix` | `string` | `""` | Prefix for cache entry keys |
| `tagPrefix` | `string` | `"tag:"` | Prefix for tag invalidation keys |

## Note

KV has a 60-second minimum TTL. Entries with shorter TTLs are stored with 60s expiration.

## License

MIT

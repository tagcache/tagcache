# @tagcache/d1

> Cloudflare D1 backend for [tagcache](../core).

Strongly consistent, SQL-based cache with tag invalidation.

## Install

```sh
bun add @tagcache/d1
```

## Setup

Apply migrations before first use:

```sh
wrangler d1 execute <DB_NAME> --file=node_modules/@tagcache/d1/migrations.sql
```

Or programmatically:

```ts
import { migrations } from "@tagcache/d1"

for (const sql of migrations) {
  await env.DB.exec(sql)
}
```

## Usage

```ts
import { createCache } from "tagcache"
import { d1Backend } from "@tagcache/d1"

const cache = createCache({
  backend: d1Backend({ db: env.DB }),
  ctx,
})
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `db` | `D1Database` | required | Workers D1 database binding |
| `tableName` | `string` | `"tagcache_entries"` | Custom table name prefix |

## License

MIT

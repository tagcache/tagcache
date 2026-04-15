# tagcache — Design Context

> **Status**: Design finalized. Ready to scaffold monorepo and implement.
> This document is the canonical source for design decisions made so far.
> Resume work from here in a new session.

---

## What we're building

A **tagged cache for Cloudflare Workers and edge runtimes** — zero Node dependencies, built on Cache API + KV + D1.

**Positioning:**
- Fills a gap: `bentocache` / `cache-manager` / `keyv` are Node-focused
- Edge-native: no `fs`, no `net.Socket`, no `EventEmitter`
- All production features built-in (tags, coalescing, SWR, grace, stats)
- Small bundle (≤ 2 KB for typical usage)

**Tagline draft:**
> Tagged cache for Cloudflare Workers and edge runtimes.
> Built on Cache API, KV, and D1. Zero Node dependencies.

---

## Name + ownership

- **npm org:** `@tagcache` — created, owned by user
- **GitHub org:** `github.com/tagcache` — created, owned by user
- **Core package (unscoped):** `tagcache`
- **Backend packages:** `@tagcache/cache-api`, `@tagcache/kv`, `@tagcache/d1`
- **Repo:** single monorepo at `github.com/tagcache/tagcache`

---

## Why not alternatives

| Library | Why it doesn't fit |
|---------|-------------------|
| `bentocache` | Node-focused, redis client, ~50KB, no Workers support |
| `cache-manager` | Same, older |
| `lru-cache` | Just LRU, no tags, no backends |
| `keyv` | Key-value only, no function wrapping, no tags |
| `p-memoize` | In-memory only, no backends, no tags |
| `nextjs unstable_cache` | Framework-locked |

**tagcache differentiator:** Edge-first + tags + function wrapping + tiny bundle.

---

## Architecture

### Package layout (pnpm monorepo)

```
packages/
├── core/                      # npm: tagcache
│   └── src/
│       ├── index.ts           # public API
│       ├── cache.ts           # Cache class (all features)
│       ├── types.ts           # Backend contract
│       └── compose.ts         # multi-tier routing
│
├── cache-api/                 # npm: @tagcache/cache-api
│   └── src/index.ts
│
├── kv/                        # npm: @tagcache/kv
│   └── src/index.ts
│
└── d1/                        # npm: @tagcache/d1
    └── src/
        ├── index.ts
        └── migrations.sql
```

### Top-level repo layout

```
tagcache/                       # github.com/tagcache/tagcache
├── packages/                   # see above
├── apps/
│   └── bench/                  # wrangler-based benchmark (private)
├── .changeset/                 # changesets — multi-package versioning
├── .github/workflows/
│   ├── ci.yml                  # test + size-limit per package
│   └── release.yml             # changesets → npm publish (OIDC)
├── shared/
│   ├── tsconfig.base.json
│   └── tsup.config.base.ts
├── pnpm-workspace.yaml
├── package.json                # private root
├── turbo.json                  # optional
├── README.md
├── LICENSE                     # MIT
└── CONTRIBUTING.md
```

---

## Core features (all built-in)

Decision: **features bundle in core**, not separate extension packages. Only backends are separate packages.

```ts
import { createCache } from "tagcache"
import { cacheApi } from "@tagcache/cache-api"
import { kvBackend } from "@tagcache/kv"

const cache = createCache({
  // Multi-tier (built-in to core)
  l1: cacheApi(caches.default),           // optional, per-colo L1
  backend: kvBackend(env.CACHE_KV),       // required, persistent
  // All features default ON, opt-out via options
  coalesce: true,                         // in-flight request dedup
  swr: true,                              // stale-while-revalidate
  grace: "24h",                           // stale fallback on factory failure
  stats: true,                            // hit/miss/hitRate counters
  ctx,                                    // Workers ExecutionContext — for waitUntil
})

await cache.getOrSet("key", ttl, () => factory())
await cache.invalidateTag("tagname")
const s = cache.stats()  // opt-in, tree-shaken if unused
```

### Feature list (core)

1. **`getOrSet(key, ttl, factory, opts?)`** — primary API
2. **`get(key)`** / **`set(key, data, opts)`** / **`del(key)`**
3. **Tag invalidation** — `invalidateTag(tag)`, `deleteByTag(tag)`
4. **Request coalescing** — in-flight Promise Map (per isolate, transient)
5. **Stale-while-revalidate** — serve stale + background refresh via `ctx.waitUntil`
6. **Grace period** — serve stale if factory throws (duration configurable)
7. **Stats** — hits/misses/hit rate/p50/p95/errors (opt-in via `stats: true`)
8. **Multi-tier** — `l1` → `backend` read-through with write-through

### Tag invalidation strategy (per backend)

| Backend | Strategy |
|---------|----------|
| **KV** | `tag:<name>` key stores invalidation timestamp. On get, compare entry's `createdAt` vs tag's `invalidatedAt`. Eventually consistent but low write cost. |
| **D1** | `tagcache_tags(tag, key, invalidated_at)` table with indexes. Strongly consistent. |
| **Cache API** | No native tags. Must pair with KV or D1 for tag index. Used as L1 only. |

### Multi-tier behavior

- **Read**: try L1 first, miss → try backend → miss → run factory → write both
- **Write** (via factory): write L1 + backend
- **Invalidate**: write tag timestamp to all tiers (so L1 honors invalidation without L2 roundtrip)
- **Failure modes**: if L1 errors, fall back to backend silently

---

## Environment constraints

### What works at Edge (Cloudflare Workers)

| Storage | Use |
|---------|-----|
| **Cache API** (`caches.default`) | L1 — per-colo, LRU, free, Response-based |
| **KV** | L2 — cross-colo, eventually consistent, 60s TTL floor |
| **D1** | L2 — SQL, strongly consistent, per-region |
| **Durable Objects** | Future consideration — strong consistency, cross-colo |

### What does NOT work

- **In-isolate memory cache** — isolate lifetime is short; worthless for cross-request caching
  - **Decision**: Memory backend **REMOVED** from scope
  - **Exception**: In-flight coalescing uses an in-memory `Map<key, Promise>` — OK because entries are transient (only during concurrent request window)
- **Node builtins** — `fs`, `net`, `EventEmitter`, `crypto` (Node version) → use Web Crypto `crypto.subtle`
- **Long-lived connections** — no Redis socket, no keep-alive pools

---

## Size budget (min+gz)

| Package | Target | Notes |
|---------|--------|-------|
| `tagcache` (core) | **≤ 1.8 KB** | All features bundled |
| `@tagcache/cache-api` | **≤ 250 B** | Thin Response wrapper |
| `@tagcache/kv` | **≤ 450 B** | Includes tag index logic |
| `@tagcache/d1` | **≤ 500 B** | SQL queries as strings |

**Typical usage (core + kv):** ~2.0 KB
**Full L1+L2 (core + cache-api + kv):** ~2.3 KB

CI must fail if any package exceeds budget — use [`size-limit`](https://github.com/ai/size-limit) per package.

---

## Toolchain

| Concern | Choice |
|---------|--------|
| Package manager | **pnpm** (workspace support) |
| Build | **tsup** (ESM + CJS + d.ts) |
| Test | **vitest** |
| Versioning | **changesets** (per-package independent versions) |
| Bundle size check | **size-limit** |
| Publish | **npm OIDC trusted publisher** (no NPM_TOKEN) |
| CI | GitHub Actions |
| Lint | **eslint** + **@typescript-eslint** |
| Format | **prettier** or keep eslint-only |
| Benchmark | `apps/bench` — wrangler-based Worker |

### Node / runtime

- Source: ES2022, ESM primary
- Target: Workers, Deno, Bun, Vercel Edge, Node 20+ (where Cache API shims exist)
- No Node-specific runtime APIs in core

---

## API shape (preview)

### Core

```ts
// packages/core/src/types.ts
export interface CacheBackend {
  readonly name: string
  get<T>(key: string): Promise<CacheEntry<T> | undefined>
  set<T>(key: string, entry: CacheEntry<T>): Promise<void>
  del(key: string): Promise<void>
  // Tag support — backends that can't do tags natively throw at setup
  invalidateTag(tag: string, at: number): Promise<void>
  getTagInvalidatedAt(tag: string): Promise<number | undefined>
}

export interface CacheEntry<T = unknown> {
  data: T
  tags: string[]
  createdAt: number   // ms since epoch
  expiresAt: number   // ms since epoch
}

// packages/core/src/cache.ts
export interface CreateCacheOptions {
  backend: CacheBackend
  l1?: CacheBackend
  coalesce?: boolean        // default true
  swr?: boolean              // default true
  grace?: number | string    // default "24h"
  stats?: boolean            // default false
  ctx?: { waitUntil(p: Promise<unknown>): void }
  now?: () => number         // injectable clock for tests
}

export interface Cache {
  get<T>(key: string): Promise<T | undefined>
  set<T>(key: string, data: T, opts?: SetOptions): Promise<void>
  getOrSet<T>(key: string, ttl: number | string, factory: () => Promise<T>, opts?: GetOrSetOptions): Promise<T>
  del(key: string): Promise<void>
  invalidateTag(tag: string): Promise<void>
  stats?(): Snapshot
}

export function createCache(opts: CreateCacheOptions): Cache
```

### Backends

```ts
// @tagcache/cache-api
export function cacheApi(opts?: { cache?: Cache; keyPrefix?: string }): CacheBackend

// @tagcache/kv
export function kvBackend(opts: { namespace: KVNamespace; keyPrefix?: string; tagPrefix?: string }): CacheBackend

// @tagcache/d1
export function d1Backend(opts: { db: D1Database; tableName?: string }): CacheBackend
// Schema shipped as migrations.sql — apply with:
//   wrangler d1 execute <DB> --file=node_modules/@tagcache/d1/migrations.sql
```

---

## TTL handling

- Accept both `number` (seconds) and string `"1h"` / `"30m"` / `"1d"`
- Internal parse helper (≤80B) converts to number
- `TTL` presets exported:
  ```ts
  export const TTL = {
    minutes: "10m",
    hours: "1h",
    days: "1d",
  }
  ```

---

## Roadmap

### Phase 0 — scaffold (current state)
- [x] npm org `@tagcache` created
- [x] GitHub org `tagcache` created
- [ ] `~/personal/tagcache` contains initial v0.1 code — **NEEDS FULL REWRITE** for Workers (currently Node-oriented)

### Phase 1 — monorepo setup (next)
- [ ] Wipe existing code in `~/personal/tagcache/src`, `test`, `dist`
- [ ] Initialize pnpm workspace
- [ ] Create `packages/core`, `packages/cache-api`, `packages/kv`, `packages/d1`
- [ ] Shared tsconfig, tsup config
- [ ] changesets init
- [ ] size-limit per package (enforce budgets)
- [ ] `.github/workflows/ci.yml` with test + size check
- [ ] `.github/workflows/release.yml` with npm OIDC publish
- [ ] Root README, LICENSE (MIT), CONTRIBUTING.md

### Phase 2 — core implementation
- [ ] `CacheBackend` interface
- [ ] `createCache` with multi-tier routing
- [ ] Tag invalidation (timestamp-based)
- [ ] Coalescing (in-flight Map)
- [ ] SWR (waitUntil-based)
- [ ] Grace period
- [ ] Stats (opt-in)
- [ ] TTL parsing
- [ ] 100% test coverage

### Phase 3 — backends
- [ ] `@tagcache/cache-api` + tests against Workers runtime
- [ ] `@tagcache/kv` + tests (mock KVNamespace)
- [ ] `@tagcache/d1` + tests + migrations export

### Phase 4 — bench + docs
- [ ] `apps/bench` — real wrangler Worker, measure cold/warm/coalescing
- [ ] README with install + quickstart + full examples
- [ ] Per-package READMEs
- [ ] Compare table vs bentocache/keyv/lru-cache

### Phase 5 — publish 0.1.0
- [ ] npm OIDC trusted publisher setup at @tagcache npm org
- [ ] First changeset → release → publish all 4 packages
- [ ] Announce (HN Show, r/CloudflareWorkers, Twitter)

### Phase 6 — adoption
- [ ] Replace custom cache in `/Users/stephen/src/ax/ax-web` (currently uses bentocache — assess if tagcache fits)
- [ ] Port `/Users/stephen/src/github-activity` if Workers migration happens

---

## Open questions for next session

1. **`@tagcache/otel` later?** — OpenTelemetry integration as a separate package for production observability
2. **`@tagcache/nextjs`?** — Next.js App Router integration helper (replaces `unstable_cache` at the edge)
3. **`@tagcache/durable-objects`?** — Future, for strongly consistent cross-colo cache
4. **Benchmark against bentocache?** — Run side-by-side in `apps/bench` for the README table

---

## References

- Existing v0.1 code in this directory (`src/`, `test/`) — uses Node-only backends (memory/file/valkey). **Rewrite target is completely different.** Keep only as reference for API shape.
- Bentocache docs: https://bentocache.dev
- Cloudflare Cache API: https://developers.cloudflare.com/workers/runtime-apis/cache/
- Cloudflare KV: https://developers.cloudflare.com/kv/
- Cloudflare D1: https://developers.cloudflare.com/d1/
- changesets: https://github.com/changesets/changesets
- size-limit: https://github.com/ai/size-limit
- tsup: https://tsup.egoist.dev
- vitest: https://vitest.dev

---

## Earlier context (from ax-web conversation)

This package was born from needing cache in the `/Users/stephen/src/ax` project. Current state there:
- ax-web uses **bentocache** (Node-only, ~50KB)
- ax-api (Go) has no cache yet
- Performance measured: cold 6.1s → warm 0.6s with bentocache

`tagcache` is **not** a direct replacement for bentocache in Node apps. It's targeted at Edge where bentocache doesn't run.

The initial mistake was designing tagcache as a Node library competing with bentocache — this was abandoned after realizing:
1. bentocache already occupies that niche well
2. Edge runtime is the actual gap

So tagcache = Edge-only = a real differentiator.

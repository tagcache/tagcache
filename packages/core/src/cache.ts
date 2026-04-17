import type { CacheBackend, CacheEntry } from "./types.js"
import { parseTtl } from "./ttl.js"

export interface TaggedOptions {
  tags?: string[]
}

export interface SetOptions extends TaggedOptions {
  ttl?: number | string
}

export interface GetOrSetOptions extends TaggedOptions {
  staleTtl?: number | string
}

export interface Snapshot {
  hits: number
  misses: number
  errors: number
  hitRate: number
}

export interface CreateCacheOptions {
  backend: CacheBackend
  l1?: CacheBackend
  coalesce?: boolean
  swr?: boolean
  grace?: number | string
  stats?: boolean
  ctx?: { waitUntil(p: Promise<unknown>): void }
  now?: () => number
}

export interface Cache {
  get<T>(key: string): Promise<T | undefined>
  set<T>(key: string, data: T, opts?: SetOptions): Promise<void>
  getOrSet<T>(
    key: string,
    ttl: number | string,
    factory: () => Promise<T>,
    opts?: GetOrSetOptions,
  ): Promise<T>
  del(key: string): Promise<void>
  invalidateTag(tag: string): Promise<void>
  stats(): Snapshot
}

export function createCache(opts: CreateCacheOptions): Cache {
  const {
    backend,
    l1,
    coalesce = true,
    swr = true,
    grace,
    stats: enableStats = false,
    ctx,
    now = Date.now,
  } = opts

  const graceMs = grace != null ? parseTtl(grace) : 0
  const inflight = new Map<string, Promise<unknown>>()
  let hits = 0
  let misses = 0
  let errors = 0

  async function isTagInvalidated(
    entry: CacheEntry,
    store: CacheBackend,
  ): Promise<boolean> {
    for (const tag of entry.tags) {
      const at = await store.getTagInvalidatedAt(tag)
      if (at != null && at > entry.createdAt) return true
    }
    return false
  }

  async function readFresh<T>(key: string): Promise<CacheEntry<T> | undefined> {
    const entry = await readAny<T>(key)
    if (entry && !isStale(entry)) return entry
    return undefined
  }

  async function readAny<T>(key: string): Promise<CacheEntry<T> | undefined> {
    if (l1) {
      try {
        const entry = await l1.get<T>(key)
        if (entry && !(await isTagInvalidated(entry, backend))) {
          if (!isStale(entry)) return entry
        }
      } catch { /* L1 failure → fall through */ }
    }

    const entry = await backend.get<T>(key)
    if (!entry) return undefined

    if (await isTagInvalidated(entry, backend)) return undefined

    if (!isStale(entry) && l1) l1.set(key, entry).catch(() => {})
    return entry
  }

  function isStale(entry: CacheEntry): boolean {
    return now() >= entry.expiresAt
  }

  async function writeThrough<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    await backend.set(key, entry)
    if (l1) l1.set(key, entry).catch(() => {})
  }

  function buildEntry<T>(data: T, ttlMs: number, tags: string[]): CacheEntry<T> {
    const t = now()
    return { data, tags, createdAt: t, expiresAt: t + ttlMs }
  }

  async function get<T>(key: string): Promise<T | undefined> {
    const entry = await readFresh<T>(key)
    if (entry) {
      if (enableStats) hits++
      return entry.data
    }
    if (enableStats) misses++
    return undefined
  }

  async function set<T>(key: string, data: T, setOpts?: SetOptions): Promise<void> {
    const ttlMs = setOpts?.ttl != null ? parseTtl(setOpts.ttl) : 3_600_000
    const entry = buildEntry(data, ttlMs, setOpts?.tags ?? [])
    await writeThrough(key, entry)
  }

  async function getOrSet<T>(
    key: string,
    ttl: number | string,
    factory: () => Promise<T>,
    getOpts?: GetOrSetOptions,
  ): Promise<T> {
    // coalescing: return in-flight promise if exists
    if (coalesce && inflight.has(key)) {
      if (enableStats) hits++
      return inflight.get(key) as Promise<T>
    }

    const doWork = async (): Promise<T> => {
      const existing = await readAny<T>(key)

      if (existing && !isStale(existing)) {
        if (enableStats) hits++
        return existing.data
      }

      // SWR: return stale immediately, revalidate in background
      if (existing && isStale(existing) && swr && ctx) {
        if (enableStats) hits++
        const ttlMs = parseTtl(ttl)
        const tags = getOpts?.tags ?? existing.tags
        ctx.waitUntil(
          factory()
            .then((data) => writeThrough(key, buildEntry(data, ttlMs, tags)))
            .catch(() => {
              if (enableStats) errors++
            }),
        )
        return existing.data
      }

      // Run factory
      if (enableStats) misses++
      try {
        const data = await factory()
        const ttlMs = parseTtl(ttl)
        const entry = buildEntry(data, ttlMs, getOpts?.tags ?? [])
        await writeThrough(key, entry)
        return data
      } catch (err) {
        if (enableStats) errors++
        // Grace: serve stale on factory failure if within grace window
        if (existing && graceMs > 0 && now() < existing.expiresAt + graceMs) {
          return existing.data
        }
        throw err
      }
    }

    if (coalesce) {
      const promise = doWork().finally(() => inflight.delete(key))
      inflight.set(key, promise)
      return promise
    }

    return doWork()
  }

  async function del(key: string): Promise<void> {
    await backend.del(key)
    if (l1) l1.del(key).catch(() => {})
  }

  async function invalidateTag(tag: string): Promise<void> {
    const t = now()
    await backend.invalidateTag(tag, t)
    if (l1) l1.invalidateTag(tag, t).catch(() => {})
  }

  function stats(): Snapshot {
    const total = hits + misses
    return {
      hits,
      misses,
      errors,
      hitRate: total > 0 ? hits / total : 0,
    }
  }

  return { get, set, getOrSet, del, invalidateTag, stats }
}

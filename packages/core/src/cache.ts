import type { CacheBackend } from "./types.js"

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
  stats?(): Snapshot
}

export function createCache(_opts: CreateCacheOptions): Cache {
  throw new Error("createCache: not implemented")
}

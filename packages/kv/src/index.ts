import type { CacheBackend, CacheEntry } from "tagcache"

export interface KvBackendOptions {
  namespace: KVNamespace
  keyPrefix?: string
  tagPrefix?: string
}

export function kvBackend(opts: KvBackendOptions): CacheBackend {
  const { namespace: kv } = opts
  const keyPrefix = opts.keyPrefix ?? ""
  const tagPrefix = opts.tagPrefix ?? "tag:"

  function k(key: string): string {
    return keyPrefix + key
  }

  return {
    name: "kv",

    async get<T>(key: string): Promise<CacheEntry<T> | undefined> {
      const raw = await kv.get(k(key), "text")
      if (raw == null) return undefined
      return JSON.parse(raw) as CacheEntry<T>
    },

    async set<T>(key: string, entry: CacheEntry<T>): Promise<void> {
      const ttlSec = Math.max(60, Math.ceil((entry.expiresAt - Date.now()) / 1000))
      await kv.put(k(key), JSON.stringify(entry), { expirationTtl: ttlSec })
    },

    async del(key: string): Promise<void> {
      await kv.delete(k(key))
    },

    async invalidateTag(tag: string, at: number): Promise<void> {
      await kv.put(tagPrefix + tag, String(at))
    },

    async getTagInvalidatedAt(tag: string): Promise<number | undefined> {
      const raw = await kv.get(tagPrefix + tag, "text")
      if (raw == null) return undefined
      return Number(raw)
    },
  }
}

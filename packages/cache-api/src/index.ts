import type { CacheBackend, CacheEntry } from "tagcache"

export interface CacheApiBackendOptions {
  cache?: Cache
  keyPrefix?: string
}

const PREFIX = "https://tagcache.local/"

export function cacheApi(opts?: CacheApiBackendOptions): CacheBackend {
  const prefix = opts?.keyPrefix ?? ""
  let cacheStore: Cache | undefined = opts?.cache

  async function getCache(): Promise<Cache> {
    if (cacheStore) return cacheStore
    cacheStore = await caches.open("tagcache")
    return cacheStore
  }

  function url(key: string): string {
    return PREFIX + prefix + key
  }

  return {
    name: "cache-api",

    async get<T>(key: string): Promise<CacheEntry<T> | undefined> {
      const c = await getCache()
      const res = await c.match(url(key))
      if (!res) return undefined
      return res.json() as Promise<CacheEntry<T>>
    },

    async set<T>(key: string, entry: CacheEntry<T>): Promise<void> {
      const c = await getCache()
      const ttlSec = Math.max(1, Math.ceil((entry.expiresAt - Date.now()) / 1000))
      const res = new Response(JSON.stringify(entry), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": `max-age=${ttlSec}`,
        },
      })
      await c.put(url(key), res)
    },

    async del(key: string): Promise<void> {
      const c = await getCache()
      await c.delete(url(key))
    },

    async invalidateTag(tag: string, at: number): Promise<void> {
      const c = await getCache()
      const res = new Response(JSON.stringify(at), {
        headers: { "Content-Type": "application/json" },
      })
      await c.put(url(`__tag:${tag}`), res)
    },

    async getTagInvalidatedAt(tag: string): Promise<number | undefined> {
      const c = await getCache()
      const res = await c.match(url(`__tag:${tag}`))
      if (!res) return undefined
      return res.json() as Promise<number>
    },
  }
}

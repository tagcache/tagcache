import type { CacheBackend, CacheEntry } from "../types.js"

export function createMockBackend(label = "mock"): CacheBackend & {
  store: Map<string, CacheEntry>
  tags: Map<string, number>
} {
  const store = new Map<string, CacheEntry>()
  const tags = new Map<string, number>()

  return {
    name: label,
    store,
    tags,
    async get<T>(key: string) {
      return store.get(key) as CacheEntry<T> | undefined
    },
    async set<T>(key: string, entry: CacheEntry<T>) {
      store.set(key, entry as CacheEntry)
    },
    async del(key: string) {
      store.delete(key)
    },
    async invalidateTag(tag: string, at: number) {
      tags.set(tag, at)
    },
    async getTagInvalidatedAt(tag: string) {
      return tags.get(tag)
    },
  }
}

export function createMockCtx(): {
  waitUntil: (p: Promise<unknown>) => void
  flush: () => Promise<void>
} {
  const promises: Promise<unknown>[] = []
  return {
    waitUntil(p: Promise<unknown>) {
      promises.push(p)
    },
    async flush() {
      await Promise.allSettled(promises)
      promises.length = 0
    },
  }
}

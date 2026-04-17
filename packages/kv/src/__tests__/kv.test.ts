import { describe, it, expect, beforeEach } from "vitest"
import { kvBackend } from "../index.js"
import type { CacheEntry } from "tagcache"

function createMockKV(): KVNamespace {
  const store = new Map<string, string>()
  return {
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => { store.set(key, value) },
    delete: async (key: string) => { store.delete(key) },
    list: async () => ({ keys: [], list_complete: true, cacheStatus: null }),
    getWithMetadata: async () => ({ value: null, metadata: null, cacheStatus: null }),
  } as unknown as KVNamespace
}

function entry<T>(data: T, tags: string[] = []): CacheEntry<T> {
  return { data, tags, createdAt: 1000, expiresAt: 1000 + 3_600_000 }
}

describe("kvBackend", () => {
  let kv: KVNamespace
  let backend: ReturnType<typeof kvBackend>

  beforeEach(() => {
    kv = createMockKV()
    backend = kvBackend({ namespace: kv })
  })

  it("has correct name", () => {
    expect(backend.name).toBe("kv")
  })

  it("returns undefined for missing key", async () => {
    expect(await backend.get("x")).toBeUndefined()
  })

  it("round-trips an entry", async () => {
    const e = entry("hello", ["t1"])
    await backend.set("k", e)
    const got = await backend.get("k")
    expect(got).toEqual(e)
  })

  it("deletes a key", async () => {
    await backend.set("k", entry("v"))
    await backend.del("k")
    expect(await backend.get("k")).toBeUndefined()
  })

  it("stores and retrieves tag invalidation timestamp", async () => {
    await backend.invalidateTag("user:1", 5000)
    expect(await backend.getTagInvalidatedAt("user:1")).toBe(5000)
  })

  it("returns undefined for unknown tag", async () => {
    expect(await backend.getTagInvalidatedAt("nope")).toBeUndefined()
  })

  it("supports keyPrefix", async () => {
    const b = kvBackend({ namespace: kv, keyPrefix: "app:" })
    await b.set("k", entry("v"))
    expect(await b.get("k")).toEqual(entry("v"))
  })
})

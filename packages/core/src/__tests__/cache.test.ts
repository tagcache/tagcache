import { describe, it, expect, vi, beforeEach } from "vitest"
import { createCache } from "../cache.js"
import { createMockBackend, createMockCtx } from "./helpers.js"

describe("createCache", () => {
  let backend: ReturnType<typeof createMockBackend>
  let clock: number

  beforeEach(() => {
    backend = createMockBackend()
    clock = 1000
  })

  function make(overrides: Parameters<typeof createCache>[0] extends infer T ? Partial<T> : never = {}) {
    return createCache({
      backend,
      now: () => clock,
      ...overrides,
    })
  }

  describe("get / set / del", () => {
    it("returns undefined for missing key", async () => {
      const cache = make()
      expect(await cache.get("x")).toBeUndefined()
    })

    it("sets and gets a value", async () => {
      const cache = make()
      await cache.set("k", "v", { ttl: "1h" })
      expect(await cache.get("k")).toBe("v")
    })

    it("respects TTL — expired entry returns undefined", async () => {
      const cache = make()
      await cache.set("k", "v", { ttl: "1s" })
      clock += 2000
      expect(await cache.get("k")).toBeUndefined()
    })

    it("deletes a key", async () => {
      const cache = make()
      await cache.set("k", "v", { ttl: "1h" })
      await cache.del("k")
      expect(await cache.get("k")).toBeUndefined()
    })

    it("uses default TTL of 1h when not specified", async () => {
      const cache = make()
      await cache.set("k", "v")
      clock += 3_600_001
      expect(await cache.get("k")).toBeUndefined()
    })
  })

  describe("getOrSet", () => {
    it("runs factory on miss", async () => {
      const cache = make()
      const factory = vi.fn().mockResolvedValue("data")
      const result = await cache.getOrSet("k", "1h", factory)
      expect(result).toBe("data")
      expect(factory).toHaveBeenCalledOnce()
    })

    it("returns cached value without calling factory", async () => {
      const cache = make()
      const factory = vi.fn().mockResolvedValue("data")
      await cache.getOrSet("k", "1h", factory)
      const result = await cache.getOrSet("k", "1h", factory)
      expect(result).toBe("data")
      expect(factory).toHaveBeenCalledOnce()
    })

    it("re-runs factory after TTL expires (no SWR, no grace)", async () => {
      const cache = make({ swr: false })
      await cache.getOrSet("k", "1s", async () => "v1")
      clock += 2000
      const result = await cache.getOrSet("k", "1s", async () => "v2")
      expect(result).toBe("v2")
    })

    it("stores tags on entry", async () => {
      const cache = make()
      await cache.getOrSet("k", "1h", async () => "data", { tags: ["user:1"] })
      expect(backend.store.get("k")!.tags).toEqual(["user:1"])
    })
  })

  describe("tag invalidation", () => {
    it("invalidates entries by tag", async () => {
      const cache = make()
      await cache.set("k", "v", { ttl: "1h", tags: ["t1"] })
      clock += 1
      await cache.invalidateTag("t1")
      expect(await cache.get("k")).toBeUndefined()
    })

    it("does not invalidate entries with different tags", async () => {
      const cache = make()
      await cache.set("k", "v", { ttl: "1h", tags: ["t1"] })
      await cache.invalidateTag("t2")
      expect(await cache.get("k")).toBe("v")
    })

    it("invalidates getOrSet results", async () => {
      const cache = make({ swr: false })
      await cache.getOrSet("k", "1h", async () => "v1", { tags: ["t1"] })
      clock += 1
      await cache.invalidateTag("t1")
      const result = await cache.getOrSet("k", "1h", async () => "v2", { tags: ["t1"] })
      expect(result).toBe("v2")
    })
  })

  describe("request coalescing", () => {
    it("deduplicates concurrent calls to same key", async () => {
      const cache = make()
      let calls = 0
      const factory = () => new Promise<string>((r) => setTimeout(() => r(`v${++calls}`), 10))
      const [a, b, c] = await Promise.all([
        cache.getOrSet("k", "1h", factory),
        cache.getOrSet("k", "1h", factory),
        cache.getOrSet("k", "1h", factory),
      ])
      expect(calls).toBe(1)
      expect(a).toBe(b)
      expect(b).toBe(c)
    })

    it("does not coalesce different keys", async () => {
      const cache = make()
      let calls = 0
      const factory = () => Promise.resolve(`v${++calls}`)
      const [a, b] = await Promise.all([
        cache.getOrSet("k1", "1h", factory),
        cache.getOrSet("k2", "1h", factory),
      ])
      expect(calls).toBe(2)
      expect(a).not.toBe(b)
    })

    it("can be disabled", async () => {
      const cache = make({ coalesce: false })
      let calls = 0
      const factory = () => new Promise<string>((r) => setTimeout(() => r(`v${++calls}`), 10))
      await Promise.all([
        cache.getOrSet("k", "1h", factory),
        cache.getOrSet("k", "1h", factory),
      ])
      expect(calls).toBe(2)
    })
  })

  describe("stale-while-revalidate", () => {
    it("returns stale data and revalidates in background", async () => {
      const ctx = createMockCtx()
      const cache = make({ swr: true, ctx })
      await cache.getOrSet("k", "1s", async () => "v1")
      clock += 2000
      const result = await cache.getOrSet("k", "1s", async () => "v2")
      expect(result).toBe("v1") // stale
      await ctx.flush()
      const fresh = await cache.getOrSet("k", "1s", async () => "v3")
      expect(fresh).toBe("v2") // revalidated
    })

    it("falls back to synchronous factory without ctx", async () => {
      const cache = make({ swr: true }) // no ctx
      await cache.getOrSet("k", "1s", async () => "v1")
      clock += 2000
      const result = await cache.getOrSet("k", "1s", async () => "v2")
      expect(result).toBe("v2") // ran synchronously
    })
  })

  describe("grace period", () => {
    it("serves stale data when factory fails within grace window", async () => {
      const cache = make({ swr: false, grace: "1h" })
      await cache.getOrSet("k", "1s", async () => "v1")
      clock += 2000 // expired but within 1h grace
      const result = await cache.getOrSet("k", "1s", async () => {
        throw new Error("factory failed")
      })
      expect(result).toBe("v1")
    })

    it("throws when factory fails and no stale data within grace", async () => {
      const cache = make({ swr: false, grace: "1s" })
      await cache.getOrSet("k", "1s", async () => "v1")
      clock += 3_600_000 // way past grace
      await expect(
        cache.getOrSet("k", "1s", async () => {
          throw new Error("fail")
        }),
      ).rejects.toThrow("fail")
    })

    it("throws when factory fails and no grace configured", async () => {
      const cache = make({ swr: false })
      await expect(
        cache.getOrSet("k", "1s", async () => {
          throw new Error("fail")
        }),
      ).rejects.toThrow("fail")
    })
  })

  describe("multi-tier (L1 + backend)", () => {
    it("writes to both tiers", async () => {
      const l1 = createMockBackend("l1")
      const cache = make({ l1 })
      await cache.set("k", "v", { ttl: "1h" })
      expect(l1.store.has("k")).toBe(true)
      expect(backend.store.has("k")).toBe(true)
    })

    it("reads from L1 first", async () => {
      const l1 = createMockBackend("l1")
      const cache = make({ l1 })
      await cache.set("k", "v", { ttl: "1h" })
      backend.store.delete("k") // simulate L1 hit, backend miss
      expect(await cache.get("k")).toBe("v")
    })

    it("falls back to backend on L1 miss", async () => {
      const l1 = createMockBackend("l1")
      const cache = make({ l1 })
      await cache.set("k", "v", { ttl: "1h" })
      l1.store.delete("k")
      expect(await cache.get("k")).toBe("v")
    })

    it("populates L1 on backend hit", async () => {
      const l1 = createMockBackend("l1")
      const cache = make({ l1 })
      await cache.set("k", "v", { ttl: "1h" })
      l1.store.delete("k")
      await cache.get("k") // backend hit → should populate L1
      expect(l1.store.has("k")).toBe(true)
    })

    it("survives L1 errors", async () => {
      const l1 = createMockBackend("l1")
      l1.get = async () => { throw new Error("L1 down") }
      const cache = make({ l1 })
      await cache.set("k", "v", { ttl: "1h" })
      expect(await cache.get("k")).toBe("v") // falls back to backend
    })

    it("invalidates tags in both tiers", async () => {
      const l1 = createMockBackend("l1")
      const cache = make({ l1 })
      await cache.invalidateTag("t1")
      expect(backend.tags.has("t1")).toBe(true)
      expect(l1.tags.has("t1")).toBe(true)
    })

    it("deletes from both tiers", async () => {
      const l1 = createMockBackend("l1")
      const cache = make({ l1 })
      await cache.set("k", "v", { ttl: "1h" })
      await cache.del("k")
      expect(l1.store.has("k")).toBe(false)
      expect(backend.store.has("k")).toBe(false)
    })
  })

  describe("stats", () => {
    it("tracks hits and misses", async () => {
      const cache = make({ stats: true })
      await cache.set("k", "v", { ttl: "1h" })
      await cache.get("k") // hit
      await cache.get("miss") // miss
      const s = cache.stats()
      expect(s.hits).toBe(1)
      expect(s.misses).toBe(1)
      expect(s.hitRate).toBe(0.5)
    })

    it("tracks errors", async () => {
      const cache = make({ stats: true, swr: false })
      await expect(
        cache.getOrSet("k", "1s", async () => { throw new Error("x") }),
      ).rejects.toThrow()
      expect(cache.stats().errors).toBe(1)
    })

    it("returns zero hitRate when no operations", () => {
      const cache = make({ stats: true })
      expect(cache.stats().hitRate).toBe(0)
    })

    it("does not track when stats disabled", async () => {
      const cache = make({ stats: false })
      await cache.set("k", "v", { ttl: "1h" })
      await cache.get("k")
      const s = cache.stats()
      expect(s.hits).toBe(0)
      expect(s.misses).toBe(0)
    })
  })
})

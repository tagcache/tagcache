import { describe, it, expect, beforeEach } from "vitest"
import { d1Backend, migrations } from "../index.js"
import type { CacheEntry } from "tagcache"
import Database from "better-sqlite3"

function createMockD1(): D1Database {
  const db = new Database(":memory:")
  for (const sql of migrations) {
    db.exec(sql)
  }

  return {
    prepare(query: string) {
      const bindings: unknown[] = []
      return {
        bind(...args: unknown[]) {
          bindings.push(...args)
          return this
        },
        async first<T>(): Promise<T | null> {
          const stmt = db.prepare(query)
          return (stmt.get(...bindings) as T) ?? null
        },
        async run() {
          const stmt = db.prepare(query)
          stmt.run(...bindings)
          return { success: true, results: [], meta: {} }
        },
        async all() {
          const stmt = db.prepare(query)
          return { results: stmt.all(...bindings), success: true, meta: {} }
        },
      }
    },
    async exec(query: string) {
      db.exec(query)
      return { count: 0, duration: 0 }
    },
    async batch() {
      return []
    },
    async dump() {
      return new ArrayBuffer(0)
    },
  } as unknown as D1Database
}

function entry<T>(data: T, tags: string[] = []): CacheEntry<T> {
  return { data, tags, createdAt: 1000, expiresAt: 1000 + 3_600_000 }
}

describe("d1Backend", () => {
  let backend: ReturnType<typeof d1Backend>

  beforeEach(() => {
    const db = createMockD1()
    backend = d1Backend({ db })
  })

  it("has correct name", () => {
    expect(backend.name).toBe("d1")
  })

  it("returns undefined for missing key", async () => {
    expect(await backend.get("x")).toBeUndefined()
  })

  it("round-trips an entry", async () => {
    const e = entry({ user: "alice" }, ["user:1"])
    await backend.set("k", e)
    const got = await backend.get("k")
    expect(got).toEqual(e)
  })

  it("overwrites existing entry", async () => {
    await backend.set("k", entry("v1"))
    await backend.set("k", entry("v2"))
    const got = await backend.get("k")
    expect(got!.data).toBe("v2")
  })

  it("deletes a key", async () => {
    await backend.set("k", entry("v"))
    await backend.del("k")
    expect(await backend.get("k")).toBeUndefined()
  })

  it("stores and retrieves tag invalidation timestamp", async () => {
    await backend.invalidateTag("t1", 5000)
    expect(await backend.getTagInvalidatedAt("t1")).toBe(5000)
  })

  it("returns undefined for unknown tag", async () => {
    expect(await backend.getTagInvalidatedAt("nope")).toBeUndefined()
  })

  it("updates tag timestamp on re-invalidation", async () => {
    await backend.invalidateTag("t1", 1000)
    await backend.invalidateTag("t1", 2000)
    expect(await backend.getTagInvalidatedAt("t1")).toBe(2000)
  })
})

describe("migrations", () => {
  it("exports 3 SQL statements", () => {
    expect(migrations).toHaveLength(3)
    expect(migrations[0]).toContain("tagcache_entries")
    expect(migrations[1]).toContain("INDEX")
    expect(migrations[2]).toContain("tagcache_tags")
  })
})

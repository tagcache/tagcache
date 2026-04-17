import type { CacheBackend, CacheEntry } from "tagcache"

export interface D1BackendOptions {
  db: D1Database
  tableName?: string
}

export function d1Backend(opts: D1BackendOptions): CacheBackend {
  const { db } = opts
  const table = opts.tableName ?? "tagcache_entries"
  const tagTable = opts.tableName ? `${opts.tableName}_tags` : "tagcache_tags"

  return {
    name: "d1",

    async get<T>(key: string): Promise<CacheEntry<T> | undefined> {
      const row = await db
        .prepare(`SELECT data, tags, created_at, expires_at FROM ${table} WHERE key = ?`)
        .bind(key)
        .first<{ data: string; tags: string; created_at: number; expires_at: number }>()
      if (!row) return undefined
      return {
        data: JSON.parse(row.data) as T,
        tags: JSON.parse(row.tags) as string[],
        createdAt: row.created_at,
        expiresAt: row.expires_at,
      }
    },

    async set<T>(key: string, entry: CacheEntry<T>): Promise<void> {
      await db
        .prepare(
          `INSERT OR REPLACE INTO ${table} (key, data, tags, created_at, expires_at) VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(
          key,
          JSON.stringify(entry.data),
          JSON.stringify(entry.tags),
          entry.createdAt,
          entry.expiresAt,
        )
        .run()
    },

    async del(key: string): Promise<void> {
      await db.prepare(`DELETE FROM ${table} WHERE key = ?`).bind(key).run()
    },

    async invalidateTag(tag: string, at: number): Promise<void> {
      await db
        .prepare(
          `INSERT OR REPLACE INTO ${tagTable} (tag, invalidated_at) VALUES (?, ?)`,
        )
        .bind(tag, at)
        .run()
    },

    async getTagInvalidatedAt(tag: string): Promise<number | undefined> {
      const row = await db
        .prepare(`SELECT invalidated_at FROM ${tagTable} WHERE tag = ?`)
        .bind(tag)
        .first<{ invalidated_at: number }>()
      return row?.invalidated_at
    },
  }
}

export const migrations: string[] = [
  "CREATE TABLE IF NOT EXISTS tagcache_entries (key TEXT PRIMARY KEY, data TEXT NOT NULL, tags TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL);",
  "CREATE INDEX IF NOT EXISTS tagcache_entries_expires_at_idx ON tagcache_entries (expires_at);",
  "CREATE TABLE IF NOT EXISTS tagcache_tags (tag TEXT PRIMARY KEY, invalidated_at INTEGER NOT NULL);",
]

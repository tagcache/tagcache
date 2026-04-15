import type { CacheBackend } from "tagcache"

export interface D1BackendOptions {
  db: D1Database
  tableName?: string
}

export function d1Backend(_opts: D1BackendOptions): CacheBackend {
  throw new Error("d1Backend: not implemented")
}

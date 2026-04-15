import type { CacheBackend } from "tagcache"

export interface CacheApiBackendOptions {
  cache?: Cache
  keyPrefix?: string
}

export function cacheApi(_opts?: CacheApiBackendOptions): CacheBackend {
  throw new Error("cacheApi: not implemented")
}

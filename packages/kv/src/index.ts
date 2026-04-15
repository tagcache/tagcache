import type { CacheBackend } from "tagcache"

export interface KvBackendOptions {
  namespace: KVNamespace
  keyPrefix?: string
  tagPrefix?: string
}

export function kvBackend(_opts: KvBackendOptions): CacheBackend {
  throw new Error("kvBackend: not implemented")
}

export interface CacheEntry<T = unknown> {
  data: T
  tags: string[]
  createdAt: number
  expiresAt: number
}

export interface CacheBackend {
  readonly name: string
  get<T>(key: string): Promise<CacheEntry<T> | undefined>
  set<T>(key: string, entry: CacheEntry<T>): Promise<void>
  del(key: string): Promise<void>
  invalidateTag(tag: string, at: number): Promise<void>
  getTagInvalidatedAt(tag: string): Promise<number | undefined>
}

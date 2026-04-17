import { createCache } from "tagcache"
import { kvBackend } from "@tagcache/kv"

interface Env {
  CACHE_KV: KVNamespace
}

async function bench(
  name: string,
  fn: () => Promise<void>,
  iterations = 100,
): Promise<{ name: string; avg: number; p50: number; p95: number }> {
  const times: number[] = []
  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    await fn()
    times.push(performance.now() - start)
  }
  times.sort((a, b) => a - b)
  return {
    name,
    avg: times.reduce((a, b) => a + b, 0) / times.length,
    p50: times[Math.floor(times.length * 0.5)]!,
    p95: times[Math.floor(times.length * 0.95)]!,
  }
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const cache = createCache({
      backend: kvBackend({ namespace: env.CACHE_KV }),
      ctx,
      stats: true,
    })

    let counter = 0
    const factory = async () => {
      await new Promise((r) => setTimeout(r, 5))
      return { value: ++counter, ts: Date.now() }
    }

    const results = []

    // Cold miss
    results.push(
      await bench("cold miss + factory", async () => {
        await cache.getOrSet(`bench:cold:${Math.random()}`, "1h", factory)
      }, 20),
    )

    // Warm hit
    await cache.set("bench:warm", { value: "warm" }, { ttl: "1h" })
    results.push(
      await bench("warm hit", async () => {
        await cache.get("bench:warm")
      }),
    )

    // getOrSet hit
    await cache.getOrSet("bench:gos", "1h", factory)
    results.push(
      await bench("getOrSet hit", async () => {
        await cache.getOrSet("bench:gos", "1h", factory)
      }),
    )

    // Coalescing
    results.push(
      await bench("coalesced 10x", async () => {
        const key = `bench:coal:${Math.random()}`
        await Promise.all(
          Array.from({ length: 10 }, () => cache.getOrSet(key, "1h", factory)),
        )
      }, 20),
    )

    const stats = cache.stats()

    return Response.json({
      results: results.map((r) => ({
        ...r,
        avg: `${r.avg.toFixed(3)}ms`,
        p50: `${r.p50.toFixed(3)}ms`,
        p95: `${r.p95.toFixed(3)}ms`,
      })),
      stats,
    }, {
      headers: { "Content-Type": "application/json" },
    })
  },
}

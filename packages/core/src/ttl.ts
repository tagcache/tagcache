export const TTL = {
  minutes: "10m",
  hours: "1h",
  days: "1d",
} as const

export function parseTtl(input: number | string): number {
  if (typeof input === "number") return input * 1000
  const match = /^(\d+)(ms|s|m|h|d)$/.exec(input)
  if (!match) throw new Error(`invalid ttl: ${input}`)
  const n = Number(match[1])
  switch (match[2]) {
    case "ms": return n
    case "s": return n * 1000
    case "m": return n * 60_000
    case "h": return n * 3_600_000
    case "d": return n * 86_400_000
  }
  throw new Error(`invalid ttl unit: ${input}`)
}

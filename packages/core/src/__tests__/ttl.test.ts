import { describe, it, expect } from "vitest"
import { parseTtl, TTL } from "../ttl.js"

describe("parseTtl", () => {
  it("converts seconds to ms", () => {
    expect(parseTtl(60)).toBe(60_000)
    expect(parseTtl(0)).toBe(0)
  })

  it("parses ms", () => expect(parseTtl("500ms")).toBe(500))
  it("parses s", () => expect(parseTtl("30s")).toBe(30_000))
  it("parses m", () => expect(parseTtl("10m")).toBe(600_000))
  it("parses h", () => expect(parseTtl("1h")).toBe(3_600_000))
  it("parses d", () => expect(parseTtl("1d")).toBe(86_400_000))

  it("throws on invalid format", () => {
    expect(() => parseTtl("abc")).toThrow("invalid ttl")
    expect(() => parseTtl("10x")).toThrow("invalid ttl")
    expect(() => parseTtl("")).toThrow("invalid ttl")
  })
})

describe("TTL presets", () => {
  it("has correct values", () => {
    expect(TTL.minutes).toBe("10m")
    expect(TTL.hours).toBe("1h")
    expect(TTL.days).toBe("1d")
  })
})

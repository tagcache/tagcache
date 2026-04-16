import { defineConfig, type Options } from "tsup"

export const baseConfig: Options = {
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: "es2022",
  minify: false,
  splitting: false,
}

export default defineConfig(baseConfig)

// Size budget, checked in CI: under 40 KB of JavaScript,
// minified, with react and react-native left out.
import { build } from "esbuild"

const BUDGET = 40 * 1024
const result = await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  minify: true,
  format: "esm",
  target: "es2020",
  platform: "neutral",
  external: ["react", "react-native", "react/jsx-runtime"],
  jsx: "automatic",
  write: false,
  logLevel: "warning"
})
const size = result.outputFiles[0].contents.length
const over = size > BUDGET
console.log(`${over ? "OVER" : "ok  "} checkout ${(size / 1024).toFixed(1)} KB of ${(BUDGET / 1024).toFixed(0)} KB minified`)
process.exit(over ? 1 : 0)

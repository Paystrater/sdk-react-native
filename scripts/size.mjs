// Size budget, checked in CI: under 50 KB of JavaScript,
// minified, with react and react-native left out. Raised from 40 KB for the
// design shared with the web (method tiles, the back row, Powered by), then to
// 46 KB for Copy (clipboard, copy amount, the "Copied" state), then to 50 KB
// for the "How to connect your AI agent" guide; the brand
// images and the optional clipboard loader are separate files and do not count.
import { build } from "esbuild"

const BUDGET = 50 * 1024
const result = await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  minify: true,
  format: "esm",
  target: "es2020",
  platform: "neutral",
  // Brand images are asset files, not JavaScript
  external: ["react", "react-native", "react/jsx-runtime", "./assets/*", "./optional/*"],
  jsx: "automatic",
  write: false,
  logLevel: "warning"
})
const size = result.outputFiles[0].contents.length
const over = size > BUDGET
console.log(`${over ? "OVER" : "ok  "} checkout ${(size / 1024).toFixed(1)} KB of ${(BUDGET / 1024).toFixed(0)} KB minified`)
process.exit(over ? 1 : 0)

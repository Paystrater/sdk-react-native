// Builds dist/: ES modules for Metro and Expo, CommonJS,
// and TypeScript types. The shared core is bundled in, so merchants install
// one package; react and react-native stay peers.
import { build } from "esbuild"
import { execFileSync } from "node:child_process"
import { cpSync, readFileSync, rmSync, writeFileSync } from "node:fs"

const pkg = JSON.parse(readFileSync("package.json", "utf8"))
rmSync("dist", { recursive: true, force: true })
const shared = {
  entryPoints: { index: "src/index.ts" },
  bundle: true,
  platform: "neutral",
  // BigInt literals (wallet links) need ES2020; Hermes has had BigInt since React Native 0.70
  target: "es2020",
  // The brand images stay files next to the code, for Metro to bundle as assets,
  // and the optional clipboard loader stays a file so Metro sees its requires
  external: ["react", "react-native", "react/jsx-runtime", "./assets/*", "./optional/*"],
  jsx: "automatic",
  define: { __SDK_VERSION__: JSON.stringify(pkg.version) },
  sourcemap: true,
  logLevel: "warning"
}
await build({ ...shared, format: "esm", outdir: "dist/esm" })
await build({ ...shared, format: "cjs", outdir: "dist/cjs" })
for (const dir of ["dist/esm/assets", "dist/cjs/assets"]) cpSync("src/assets", dir, { recursive: true })
// The optional clipboard loader ships unbundled, so Metro sees its requires (src/optional/clipboard.js)
for (const dir of ["dist/esm/optional", "dist/cjs/optional"]) cpSync("src/optional", dir, { recursive: true })
execFileSync("node_modules/.bin/tsc", ["-p", "tsconfig.build.json", "--outDir", "dist/esm/types"], { stdio: "inherit" })
cpSync("dist/esm/types", "dist/cjs/types", { recursive: true })
writeFileSync("dist/cjs/package.json", JSON.stringify({ type: "commonjs" }, null, 2) + "\n")
console.log(`Built ${pkg.name}@${pkg.version}`)

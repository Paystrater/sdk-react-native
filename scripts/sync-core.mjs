// The React Native package runs the same core as @paystrater/react:
// the client, the checkout flow and polling, errors, theme tokens.
// This copies those files from ../sdk-react/src/core into src/core, so the two
// packages never drift. `--check` fails when the copy differs. The encryption
// files are left out: the mobile SDKs do not encrypt in v1.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"

const source = process.env.SDK_REACT_CORE ?? "../sdk-react/src/core"
const target = "src/core"
const LEAVE_OUT = new Set(["encryption.ts", "encryptor.ts", "encryptionConfig.ts", "index.ts"])
const HEADER = "// Copied from @paystrater/react (sdk-react/src/core) by scripts/sync-core.mjs. Do not edit here.\n"

if (!existsSync(source)) {
  console.error(`No core at ${source}. Check out sdk-react beside this folder, or set SDK_REACT_CORE.`)
  process.exit(1)
}

const files = []
const walk = (dir, rel = "") => {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const path = join(rel, name.name)
    if (name.isDirectory()) walk(join(dir, name.name), path)
    else if (name.name.endsWith(".ts") && !LEAVE_OUT.has(path)) files.push(path)
  }
}
walk(source)

const check = process.argv.includes("--check")
const stale = []
for (const file of files) {
  const want = HEADER + readFileSync(join(source, file), "utf8")
  const path = join(target, file)
  const have = existsSync(path) ? readFileSync(path, "utf8") : ""
  if (have === want) continue
  if (check) stale.push(file)
  else {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, want)
  }
}
if (!check) {
  // Drop files the core no longer has
  const keep = new Set(files.map((f) => join(target, f)))
  const sweep = (dir) => {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, name.name)
      if (name.isDirectory()) sweep(path)
      else if (!keep.has(path)) rmSync(path)
    }
  }
  if (existsSync(target)) sweep(target)
}
if (stale.length) {
  console.error(`src/core differs from ${source}: ${stale.join(", ")}. Run npm run sync-core.`)
  process.exit(1)
}
console.log(check ? "ok   src/core matches @paystrater/react's core" : `copied ${files.length} core files from ${source}`)

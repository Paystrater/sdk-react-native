import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    // react-native's own entry needs Metro; tests render through a small stand-in on react-dom
    alias: { "react-native": fileURLToPath(new URL("./test/react-native.tsx", import.meta.url)) }
  },
  test: {
    include: ["test/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    setupFiles: ["test/setup.ts"],
    restoreMocks: true
  }
})

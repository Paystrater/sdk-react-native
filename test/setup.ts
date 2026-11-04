import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"
import { reset } from "./react-native.js"

afterEach(() => {
  cleanup()
  reset()
})

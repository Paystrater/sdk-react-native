// The clipboard left React Native core, and this package adds no dependencies.
// So Copy uses a clipboard module the app already has: expo-clipboard, then
// @react-native-clipboard/clipboard, then the clipboard React Native still ships
// in core (deprecated, but present on every version this SDK supports; read
// from its own file, which skips the "moved" warning of the react-native
// export). Each require sits in a try block, which
// Metro treats as optional: a missing package is left out of the bundle and
// the require throws here instead of failing the build. With neither, the
// checkout offers Share instead of Copy.
//
// This file is shipped as it is, next to the bundle (scripts/build.mjs), so
// Metro sees the literal require calls.

let setter
let looked = false

/** A function that copies text, or undefined when the app has no clipboard module */
export function clipboardSetter() {
  if (looked) return setter
  looked = true
  try {
    const expo = require("expo-clipboard")
    if (expo && typeof expo.setStringAsync === "function") {
      setter = (text) => expo.setStringAsync(text)
      return setter
    }
  } catch {
    // Not installed, or its native module is missing
  }
  try {
    const community = require("@react-native-clipboard/clipboard")
    const clipboard = community && (community.default || community)
    if (clipboard && typeof clipboard.setString === "function") {
      setter = async (text) => {
        clipboard.setString(text)
        return true
      }
      return setter
    }
  } catch {
    // Not installed, or its native module is missing
  }
  try {
    const core = require("react-native/Libraries/Components/Clipboard/Clipboard")
    const clipboard = core && (core.default || core)
    if (clipboard && typeof clipboard.setString === "function") {
      setter = async (text) => {
        clipboard.setString(text)
        return true
      }
      return setter
    }
  } catch {
    // Removed from this React Native version, or its native module is missing
  }
  return setter
}

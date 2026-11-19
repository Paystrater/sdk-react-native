// The checkout's words for React Native: the shared core's (src/core/strings.ts,
// kept identical to @paystrater/react), plus the few only this SDK shows.
// Share stands in for Copy when the app has no clipboard module
// (src/optional/clipboard.js), and the hint names the amount too.
import { stringsFor, type Locale, type Strings as CoreStrings } from "./core/strings.js"

const native = {
  shareAmount: "Share amount",
  sharePrompt: "Share prompt",
  selectToCopy: "Press and hold the address or the amount to copy it."
}

export type Strings = CoreStrings & { [K in keyof typeof native]: string }

/** The strings for a locale, with any of the merchant's overrides */
export function nativeStrings(locale?: Locale, overrides?: Partial<Strings>): Strings {
  return { ...stringsFor(locale), ...native, ...overrides }
}

// PaystraterTheme for React Native: the same variable names
// as the web, as a plain object, with the Paystrater design as the default.
import { Platform } from "react-native"
import { resolveTheme, type Appearance, type ThemeVariables } from "./core/theme.js"

export type { Appearance, ThemeName, ThemeVariables } from "./core/theme.js"

export interface PaystraterTheme {
  colors: Omit<ThemeVariables, "fontFamily" | "fontFamilyMono" | "borderRadius" | "borderRadiusSurface" | "borderRadiusButton" | "borderRadiusCard">
  fontFamily?: string
  fontFamilyMono?: string
  /** Inputs and chain chips */
  borderRadius: number
  /** Method cards and wells */
  borderRadiusSurface: number
  /** Buttons: pills */
  borderRadiusButton: number
  /** The checkout card */
  borderRadiusCard: number
}

// A CSS font stack means nothing on a phone: only a single font name is used, else the system font
const singleFont = (value: string) => (value.includes(",") ? undefined : value.replace(/["']/g, "").trim() || undefined)
const radius = (value: string, fallback: number) => {
  const n = parseFloat(value)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

export function themeFor(appearance: Appearance | undefined, prefersDark: boolean): PaystraterTheme {
  const { fontFamily, fontFamilyMono, borderRadius, borderRadiusSurface, borderRadiusButton, borderRadiusCard, ...colors } = resolveTheme(appearance, prefersDark)
  return {
    colors,
    fontFamily: singleFont(fontFamily),
    fontFamilyMono: singleFont(fontFamilyMono) ?? Platform.select({ ios: "Menlo", android: "monospace", default: undefined }),
    borderRadius: radius(borderRadius, 14),
    borderRadiusSurface: radius(borderRadiusSurface, 14),
    borderRadiusButton: radius(borderRadiusButton, 24),
    borderRadiusCard: radius(borderRadiusCard, 18)
  }
}

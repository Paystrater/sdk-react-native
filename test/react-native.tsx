// A stand-in for react-native in tests: the components render as DOM
// elements with their accessibility props as ARIA, and the platform APIs are
// recorded so tests can check what the checkout asked for.
import { forwardRef, type ReactNode } from "react"
import { vi } from "vitest"

type Props = Record<string, unknown> & { children?: ReactNode }

const aria = (p: Props) => ({
  "aria-label": p.accessibilityLabel as string | undefined,
  role: (p.accessibilityRole as string | undefined) === "header" ? "heading" : (p.accessibilityRole as string | undefined),
  "aria-live": p.accessibilityLiveRegion as "polite" | "assertive" | undefined,
  "aria-checked": (p.accessibilityState as { checked?: boolean } | undefined)?.checked,
  "aria-expanded": (p.accessibilityState as { expanded?: boolean } | undefined)?.expanded,
  "aria-disabled": (p.accessibilityState as { disabled?: boolean } | undefined)?.disabled
})

export const View = ({ children, ...p }: Props) => <div {...aria(p)}>{children}</div>
export const Text = ({ children, ...p }: Props) => (
  <span {...aria(p)} data-selectable={p.selectable ? "true" : undefined}>
    {children}
  </span>
)
export const Pressable = ({ children, onPress, disabled, ...p }: Props) => (
  <button type="button" {...aria(p)} disabled={Boolean(disabled)} onClick={() => (onPress as () => void)?.()}>
    {typeof children === "function" ? (children as (s: { pressed: boolean }) => ReactNode)({ pressed: false }) : children}
  </button>
)
export const TextInput = forwardRef<HTMLInputElement, Props>(({ value, onChangeText, accessibilityLabel, placeholder }, ref) => (
  <input ref={ref} aria-label={accessibilityLabel as string} placeholder={placeholder as string} value={value as string} onChange={(e) => (onChangeText as (v: string) => void)?.(e.target.value)} />
))
export const Image = ({ accessibilityLabel }: Props) => <img alt={(accessibilityLabel as string) ?? ""} />
export const ActivityIndicator = ({ accessibilityLabel }: Props) => <span role="progressbar" aria-label={accessibilityLabel as string} />
export const StyleSheet = { create: <T,>(styles: T) => styles }
export const Platform = { OS: "ios", select: <T,>(o: { ios?: T; default?: T }) => o.ios ?? o.default }

let scheme: "light" | "dark" = "light"
export const useColorScheme = () => scheme
export const setColorScheme = (s: "light" | "dark") => (scheme = s)

export const Linking = { openURL: vi.fn(async () => true), canOpenURL: vi.fn(async () => false) }
export const Share = { share: vi.fn(async () => ({ action: "sharedAction" })) }
export const AccessibilityInfo = { announceForAccessibility: vi.fn() }

const listeners = new Set<() => void>()
export const AppState = {
  currentState: "active" as string,
  addEventListener: (_: string, l: () => void) => {
    listeners.add(l)
    return { remove: () => listeners.delete(l) }
  }
}
export function setAppState(state: string) {
  AppState.currentState = state
  for (const l of listeners) l()
}

export function reset() {
  scheme = "light"
  AppState.currentState = "active"
  Linking.openURL.mockClear()
  Linking.canOpenURL.mockReset().mockResolvedValue(false)
  Share.share.mockClear()
}

export type StyleProp<T> = T | T[] | null | undefined
export type ViewStyle = Record<string, unknown>
export type TextStyle = Record<string, unknown>

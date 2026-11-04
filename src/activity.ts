// React Native's side of "only while the payer is looking":
// AppState. No calls while the app is in the background or inactive,
// one read straight away when it comes back.
import { AppState } from "react-native"
import type { ActivitySource } from "./core/activity.js"

export function appStateActivity(): ActivitySource {
  const isActive = () => AppState.currentState === "active"
  return {
    isActive,
    subscribe(listener) {
      let last = isActive()
      const sub = AppState.addEventListener("change", () => {
        const now = isActive()
        if (now !== last) {
          last = now
          listener(now)
        }
      })
      return () => sub.remove()
    }
  }
}

// usePaystraterPayment for React Native: the same flow
// and polling as the web, driven by AppState. Plain JSON over TLS: the mobile
// SDKs take no encryption options in v1.
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react"
import { Checkout, type ActionResult, type CheckoutCallbacks, type CheckoutState } from "./core/checkout.js"
import { createClient } from "./core/client.js"
import type { PaymentMethod, PaymentStatus } from "./core/types.js"
import { appStateActivity } from "./activity.js"

export interface PaystraterPaymentOptions extends CheckoutCallbacks {
  /** Your publishable key, pk_live_… or pk_test_…. Never a secret key: anything in an app bundle is public */
  publishableKey: string
  /** Only narrows the payment's chains */
  chains?: number[]
  /** Overrides the API host the key picks */
  apiBaseUrl?: string
  disabled?: boolean
}

export interface PayerDetails {
  email?: string
  name?: string
  refundAddress?: string
}

export interface PaystraterPayment extends CheckoutState {
  status: PaymentStatus | undefined
  choose(method: PaymentMethod): void
  back(): void
  startDeposit(chainId: number, payer?: PayerDetails): Promise<ActionResult>
  payWithPaystrater(payer: string): Promise<ActionResult>
  refresh(): void
}

export function usePaystraterPayment(paymentId: string, options: PaystraterPaymentOptions): PaystraterPayment {
  const { publishableKey, apiBaseUrl, disabled } = options
  const chainsKey = options.chains?.join(",") ?? ""
  const callbacks = useRef<CheckoutCallbacks>(options)
  useEffect(() => {
    callbacks.current = options
  })

  const checkout = useMemo(
    () =>
      new Checkout({
        client: createClient({ publishableKey, apiBaseUrl }),
        paymentId,
        chains: chainsKey ? chainsKey.split(",").map(Number) : undefined,
        activity: appStateActivity(),
        callbacks: {
          onStatusChange: (p) => callbacks.current.onStatusChange?.(p),
          onSuccess: (p) => callbacks.current.onSuccess?.(p),
          onExpired: (p) => callbacks.current.onExpired?.(p),
          onCancelled: (p) => callbacks.current.onCancelled?.(p),
          onError: (e) => callbacks.current.onError?.(e)
        }
      }),
    [paymentId, publishableKey, apiBaseUrl, chainsKey]
  )

  useEffect(() => {
    if (disabled) return
    checkout.start()
    return () => checkout.stop()
  }, [checkout, disabled])

  const state = useSyncExternalStore(checkout.subscribe, checkout.getState, checkout.getState)
  return useMemo(
    () => ({
      ...state,
      status: state.payment?.status,
      choose: (m: PaymentMethod) => checkout.choose(m),
      back: () => checkout.back(),
      startDeposit: (chainId: number, payer?: PayerDetails) =>
        checkout.startTransferToPay({ chainId, payerEmail: payer?.email, payerName: payer?.name, refundAddress: payer?.refundAddress }),
      payWithPaystrater: (payer: string) => checkout.payWithPaystrater(payer),
      refresh: () => checkout.refresh()
    }),
    [state, checkout]
  )
}

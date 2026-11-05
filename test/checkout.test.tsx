import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { appStateActivity, PaystraterCheckout, themeFor } from "../src/index.js"
import type { CheckoutPayment } from "../src/core/types.js"
import { deposit, fakeFetch, ID, ok, payment, PK_TEST, type Recorded } from "./helpers.js"
import { Linking, setAppState, Share } from "./react-native.js"

function serve(route: (req: Recorded) => Response | Promise<Response>) {
  const net = fakeFetch(route)
  vi.stubGlobal("fetch", net.fetch)
  return net
}
afterEach(() => vi.unstubAllGlobals())

const lockedTtp = (extra: Partial<CheckoutPayment> = {}) =>
  payment({
    method: "transfer_to_pay",
    methods: undefined,
    chainId: 8453,
    chainName: "Base",
    transferToPay: {
      depositAddress: deposit().depositAddress,
      expectedAmount: "25.25",
      depositExpiresAt: deposit().expiresAt,
      tokenAddress: deposit().tokenAddress,
      tokenDecimals: 6
    },
    ...extra
  })

describe("theme", () => {
  it("takes the web's variable names and the Paystrater defaults", () => {
    const light = themeFor(undefined, false)
    expect(light.colors.colorPrimary).toBe("#285BB6")
    expect(light.borderRadius).toBe(8)
    expect(light.borderRadiusSurface).toBe(12)
    expect(themeFor({ theme: "auto" }, true).colors.colorBackground).toBe("#0C0D10")
    expect(themeFor({ theme: "dark" }, false).colors.colorPrimary).toBe("#A2AED1")
    expect(themeFor({ theme: "dark" }, false).colors.colorOnPrimary).toBe("#0A1224")
  })
  it("uses a single font name, never a CSS stack", () => {
    expect(themeFor(undefined, false).fontFamily).toBeUndefined()
    expect(themeFor({ variables: { fontFamily: "Inter" } }, false).fontFamily).toBe("Inter")
  })
})

describe("AppState activity", () => {
  it("is active only while the app is in the foreground", () => {
    const source = appStateActivity()
    const seen: boolean[] = []
    const stop = source.subscribe((a) => seen.push(a))
    setAppState("background")
    expect(source.isActive()).toBe(false)
    setAppState("active")
    stop()
    setAppState("background")
    expect(seen).toEqual([false, true])
  })
})

describe("<PaystraterCheckout> for React Native", () => {
  it("offers Pay with Paystrater and Transfer to Pay, not the agent", async () => {
    serve(() => ok(payment()))
    render(<PaystraterCheckout paymentId={ID} publishableKey={PK_TEST} />)
    expect(await screen.findByText("Pay with Paystrater")).toBeTruthy()
    expect(screen.getByText("Transfer to Pay")).toBeTruthy()
    expect(screen.queryByText("Pay with an AI agent")).toBeNull()
    expect(screen.getByText("Test mode")).toBeTruthy()
  })

  it("shows the error and Try again when the first read fails, not an endless spinner", async () => {
    serve(() => {
      throw new TypeError("Network request failed")
    })
    render(<PaystraterCheckout paymentId={ID} publishableKey={PK_TEST} />)
    expect(await screen.findByText(/couldn't reach Paystrater/, {}, { timeout: 3000 })).toBeTruthy()
    expect(screen.getByText("Try again")).toBeTruthy()
  })

  it("sends Pay with Paystrater, then opens the Paystrater app on the request", async () => {
    let sent = false
    serve((req) => {
      if (req.method === "POST") sent = true
      return ok(sent ? payment({ method: "pay_with_paystrater", payer: { name: "Ada Lovelace" } }) : payment())
    })
    render(<PaystraterCheckout paymentId={ID} publishableKey={PK_TEST} />)
    fireEvent.click(await screen.findByText("Pay with Paystrater"))
    fireEvent.change(screen.getByLabelText("Paystrater ID or username"), { target: { value: "ada" } })
    fireEvent.click(screen.getByText("Send to my app"))
    expect(await screen.findByText("Sent to Ada Lovelace")).toBeTruthy()
    expect(Linking.openURL).toHaveBeenCalledWith(`https://app.paystrater.com/pay?id=${ID}`)
  })

  it("lets the merchant open links through its own launcher", async () => {
    const openUrl = vi.fn(async () => true)
    serve(() => ok(payment({ method: "pay_with_paystrater", methods: undefined, payer: { name: "Ada" } })))
    render(<PaystraterCheckout paymentId={ID} publishableKey={PK_TEST} openUrl={openUrl} />)
    fireEvent.click(await screen.findByText("Open the Paystrater app"))
    expect(openUrl).toHaveBeenCalledWith(`https://app.paystrater.com/pay?id=${ID}`)
    expect(Linking.openURL).not.toHaveBeenCalled()
  })

  it("shows the deposit with selectable text and a share sheet, and no QR", async () => {
    serve(() => ok(lockedTtp()))
    const { container } = render(<PaystraterCheckout paymentId={ID} publishableKey={PK_TEST} />)
    expect(await screen.findByRole("heading", { name: "Send exactly 25.25 USDC on Base" })).toBeTruthy()
    const address = screen.getByText(deposit().depositAddress)
    expect(address.getAttribute("data-selectable")).toBe("true")
    expect(container.querySelector("svg")).toBeNull()
    fireEvent.click(screen.getByText("Share address"))
    expect(Share.share).toHaveBeenCalledWith({ message: deposit().depositAddress })
  })

  it("shows Open in wallet only when a wallet can open the ethereum: link", async () => {
    serve(() => ok(lockedTtp()))
    render(<PaystraterCheckout paymentId={ID} publishableKey={PK_TEST} />)
    await screen.findByText(/Send exactly/)
    expect(screen.queryByText("Open in wallet")).toBeNull()
    expect(Linking.canOpenURL).toHaveBeenCalledWith(`ethereum:${deposit().tokenAddress}@8453/transfer?address=${deposit().depositAddress}&uint256=25250000`)
  })

  it("opens the wallet link when a wallet is installed", async () => {
    Linking.canOpenURL.mockResolvedValue(true)
    serve(() => ok(lockedTtp()))
    render(<PaystraterCheckout paymentId={ID} publishableKey={PK_TEST} />)
    fireEvent.click(await screen.findByText("Open in wallet"))
    expect(Linking.openURL).toHaveBeenCalledWith(expect.stringMatching(/^ethereum:/))
  })

  it("keeps the token contract, network and chain ID in a closed section", async () => {
    serve(() => ok(lockedTtp()))
    render(<PaystraterCheckout paymentId={ID} publishableKey={PK_TEST} />)
    const toggle = await screen.findByRole("button", { name: "Payment details" })
    expect(toggle.getAttribute("aria-expanded")).toBe("false")
    expect(screen.queryByText(deposit().tokenAddress!)).toBeNull()
    fireEvent.click(toggle)
    expect(screen.getByText(deposit().tokenAddress!)).toBeTruthy()
    expect(screen.getByText("8453")).toBeTruthy()
  })

  it("starts Transfer to Pay with only the fields given", async () => {
    let started = false
    const net = serve((req) => {
      if (req.method === "POST") {
        started = true
        return ok(deposit())
      }
      return ok(started ? lockedTtp() : payment())
    })
    render(<PaystraterCheckout paymentId={ID} publishableKey={PK_TEST} />)
    fireEvent.click(await screen.findByText("Transfer to Pay"))
    fireEvent.click(screen.getByRole("radio", { name: "Base" }))
    fireEvent.click(screen.getByText("Show the deposit address"))
    await screen.findByText(/Send exactly/)
    expect(net.calls.find((c) => c.method === "POST")!.body).toEqual({ receivePaymentId: ID, chainId: 8453 })
  })

  it("sends plain JSON: no encryption on mobile in v1", async () => {
    const net = serve(() => ok(payment()))
    render(<PaystraterCheckout paymentId={ID} publishableKey={PK_TEST} />)
    await screen.findByText("Pay with Paystrater")
    expect(net.calls[0]!.headers["X-Paystrater-Encrypted"]).toBeUndefined()
  })

  it.each([
    [lockedTtp({ status: "succeeded" }), "Paid"],
    [lockedTtp({ status: "expired", transferToPay: { ...lockedTtp().transferToPay!, receivedAmount: "10" } }), "You sent less than the amount"],
    [payment({ status: "cancelled" }), "This payment was cancelled"],
    [payment({ status: "processing" }), "Payment received, confirming"]
  ])("shows the end state %#", async (p, heading) => {
    serve(() => ok(p))
    render(<PaystraterCheckout paymentId={ID} publishableKey={PK_TEST} />)
    expect(await screen.findByRole("heading", { name: heading })).toBeTruthy()
  })

  it("refuses a secret key without calling the API", async () => {
    const net = serve(() => ok(payment()))
    render(<PaystraterCheckout paymentId={ID} publishableKey="sk_live_oops" />)
    expect((await screen.findByRole("alert")).textContent).toMatch(/secret key/)
    expect(net.calls).toHaveLength(0)
  })

  it("makes no calls while the app is in the background, and reads once on return", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const net = serve(() => ok(payment()))
    render(<PaystraterCheckout paymentId={ID} publishableKey={PK_TEST} />)
    await act(() => vi.advanceTimersByTimeAsync(10))
    await waitFor(() => expect(net.calls).toHaveLength(1))
    act(() => setAppState("background"))
    await act(() => vi.advanceTimersByTimeAsync(60_000))
    expect(net.calls).toHaveLength(1)
    act(() => setAppState("active"))
    await act(() => vi.advanceTimersByTimeAsync(10))
    expect(net.calls).toHaveLength(2)
    vi.useRealTimers()
  })
})

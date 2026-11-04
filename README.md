# @paystrater/react-native

The Paystrater checkout for React Native and Expo. Customers pay with **Pay with Paystrater** (the SDK hands them to the Paystrater app to approve) or **Transfer to Pay** (they send from any wallet). Plain JavaScript: no native modules, no config plugin, nothing to link.

```bash
npm install @paystrater/react-native
```

`react` and `react-native` are peers you already have; the package has no other dependencies.

## Quick start

1. On your server, create the payment with your **secret key** (`POST /v1/receive-payments`) and send its `rcv_` ID to the app.
2. In the app, show the checkout with your **publishable key**:

```tsx
import { PaystraterCheckout } from "@paystrater/react-native"

<PaystraterCheckout
  paymentId={paymentId}
  publishableKey="pk_live_…"
  onSuccess={() => navigation.navigate("Thanks")}
/>
```

3. **Ship the order on the `incoming_payment.succeeded` webhook**, or after your server reads `GET /v1/transactions/{id}`. `onSuccess` is for the payer's experience only: an app can be tampered with, so never fulfil on it.

A key in an app bundle is public, which is why only a publishable key is accepted: it can read a payment and start a deposit, never move money. A secret key is refused before any call.

## What it does

- **Pay with Paystrater:** the customer enters their Paystrater ID or username; the SDK sends the request and opens `https://app.paystrater.com/pay?id=rcv_…`. With the Paystrater app installed, that opens the request in the app; without it, the page there links to the stores. When the customer comes back, the checkout reads the payment and shows the result.
- **Transfer to Pay:** the customer picks a network; email, name and refund address are optional. The deposit address is selectable text (press and hold to copy) with a share button. **Open in wallet** appears when an installed wallet can open an EIP-681 `ethereum:` link with the amount filled in. The token contract, network and chain ID sit in a collapsed **Payment details** section. There is no QR code: the payer is already on this phone.
- **Agent payments** are not an app flow: your server gives the payment's `agentPrompt` to the customer's agent.
- The checkout reads the payment every 4 seconds while the app is in the foreground, makes no calls at all in the background, reads once straight away when it comes back, and stops at a final status.

To let "Open in wallet" check for a wallet, declare the scheme:

- **iOS** (`Info.plist`, or `ios.infoPlist` in Expo's `app.json`): `LSApplicationQueriesSchemes` with `ethereum`.
- **Android** (`AndroidManifest.xml`): a `<queries>` entry with an intent for the `ethereum` scheme.

Without it, the button is simply not shown.

## Props

| Prop | |
| --- | --- |
| `paymentId` | The `rcv_` ID your server created |
| `publishableKey` | `pk_live_…` or `pk_test_…` (test keys use the sandbox and show a Test mode ribbon) |
| `chains` | Chain IDs that narrow the payment's chains; it can only narrow |
| `appearance` | `{ theme: "light" \| "dark" \| "auto", variables }`, the same variable names as `@paystrater/react` |
| `onSuccess`, `onExpired`, `onCancelled`, `onStatusChange`, `onError` | Callbacks for the payer's experience |
| `onStartAgain` | Shows "Start again" on an expired payment |
| `openUrl` | Your own launcher, if the app already uses one; default `Linking.openURL` |
| `locale`, `strings` | English today; override any wording |

`usePaystraterPayment(paymentId, { publishableKey })` gives the same flow for your own UI.

## Encryption

Not in v1. The checkout sends plain JSON over TLS, which both platforms enforce. Hermes has no WebCrypto, and encrypting would need a native crypto module, which this package avoids. The checkout carries a payment ID, a chain and an optional email, never a secret.

## Accessibility

Every control is at least 44 points tall and labelled; steps and status changes are announced to screen readers. The theme cannot turn these off.

Docs: https://docs.paystrater.com/docs/sdks/react-native

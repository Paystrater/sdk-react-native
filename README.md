# @paystrater/react-native

[![npm](https://img.shields.io/npm/v/@paystrater/react-native)](https://www.npmjs.com/package/@paystrater/react-native)
[![license](https://img.shields.io/npm/l/@paystrater/react-native)](https://github.com/Paystrater/sdk-react-native/blob/main/LICENSE)

The Paystrater checkout for React Native and Expo: one component, or build your own with one hook. Accept stablecoin and crypto payments, including USDC, USDT, ETH, BNB and SOL. Your payment settings decide which tokens and networks a payment accepts. Your server creates the payment with its secret key; the app only needs your publishable key.

## Features

- **Pay with Paystrater:** the customer enters their Paystrater ID; the SDK hands them to the Paystrater app to approve, and shows the result when they come back.
- **Transfer to Pay:** the customer sends from any wallet on the phone, with copy, share and **Open in wallet** when a wallet app can take the payment.
- **AI agent payments:** the customer gets a prompt to share with their own AI agent, which pays within the limits they set.
- **Expo and bare React Native:** plain JavaScript with no native modules, no config plugin and nothing to link. It runs in Expo Go, in development builds and in bare apps.
- **Light and dark themes** that follow the device, with the same theme variables as `@paystrater/react`.
- **Accessible:** labelled controls with large tap areas, and steps announced to screen readers.
- **Battery friendly:** it checks the payment only while the app is in the foreground.

## Requirements

- React 18 or later and React Native 0.72 or later (peer dependencies). Expo SDK projects work as they are, in Expo Go or a development build.
- A Paystrater business account, with a secret key on your server and a publishable key for the app, from the [dashboard](https://dashboard.paystrater.com).

## Install

```bash
npm install @paystrater/react-native
```

With Expo:

```bash
npx expo install @paystrater/react-native
```

The package has no other dependencies. Its few images (the Paystrater logo and icons) are bundled by Metro like any image asset.

## Quick start

1. On your server, create the payment with your **secret key** and pass its `rcv_` ID to your app. See [Create the payment on your server](https://docs.paystrater.com/docs/sdks/react-native#create-the-payment-on-your-server) for examples in every server language.
2. In the app, show the checkout with your **publishable key**:

```tsx
import { PaystraterCheckout } from "@paystrater/react-native"

<PaystraterCheckout
  paymentId={paymentId}
  publishableKey="pk_live_…"
  onSuccess={() => navigation.navigate("Thanks")}
/>
```

3. **Fulfil the order on the `incoming_payment.succeeded` webhook**, or after your server reads `GET /v1/transactions/{id}`. `onSuccess` is for the payer's experience only: an app can be tampered with, so never fulfil on it.

## Payment methods

- **Pay with Paystrater:** the customer enters their Paystrater ID or username; the SDK sends the request and opens `https://app.paystrater.com/pay?id=rcv_…`. With the Paystrater app installed, that opens the request in the app; without it, the page there links to the stores. When the customer comes back, the checkout reads the payment and shows the result.
- **Transfer to Pay:** the customer picks a network; email, name and refund address are optional. **Copy address** and **Copy amount** (the exact amount) sit on one row, and **Open in wallet** appears when an installed wallet can open an EIP-681 `ethereum:` link with the amount filled in. The token contract, network and chain ID sit in a collapsed **Payment details** section. There is no QR code: the payer is already on this phone.
- **AI agent payments:** the customer taps **Continue** and gets a prompt for their AI agent, with a **Copy prompt** button. The agent pays through Paystrater within the limits the customer set, and the checkout shows the result.

Which tokens a customer can pay in comes from your payment settings in the dashboard: stablecoins (USDC, USDT, USDT0, PYUSD, EURC, USDG, cNGN) and coins (ETH, BNB, SOL, HYPE, WETH), each on the networks that carry it. Transfer to Pay is not available on Solana yet, so SOL and Solana tokens are paid with Pay with Paystrater.

### Copy

Copy writes to the clipboard with no extra dependency. The SDK uses the first clipboard it finds: `expo-clipboard`, then `@react-native-clipboard/clipboard`, then the clipboard React Native still ships in core. If none is there (a future React Native without it, and neither package installed), the Copy buttons open the share sheet instead, and the address and amount stay selectable.

### Open in wallet

To let "Open in wallet" check for a wallet app, declare the `ethereum` scheme. Without it, the button is not shown.

- **iOS:** `LSApplicationQueriesSchemes` with `ethereum` in `Info.plist`, or `ios.infoPlist` in Expo's `app.json`.
- **Android:** a `<queries>` entry with an intent for the `ethereum` scheme in `AndroidManifest.xml`. In Expo, add it with a development build (a config plugin or `npx expo prebuild`).

## Props

| Prop | |
| --- | --- |
| `paymentId` | The `rcv_` ID your server created |
| `publishableKey` | `pk_live_…` or `pk_test_…`. A secret key is refused before any call |
| `chains` | Chain IDs that narrow the payment's networks for Transfer to Pay. It can only narrow |
| `appearance` | `{ theme, variables, variablesDark }`, the same as `@paystrater/react` |
| `onSuccess`, `onExpired`, `onCancelled`, `onStatusChange`, `onError` | Callbacks for the payer's experience |
| `onStartAgain` | Shows "Start again" on an expired payment |
| `openUrl` | Your own launcher, if the app already uses one; default `Linking.openURL` |
| `locale`, `strings` | English today; replace any wording through `strings` |
| `checkout` | Drive the component from your own `usePaystraterPayment` |
| `apiBaseUrl` | Overrides the API host the key picks |
| `style` | Style for the checkout's root view |

`usePaystraterPayment(paymentId, { publishableKey })` gives the same flow for your own UI: `stage`, `payment`, `methods`, `chains`, `deposit` and `error`, with `choose`, `back`, `startDeposit`, `payWithPaystrater`, `startAgentic` and `refresh`. The checkout reads the payment every 4 seconds while the app is in the foreground, makes no calls in the background, reads once straight away when it comes back, and stops at a final status.

## Appearance

```tsx
<PaystraterCheckout
  appearance={{
    theme: "auto", // the default: follows the device; or "light" | "dark"
    variables: { colorPrimary: "#0F766E" },
    variablesDark: { colorPrimary: "#5EEAD4" }
  }}
  …
/>
```

The variables, defaults and brand rules are those of `@paystrater/react`: see its [Appearance section](https://github.com/Paystrater/sdk-react#appearance). A Paystrater default such as `colorPrimary: "#285BB6"` follows the theme, and a `colorPrimary` of your own gets a readable hover, button text and brand text. A font must be a single family your app ships; the SDK never loads fonts. Merchant and payer names are shown capitalized, and every screen ends with "Powered by Paystrater", which opens paystrater.com.

## Accessibility

Controls are labelled with tap areas of at least 40 points, and steps and status changes are announced to screen readers. The theme cannot turn these off.

## Test mode

Test keys (`pk_test_…`) use the sandbox and show a Test mode chip. Approve Pay with Paystrater requests in the [sandbox app](https://sandbox.paystrater.com), or send test USDC from any wallet on a test network for Transfer to Pay ([Circle's faucet](https://faucet.circle.com) gives it out free). See the [sandbox guide](https://docs.paystrater.com/docs/sandbox).

## Errors and troubleshooting

Errors come back as a `PaystraterError` (`kind`, `status`, `message`) through `onError` and the hook's `error`. `kind` is `api`, `network`, `timeout`, `setup` or `cancelled`; the message is the API's own words.

- **"A publishable key starts with pk_live_ or pk_test_":** pass the publishable key, not the secret key or a key with spaces.
- **The payment does not load:** check that `paymentId` is the `rcv_` ID your server created with the same mode (live or test) as the key.
- **Open in wallet is missing:** declare the `ethereum` scheme (see Open in wallet), and check that a wallet app is installed.

More in the [errors reference](https://docs.paystrater.com/docs/errors).

## Security

- A key in an app bundle is public, so only a publishable key is accepted: it can read a payment and start a deposit, never move money.
- The secret key stays on your server. The checkout refuses a secret key before making any call.
- Fulfil orders on the webhook or a server-side read, never on an app callback.

## Links

- Docs: https://docs.paystrater.com/docs/sdks/react-native
- Dashboard: https://dashboard.paystrater.com
- Changelog: [CHANGELOG.md](https://github.com/Paystrater/sdk-react-native/blob/main/CHANGELOG.md)

## License

MIT. See [LICENSE](https://github.com/Paystrater/sdk-react-native/blob/main/LICENSE).

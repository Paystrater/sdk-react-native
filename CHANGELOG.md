# Changelog

## 1.0.5

### Patch Changes

- b054709: An expired Transfer to Pay tells the customer not to send money to the address any more, and no longer says a late transfer is returned by email. New string: statusExpiredTransferHint. `late`, `statusLate` and `statusLateHint` are removed: the checkout only shows what the server reports, and an expired payment that received money is underpaid.

## 1.0.4

### Patch Changes

- c67a02d: Pay with Paystrater speaks of approving in the app rather than a PIN, since the app also approves with fingerprint and Face ID.

## 1.0.3

### Patch Changes

- 68223b9: The AI agent step has a "How to connect your AI agent" section, closed until tapped: four short steps, the MCP server URL with Copy (the sandbox server on a test key), a note on agent wallets and a link to the full guide. The size budget is now 50 KB minified.

## 1.0.2

### Patch Changes

- 8216681: Copy works with no extra package: after expo-clipboard and @react-native-clipboard/clipboard, the SDK now falls back to the clipboard React Native still ships in core, so Copy address, Copy amount and Copy prompt copy instead of opening the share sheet. The buttons always say Copy; only with no clipboard at all does the tap open the share sheet, and then it does not say "Copied". On Transfer to Pay, Copy address and Copy amount sit on one row that wraps when it doesn't fit.
- 8216681: Transfer to Pay: "Send exactly …" is a calm success-toned callout instead of a large heading; button labels are centred inside every button; "Choose how to pay" is smaller and closer to the first tile; the deposit well labels the amount "Total amount" and shows it in the brand text colour (it follows a custom colorPrimary and dark mode); choosing no network says "Select a network to pay on.". The AI agent step says "Create a one-time prompt for your agent. It will pay within your limits." before a prompt exists, and "Give this prompt to your agent" only once there is one.

## 1.0.1

### Patch Changes

- Copy now copies. When the app has expo-clipboard or @react-native-clipboard/clipboard, Copy address, Copy amount and Copy prompt write to the clipboard and say "Copied"; the SDK still adds no dependency. Without either, the buttons are Share address, Share amount and Share prompt, and the address and amount stay selectable. Transfer to Pay now also offers the exact amount to copy or share.
  
  The amount due at the top of the checkout is now bold (700, was 600).
  
  On Transfer to Pay, the total amount under the address is bold.
- Pay with Paystrater no longer opens the Paystrater app by itself after "Send to my app". The request is sent and the checkout shows the waiting state; the app opens only when the customer taps "Open the Paystrater app".

## 1.0.0

### Major Changes

- de88225: First stable release.
  
  - The checkout follows the Paystrater design (the sandbox app's): method tiles with icons, pill buttons, 48px fields, the amount in the brand colour, "← <method>" under each step and "Powered by Paystrater" under every screen
  - The default theme is "auto": it follows the device's light or dark setting. In dark mode Paystrater's blue becomes the brand's dark buttons; a merchant's own colorPrimary gets a worked-out hover, button text and readable brand text (WCAG AA)
  - Names are capitalized; amounts show at least two decimals
  - A publishable key is checked by its pk_live_ or pk_test_ prefix only; a key with a space or line break is refused with a clear message
  - Copy names no "shop": messages speak of the business being paid
  - AI agent payments: a third method tile, as on the web. Continue gets the prompt (POST /v1/checkout/agentic) to share with the customer's agent; usePaystraterPayment adds startAgentic()
  - Brand images ship as Metro and Expo assets; still no native modules, so it runs in Expo Go, development builds and bare apps

Versions and notes are written by Changesets (see PUBLISHING.md).

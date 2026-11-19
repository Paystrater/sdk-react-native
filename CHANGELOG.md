# Changelog

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

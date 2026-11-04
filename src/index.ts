// @paystrater/react-native: the Paystrater checkout for React Native and Expo.
// Plain JavaScript, no native modules. Use a publishable key
// only, and ship goods on the incoming_payment.succeeded webhook, never on
// onSuccess: that callback is for the payer's experience.
export { PaystraterCheckout, type PaystraterCheckoutProps } from "./PaystraterCheckout.js"
export { usePaystraterPayment, type PayerDetails, type PaystraterPayment, type PaystraterPaymentOptions } from "./usePaystraterPayment.js"
export { appStateActivity } from "./activity.js"
export { themeFor, type Appearance, type PaystraterTheme, type ThemeName, type ThemeVariables } from "./theme.js"
export type { ActionResult, CheckoutState, Deposit, FieldProblem, Stage } from "./core/checkout.js"
export type { ErrorKind, PaystraterError } from "./core/errors.js"
export type { KeyMode } from "./core/keys.js"
export type { Locale, Strings } from "./core/strings.js"
export type { ChainOption, CheckoutPayment, PaymentMethod, PaymentStatus } from "./core/types.js"
export { SDK_VERSION } from "./core/version.js"

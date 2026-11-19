// The Paystrater mark and wordmark and the checkout's icons, as small white
// PNGs drawn by Image with tintColor, so one image serves light and dark and
// the SDK needs no SVG package. Metro (and Expo) bundle them as image assets,
// outside the JavaScript. Rendered at 3x from the same vector paths as
// @paystrater/react (src/react/brand.tsx); replace the files when there is an
// official vector.
import ARROW_LEFT from "./assets/arrow.png"
import CHEVRON from "./assets/chevron.png"
import MARK from "./assets/mark.png"
import WALLET from "./assets/wallet.png"
import WORDMARK from "./assets/wordmark.png"

/** MARK: the P mark (a method tile). WORDMARK: "Paystrater" as one graphic, 258×45 at 3x (the footer). WALLET: Transfer to Pay. */
export { ARROW_LEFT, CHEVRON, MARK, WALLET, WORDMARK }

export const PAYSTRATER_SITE = "https://paystrater.com"

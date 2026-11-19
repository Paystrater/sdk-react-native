---
"@paystrater/react-native": patch
---

Copy works with no extra package: after expo-clipboard and @react-native-clipboard/clipboard, the SDK now falls back to the clipboard React Native still ships in core, so Copy address, Copy amount and Copy prompt copy instead of opening the share sheet. The buttons always say Copy; only with no clipboard at all does the tap open the share sheet, and then it does not say "Copied". On Transfer to Pay, Copy address and Copy amount sit on one row that wraps when it doesn't fit.

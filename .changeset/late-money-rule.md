---
"@paystrater/react-native": patch
---

An expired Transfer to Pay tells the customer not to send money to the address any more, and no longer says a late transfer is returned by email. New string: statusExpiredTransferHint. `late`, `statusLate` and `statusLateHint` are removed: the checkout only shows what the server reports, and an expired payment that received money is underpaid.

// <PaystraterCheckout> for React Native: Pay with Paystrater
// hands off to the Paystrater app; Transfer to Pay shows the deposit with copy
// (selectable text), share and, when a wallet can open it, an EIP-681 link.
// No QR: the payer is on this phone. No native modules: Linking, Share, AppState.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import {
  AccessibilityInfo,
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
  type StyleProp,
  type TextStyle,
  type ViewStyle
} from "react-native"
import { formatAmount, isPositiveAmount, walletLink } from "./core/amount.js"
import type { Deposit, FieldProblem } from "./core/checkout.js"
import { errorForPayer, type PaystraterError } from "./core/errors.js"
import { fill, stringsFor, type Locale, type Strings } from "./core/strings.js"
import type { CheckoutPayment, PaymentMethod } from "./core/types.js"
import { themeFor, type Appearance, type PaystraterTheme } from "./theme.js"
import { usePaystraterPayment, type PaystraterPayment, type PaystraterPaymentOptions } from "./usePaystraterPayment.js"

export interface PaystraterCheckoutProps extends Omit<PaystraterPaymentOptions, "disabled"> {
  /** The rcv_ ID your server created with your secret key */
  paymentId: string
  appearance?: Appearance
  locale?: Locale
  strings?: Partial<Strings>
  onStartAgain?: () => void
  /** Drive the component from your own usePaystraterPayment */
  checkout?: PaystraterPayment
  /** Opens a URL; defaults to React Native's Linking */
  openUrl?: (url: string) => Promise<unknown>
  style?: StyleProp<ViewStyle>
}

const APP_LINK = "https://app.paystrater.com/pay?id="

function formatDuration(seconds: number): string {
  if (seconds >= 3600) return `${Math.floor(seconds / 3600)} h ${Math.floor((seconds % 3600) / 60)} min`
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}

function useCountdown(expiresAt: string | undefined, onEnd: () => void): number | undefined {
  const end = expiresAt ? Date.parse(expiresAt) : NaN
  const [left, setLeft] = useState<number | undefined>(undefined)
  const onEndRef = useRef(onEnd)
  useEffect(() => {
    onEndRef.current = onEnd
  })
  useEffect(() => {
    if (Number.isNaN(end)) return setLeft(undefined)
    let ended = false
    const tick = () => {
      const s = Math.max(0, Math.ceil((end - Date.now()) / 1000))
      setLeft(s)
      if (s === 0 && !ended) {
        ended = true
        onEndRef.current()
      }
    }
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [end])
  return left
}

/** Mobile offers Pay with Paystrater and Transfer to Pay; an agent payment is the merchant's to hand to the agent */
const MOBILE_METHODS: PaymentMethod[] = ["pay_with_paystrater", "transfer_to_pay"]

export function PaystraterCheckout(props: PaystraterCheckoutProps) {
  const own = usePaystraterPayment(props.paymentId, { ...props, disabled: Boolean(props.checkout) })
  const c = props.checkout ?? own
  const scheme = useColorScheme()
  const theme = useMemo(() => themeFor(props.appearance, scheme === "dark"), [props.appearance, scheme])
  const t = useMemo(() => stringsFor(props.locale, props.strings), [props.locale, props.strings])
  const s = useMemo(() => makeStyles(theme), [theme])
  const openUrl = props.openUrl ?? ((url: string) => Linking.openURL(url))

  // Screen readers hear each new step
  const lastStage = useRef(c.stage)
  useEffect(() => {
    if (lastStage.current === c.stage) return
    lastStage.current = c.stage
    const text = announce(c, t)
    if (text) AccessibilityInfo.announceForAccessibility(text)
  }, [c, t])

  const p = c.payment
  const merchant = p?.merchantName || "the shop"
  const errorText = (e?: PaystraterError) => (e ? errorForPayer(e, c.mode) : undefined)
  const ctx: Ctx = { c, t, s, theme, merchant, errorText, openUrl, onStartAgain: props.onStartAgain }

  return (
    <View style={[s.root, props.style]} accessibilityLabel={p ? fill(t.payTo, { merchant }) : t.loading}>
      {c.mode === "test" && (
        <Text style={s.ribbon} accessibilityLabel={t.testModeHint}>
          {t.testMode}
        </Text>
      )}
      {p && <Header payment={p} ctx={ctx} />}
      <Body ctx={ctx} />
    </View>
  )
}

interface Ctx {
  c: PaystraterPayment
  t: Strings
  s: ReturnType<typeof makeStyles>
  theme: PaystraterTheme
  merchant: string
  errorText: (e?: PaystraterError) => string | undefined
  openUrl: (url: string) => Promise<unknown>
  onStartAgain?: () => void
}

function announce(c: PaystraterPayment, t: Strings): string {
  if (c.stage === "processing") return t.statusProcessing
  if (c.stage === "final") return c.status === "succeeded" ? t.statusSucceeded : c.underpaid ? t.statusUnderpaid : c.late ? t.statusLate : c.status === "expired" ? t.statusExpired : c.status === "cancelled" ? t.statusCancelled : t.statusFailed
  return ""
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("")
}

function Header({ payment, ctx }: { payment: CheckoutPayment; ctx: Ctx }) {
  const { s, t } = ctx
  const [logoFailed, setLogoFailed] = useState(false)
  const name = payment.merchantName || ""
  return (
    <View style={s.header}>
      <View style={s.row}>
        {payment.merchantLogoUrl && !logoFailed ? (
          <Image source={{ uri: payment.merchantLogoUrl }} style={s.logo} accessibilityIgnoresInvertColors onError={() => setLogoFailed(true)} />
        ) : (
          <View style={s.logo} importantForAccessibility="no">
            <Text style={s.strong}>{initials(name) || "₱"}</Text>
          </View>
        )}
        <View style={s.grow}>
          <Text style={s.strong}>{name}</Text>
          {payment.description ? <Text style={s.muted}>{payment.description}</Text> : null}
        </View>
      </View>
      <Text style={s.label}>{t.amountDue}</Text>
      <Text style={s.amount} accessibilityLabel={`${payment.amount} ${payment.tokenTicker}`}>
        {formatAmount(payment.amount)}
        <Text style={s.token}>
          {"  "}
          {payment.tokenTicker}
          {payment.chainName ? ` · ${payment.chainName}` : ""}
        </Text>
      </Text>
    </View>
  )
}

function Button({ ctx, label, onPress, kind = "primary", disabled }: { ctx: Ctx; label: string; onPress: () => void; kind?: "primary" | "secondary" | "link"; disabled?: boolean }) {
  const { s } = ctx
  const box = kind === "primary" ? s.primary : kind === "secondary" ? s.secondary : s.link
  const text = kind === "primary" ? s.primaryText : kind === "secondary" ? s.secondaryText : s.linkText
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [box, pressed && !disabled ? s.pressed : null, disabled ? s.disabled : null]}
    >
      <Text style={text}>{label}</Text>
    </Pressable>
  )
}

function Field({ ctx, label, optional, help, error, ...input }: { ctx: Ctx; label: string; optional?: boolean; help?: string; error?: string } & React.ComponentProps<typeof TextInput>) {
  const { s, t, theme } = ctx
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>
        {label}
        {optional ? <Text style={s.muted}> ({t.optional})</Text> : null}
      </Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error ?? help}
        placeholderTextColor={theme.colors.colorTextMuted}
        style={[s.input, error ? s.inputError : null]}
        {...input}
      />
      {help ? <Text style={s.muted}>{help}</Text> : null}
      {error ? (
        <Text style={s.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  )
}

function Body({ ctx }: { ctx: Ctx }) {
  const { c, t, s, errorText } = ctx
  const title = (text: string) => (
    <Text style={s.title} accessibilityRole="header">
      {text}
    </Text>
  )
  const methods = c.methods.filter((m) => MOBILE_METHODS.includes(m))
  const actionError = c.error ? (
    <Text style={s.alert} accessibilityRole="alert" accessibilityLiveRegion="assertive">
      {errorText(c.error)}
    </Text>
  ) : null
  const back = methods.length > 1 && !c.payment?.method ? <Button ctx={ctx} kind="link" label={t.back} onPress={c.back} /> : null

  const problem = (
    <View style={s.stack}>
      {title(t.errorTitle)}
      <Text style={s.alert} accessibilityRole="alert">
        {errorText(c.error)}
      </Text>
      {c.error && (c.error.kind === "network" || c.error.kind === "timeout" || c.error.status >= 500) ? <Button ctx={ctx} kind="secondary" label={t.tryAgain} onPress={c.refresh} /> : null}
    </View>
  )

  switch (c.stage) {
    case "loading":
      // The first read failed: say so, and keep trying behind the message
      return c.error ? problem : <ActivityIndicator accessibilityLabel={t.loading} color={ctx.theme.colors.colorPrimary} />
    case "unavailable":
      return problem
    case "methods":
      return (
        <View style={s.stack}>
          {title(t.chooseMethod)}
          {methods.map((m) => (
            <Pressable key={m} accessibilityRole="button" onPress={() => c.choose(m)} style={({ pressed }) => [s.method, pressed ? s.pressed : null]}>
              <Text style={s.strong}>{m === "pay_with_paystrater" ? t.methodPayWithPaystrater : t.methodTransferToPay}</Text>
              <Text style={s.muted}>
                {m === "pay_with_paystrater" ? t.methodPayWithPaystraterHint : fill(t.methodTransferToPayHint, { chains: c.chains.map((x) => x.chainName).join(", ") })}
              </Text>
            </Pressable>
          ))}
          {actionError}
        </View>
      )
    case "pay_with_paystrater":
      return <PayWithPaystrater ctx={ctx} title={title} actionError={actionError} back={back} />
    case "transfer_to_pay":
      return c.deposit ? <DepositView ctx={ctx} deposit={c.deposit} title={title} actionError={actionError} /> : <TransferForm ctx={ctx} title={title} actionError={actionError} back={back} />
    case "agentic":
      return (
        <View style={s.stack}>
          {title(t.agentTitle)}
          <Text style={s.muted}>{t.agentHint}</Text>
          {c.payment?.agentPrompt ? (
            <>
              <Text selectable style={[s.well, s.mono]}>
                {c.payment.agentPrompt}
              </Text>
              <Button ctx={ctx} kind="secondary" label={t.copyPrompt} onPress={() => void Share.share({ message: c.payment!.agentPrompt! })} />
            </>
          ) : null}
        </View>
      )
    case "processing":
    case "updating":
      return (
        <View style={s.result}>
          <ActivityIndicator color={ctx.theme.colors.colorPrimary} />
          {title(c.stage === "processing" ? t.statusProcessing : t.statusUnknown)}
          {c.stage === "processing" ? <Text style={s.muted}>{t.statusProcessingHint}</Text> : null}
        </View>
      )
    case "final":
      return <Result ctx={ctx} title={title} />
  }
}

interface StepProps {
  ctx: Ctx
  title: (text: string) => ReactNode
  actionError: ReactNode
  back?: ReactNode
}

function PayWithPaystrater({ ctx, title, actionError, back }: StepProps) {
  const { c, t, s } = ctx
  const [payer, setPayer] = useState("")
  const [problem, setProblem] = useState<FieldProblem>()
  const left = useCountdown(c.payment?.payer ? c.payment.expiresAt : undefined, c.refresh)
  const sent = c.payment?.payer
  const link = c.payment ? APP_LINK + c.payment.id : ""

  if (sent) {
    return (
      <View style={s.stack}>
        {title(t.approveInApp)}
        {sent.name ? <Text style={s.note}>{fill(t.sentTo, { name: sent.name })}</Text> : null}
        <Text style={s.muted}>{t.approveInAppHint}</Text>
        <Button ctx={ctx} label={t.openApp} onPress={() => void ctx.openUrl(link)} />
        {left !== undefined ? <Text style={s.muted}>{left > 0 ? fill(t.expiresIn, { time: formatDuration(left) }) : t.expired}</Text> : null}
        <Text style={s.muted}>{t.wrongAccount}</Text>
        {actionError}
      </View>
    )
  }
  return (
    <View style={s.stack}>
      {title(t.methodPayWithPaystrater)}
      <Field ctx={ctx} label={t.payerLabel} help={t.payerHelp} error={problem === "payerRequired" ? t.payerRequired : undefined} value={payer} onChangeText={setPayer} maxLength={100} autoCapitalize="none" autoCorrect={false} textContentType="username" />
      {actionError}
      <Button
        ctx={ctx}
        label={t.sendRequest}
        disabled={c.busy}
        onPress={async () => {
          const res = await c.payWithPaystrater(payer)
          setProblem(res.ok ? undefined : res.field)
          // Hand off to the Paystrater app; without the app the link opens the web page with store links
          if (res.ok && link) void ctx.openUrl(link).catch(() => undefined)
        }}
      />
      {back}
    </View>
  )
}

function TransferForm({ ctx, title, actionError, back }: StepProps) {
  const { c, t, s } = ctx
  const [chainId, setChainId] = useState<number | undefined>(c.chains.length === 1 ? c.chains[0]!.chainId : undefined)
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [refund, setRefund] = useState("")
  const [problem, setProblem] = useState<FieldProblem>()
  const chosen = chainId ?? (c.chains.length === 1 ? c.chains[0]!.chainId : undefined)

  return (
    <View style={s.stack}>
      {title(t.methodTransferToPay)}
      {c.chains.length > 1 ? (
        <View style={s.field}>
          <Text style={s.label}>{t.chooseChain}</Text>
          <View style={s.chains} accessibilityRole="radiogroup">
            {c.chains.map((ch) => (
              <Pressable
                key={ch.chainId}
                accessibilityRole="radio"
                accessibilityState={{ checked: chosen === ch.chainId }}
                onPress={() => setChainId(ch.chainId)}
                style={[s.chain, chosen === ch.chainId ? s.chainOn : null]}
              >
                <Text style={s.strong}>{ch.chainName}</Text>
              </Pressable>
            ))}
          </View>
          {problem === "chain" ? <Text style={s.error}>{t.chooseChain}</Text> : null}
        </View>
      ) : null}
      <Field ctx={ctx} label={t.emailLabel} optional help={t.emailHelp} error={problem === "email" ? t.emailFormat : undefined} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" maxLength={120} />
      <Field ctx={ctx} label={t.nameLabel} optional value={name} onChangeText={setName} autoComplete="name" maxLength={120} />
      <Field
        ctx={ctx}
        label={t.refundAddressLabel}
        optional
        help={t.refundAddressHelp}
        error={problem === "refundAddressFormat" ? t.refundAddressFormat : problem === "refundAddressChecksum" ? t.refundAddressChecksum : undefined}
        value={refund}
        onChangeText={setRefund}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="0x…"
        maxLength={64}
      />
      {actionError}
      <Button
        ctx={ctx}
        label={t.getAddress}
        disabled={c.busy}
        onPress={async () => {
          if (chosen === undefined) return setProblem("chain")
          const res = await c.startDeposit(chosen, { email, name, refundAddress: refund })
          setProblem(res.ok ? undefined : res.field)
        }}
      />
      {back}
    </View>
  )
}

function DepositView({ ctx, deposit, title, actionError }: Omit<StepProps, "back"> & { deposit: Deposit }) {
  const { c, t, s } = ctx
  const left = useCountdown(deposit.expiresAt, c.refresh)
  const [details, setDetails] = useState(false)
  const [walletReady, setWalletReady] = useState(false)
  const chain = deposit.chainName ?? ""
  const link = deposit.chainId
    ? walletLink({ tokenAddress: deposit.tokenAddress, tokenDecimals: deposit.tokenDecimals, chainId: deposit.chainId, depositAddress: deposit.depositAddress, amount: deposit.amount })
    : undefined

  // "Open in wallet" only when an installed app can open an ethereum: link
  useEffect(() => {
    if (!link) return setWalletReady(false)
    let live = true
    Linking.canOpenURL(link).then(
      (yes) => live && setWalletReady(yes),
      () => live && setWalletReady(false)
    )
    return () => {
      live = false
    }
  }, [link])

  return (
    <View style={s.stack}>
      {title(fill(t.sendExactly, { amount: formatAmount(deposit.amount), token: deposit.tokenTicker, chain }))}
      {deposit.fee && isPositiveAmount(deposit.fee) ? <Text style={s.muted}>{fill(t.fee, { fee: formatAmount(deposit.fee), token: deposit.tokenTicker })}</Text> : null}
      <View style={s.well}>
        <Text style={s.label}>{t.depositAddress}</Text>
        {/* Selectable instead of a clipboard package: the clipboard left React Native core */}
        <Text selectable style={s.mono} accessibilityLabel={`${t.depositAddress}: ${deposit.depositAddress}`}>
          {deposit.depositAddress}
        </Text>
        <Text selectable style={s.muted}>
          {formatAmount(deposit.amount)} {deposit.tokenTicker}
        </Text>
      </View>
      <Text style={s.muted}>{t.selectToCopy}</Text>
      <Button ctx={ctx} kind="secondary" label={t.shareAddress} onPress={() => void Share.share({ message: deposit.depositAddress })} />
      {walletReady && link ? <Button ctx={ctx} label={t.openInWallet} onPress={() => void ctx.openUrl(link)} /> : null}
      <Text style={s.note}>{fill(t.depositNotice, { token: deposit.tokenTicker, chain })}</Text>
      {isPositiveAmount(deposit.receivedAmount) ? <Text style={s.muted}>{fill(t.received, { amount: formatAmount(deposit.receivedAmount!), token: deposit.tokenTicker })}</Text> : null}
      <View style={s.rowBetween}>
        <View style={s.row}>
          <ActivityIndicator size="small" color={ctx.theme.colors.colorPrimary} />
          <Text style={s.muted} accessibilityLiveRegion="polite">
            {t.waitingForDeposit}
          </Text>
        </View>
        {left !== undefined ? <Text style={s.muted}>{left > 0 ? fill(t.expiresIn, { time: formatDuration(left) }) : t.expired}</Text> : null}
      </View>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: details }} onPress={() => setDetails((d) => !d)} style={s.disclosure}>
        <Text style={s.linkText}>{t.paymentDetails}</Text>
      </Pressable>
      {details ? (
        <View style={s.details}>
          {deposit.tokenAddress ? (
            <>
              <Text style={s.label}>{t.tokenContract}</Text>
              <Text selectable style={s.mono}>
                {deposit.tokenAddress}
              </Text>
            </>
          ) : null}
          <Text style={s.label}>{t.network}</Text>
          <Text style={s.body}>{chain}</Text>
          {deposit.chainId !== undefined ? (
            <>
              <Text style={s.label}>{t.chainId}</Text>
              <Text selectable style={s.body}>
                {String(deposit.chainId)}
              </Text>
            </>
          ) : null}
        </View>
      ) : null}
      {actionError}
    </View>
  )
}

function Result({ ctx, title }: { ctx: Ctx; title: (text: string) => ReactNode }) {
  const { c, t, s, merchant } = ctx
  const p = c.payment!
  const excess = p.transferToPay?.excessRefunded
  let heading: string = t.statusFailed
  let hint: string | undefined = p.failureReason
  let mark = "!"
  let tone: TextStyle = s.markBad
  if (p.status === "succeeded") {
    heading = t.statusSucceeded
    hint = isPositiveAmount(excess) ? fill(t.excessRefunded, { amount: formatAmount(excess!), token: p.tokenTicker }) : fill(t.statusSucceededHint, { merchant })
    mark = "✓"
    tone = s.markOk
  } else if (c.underpaid) {
    heading = t.statusUnderpaid
    hint = t.statusUnderpaidHint
  } else if (c.late) {
    heading = t.statusLate
    hint = t.statusLateHint
    tone = s.markNeutral
  } else if (p.status === "expired") {
    heading = t.statusExpired
    hint = fill(t.statusExpiredHint, { merchant })
    tone = s.markNeutral
  } else if (p.status === "cancelled") {
    heading = t.statusCancelled
    hint = fill(t.statusCancelledHint, { merchant })
    tone = s.markNeutral
  } else if (p.status === "refunded") {
    heading = t.statusRefunded
    hint = undefined
    tone = s.markNeutral
  }
  return (
    <View style={s.result}>
      <Text style={[s.mark, tone]} importantForAccessibility="no">
        {mark}
      </Text>
      {title(heading)}
      {hint ? <Text style={[s.muted, s.center]}>{hint}</Text> : null}
      {p.status === "expired" && !c.underpaid && !c.late && ctx.onStartAgain ? <Button ctx={ctx} kind="secondary" label={t.startAgain} onPress={ctx.onStartAgain} /> : null}
    </View>
  )
}

function makeStyles(theme: PaystraterTheme) {
  const k = theme.colors
  const font = theme.fontFamily ? { fontFamily: theme.fontFamily } : null
  const mono = theme.fontFamilyMono ? { fontFamily: theme.fontFamilyMono } : null
  const control = { minHeight: 44, borderRadius: theme.borderRadius, alignItems: "center" as const, justifyContent: "center" as const, paddingHorizontal: 16 }
  return StyleSheet.create({
    root: { backgroundColor: k.colorBackground, borderColor: k.colorBorder, borderWidth: 1, borderRadius: theme.borderRadiusSurface, padding: 20, overflow: "hidden" },
    ribbon: { position: "absolute", top: 0, right: 0, paddingHorizontal: 10, paddingVertical: 3, fontSize: 12, fontWeight: "600", color: k.colorWarning, backgroundColor: k.colorSurface, borderBottomLeftRadius: theme.borderRadius, ...font },
    header: { gap: 4, marginBottom: 20 },
    row: { flexDirection: "row", alignItems: "center", gap: 10 },
    rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
    grow: { flex: 1 },
    logo: { width: 40, height: 40, borderRadius: theme.borderRadius, borderWidth: 1, borderColor: k.colorBorder, backgroundColor: k.colorSurface, alignItems: "center", justifyContent: "center", marginBottom: 8 },
    label: { fontSize: 13, color: k.colorTextMuted, ...font },
    amount: { fontSize: 28, fontWeight: "600", color: k.colorText, ...mono },
    token: { fontSize: 15, fontWeight: "400", color: k.colorTextMuted, ...font },
    strong: { fontSize: 15, fontWeight: "600", color: k.colorText, ...font },
    body: { fontSize: 15, color: k.colorTextBody, ...font },
    muted: { fontSize: 13, color: k.colorTextMuted, ...font },
    center: { textAlign: "center" },
    title: { fontSize: 17, fontWeight: "600", color: k.colorText, ...font },
    stack: { gap: 12 },
    method: { minHeight: 56, padding: 14, gap: 2, borderWidth: 1, borderColor: k.colorBorder, borderRadius: theme.borderRadiusSurface },
    primary: { ...control, backgroundColor: k.colorPrimary },
    primaryText: { fontSize: 15, fontWeight: "600", color: k.colorOnPrimary, ...font },
    secondary: { ...control, borderWidth: 1, borderColor: k.colorBorder, backgroundColor: k.colorBackground },
    secondaryText: { fontSize: 15, fontWeight: "600", color: k.colorText, ...font },
    link: { ...control, paddingHorizontal: 0 },
    linkText: { fontSize: 15, fontWeight: "500", color: k.colorPrimaryText, textDecorationLine: "underline", ...font },
    pressed: { opacity: 0.85 },
    disabled: { opacity: 0.6 },
    field: { gap: 6 },
    fieldLabel: { fontSize: 14, fontWeight: "500", color: k.colorText, ...font },
    input: { minHeight: 44, paddingHorizontal: 12, fontSize: 15, color: k.colorText, backgroundColor: k.colorBackground, borderWidth: 1, borderColor: k.colorBorder, borderRadius: theme.borderRadius, ...font },
    inputError: { borderColor: k.colorDanger },
    error: { fontSize: 13, color: k.colorDanger, ...font },
    alert: { padding: 12, fontSize: 14, color: k.colorDanger, borderWidth: 1, borderColor: k.colorDanger, borderRadius: theme.borderRadius, ...font },
    note: { padding: 12, fontSize: 13, color: k.colorTextBody, backgroundColor: k.colorPrimarySoft, borderRadius: theme.borderRadius, overflow: "hidden", ...font },
    chains: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chain: { ...control, borderWidth: 1, borderColor: k.colorBorder },
    chainOn: { borderColor: k.colorPrimary, backgroundColor: k.colorPrimarySoft },
    well: { gap: 6, padding: 14, backgroundColor: k.colorSurface, borderWidth: 1, borderColor: k.colorBorder, borderRadius: theme.borderRadiusSurface },
    mono: { fontSize: 14, color: k.colorText, ...mono },
    disclosure: { minHeight: 44, justifyContent: "center" },
    details: { gap: 4 },
    result: { alignItems: "center", gap: 10, paddingVertical: 12 },
    mark: { width: 44, height: 44, lineHeight: 40, borderRadius: 22, borderWidth: 2, textAlign: "center", fontSize: 22, fontWeight: "700", overflow: "hidden" },
    markOk: { color: k.colorSuccess, borderColor: k.colorSuccess },
    markBad: { color: k.colorDanger, borderColor: k.colorDanger },
    markNeutral: { color: k.colorTextMuted, borderColor: k.colorBorder }
  })
}

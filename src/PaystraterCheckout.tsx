// <PaystraterCheckout> for React Native: Pay with Paystrater
// hands off to the Paystrater app; Transfer to Pay shows the deposit with copy
// (the app's clipboard module, else selectable text and share) and, when a
// wallet can open it, an EIP-681 link.
// No QR: the payer is on this phone. No native modules: Linking, Share, AppState.
// It follows @paystrater/react's design (sdk-react src/react/styles.ts): a card
// with a hairline edge, method tiles with icons, pill buttons, the amount in the
// brand colour, "← <method>" under each step and "Powered by Paystrater" under all.
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
import { clipboardSetter } from "./optional/clipboard.js"
import { formatAmount, isPositiveAmount, walletLink } from "./core/amount.js"
import type { Deposit, FieldProblem } from "./core/checkout.js"
import { errorForPayer, type PaystraterError } from "./core/errors.js"
import { capitalizeWords, fill, fillParts, type Locale } from "./core/strings.js"
import { nativeStrings, type Strings } from "./strings.js"
import type { CheckoutPayment, PaymentMethod } from "./core/types.js"
import { ARROW_LEFT, CHEVRON, MARK, PAYSTRATER_SITE, SPARKLE, WALLET, WORDMARK } from "./brand.js"
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

/** The methods the checkout offers, in the payment's order, as on the web */
const MOBILE_METHODS: PaymentMethod[] = ["pay_with_paystrater", "transfer_to_pay", "agentic"]

export function PaystraterCheckout(props: PaystraterCheckoutProps) {
  const own = usePaystraterPayment(props.paymentId, { ...props, disabled: Boolean(props.checkout) })
  const c = props.checkout ?? own
  const scheme = useColorScheme()
  const theme = useMemo(() => themeFor(props.appearance, scheme === "dark"), [props.appearance, scheme])
  const t = useMemo(() => nativeStrings(props.locale, props.strings), [props.locale, props.strings])
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
  // Names are capitalized whatever case the data has (CSS capitalize on the web)
  const merchantName = p?.merchantName ? capitalizeWords(p.merchantName) : ""
  const merchant = merchantName || "the business"
  const errorText = (e?: PaystraterError) => (e ? errorForPayer(e, c.mode) : undefined)
  const ctx: Ctx = { c, t, s, theme, merchant, merchantName, errorText, openUrl, onStartAgain: props.onStartAgain }

  return (
    <View style={[s.root, props.style]} accessibilityLabel={p ? fill(t.payTo, { merchant }) : t.loading}>
      {c.mode === "test" && (
        <Text style={s.ribbon} accessibilityLabel={t.testModeHint}>
          {t.testMode}
        </Text>
      )}
      {p && <Header payment={p} ctx={ctx} />}
      <Body ctx={ctx} />
      <PoweredBy ctx={ctx} />
    </View>
  )
}

interface Ctx {
  c: PaystraterPayment
  t: Strings
  s: ReturnType<typeof makeStyles>
  theme: PaystraterTheme
  /** The merchant's name in capitals, or "the business" */
  merchant: string
  /** The merchant's name in capitals, or "" */
  merchantName: string
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

/** A sentence with every {name} value in capitals, the rest as written */
function named(template: string, values: Record<string, string | undefined>): string {
  return fillParts(template, values)
    .map((part) => (part.key && part.key !== "amount" && part.key !== "token" ? capitalizeWords(part.text) : part.text))
    .join("")
}

function Header({ payment, ctx }: { payment: CheckoutPayment; ctx: Ctx }) {
  const { s, t, merchantName } = ctx
  const [logoFailed, setLogoFailed] = useState(false)
  const description = payment.description ? payment.description.charAt(0).toUpperCase() + payment.description.slice(1) : ""
  return (
    <View style={s.header}>
      <View style={[s.row, s.headRow, ctx.c.mode === "test" ? s.headRowTest : null]}>
        {payment.merchantLogoUrl && !logoFailed ? (
          <Image source={{ uri: payment.merchantLogoUrl }} style={[s.logo, s.logoImage]} accessibilityIgnoresInvertColors onError={() => setLogoFailed(true)} />
        ) : (
          <View style={s.logo} importantForAccessibility="no">
            <Text style={s.initials}>{initials(merchantName) || "₱"}</Text>
          </View>
        )}
        <View style={s.grow}>
          <Text style={s.merchantName}>{merchantName}</Text>
          {description ? <Text style={s.muted}>{description}</Text> : null}
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

type ButtonKind = "primary" | "secondary" | "tonal"

function Button({ ctx, label, onPress, kind = "primary", disabled }: { ctx: Ctx; label: string; onPress: () => void; kind?: ButtonKind; disabled?: boolean }) {
  const { s } = ctx
  const box = kind === "primary" ? s.primary : kind === "secondary" ? s.secondary : s.tonal
  const text = kind === "primary" ? s.primaryText : kind === "secondary" ? s.secondaryText : s.tonalText
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
  const [focused, setFocused] = useState(false)
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>
        {label}
        {optional ? <Text style={s.optional}> ({t.optional})</Text> : null}
      </Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error ?? help}
        placeholderTextColor={theme.colors.colorTextSubtle}
        style={[s.input, focused ? s.inputFocus : null, error ? s.inputError : null]}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...input}
      />
      {help ? <Text style={s.help}>{help}</Text> : null}
      {error ? (
        <Text style={s.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  )
}

/** "← Pay with Paystrater" under a step: the method in use, and the way back to the others */
function BackRow({ ctx, method, canGoBack }: { ctx: Ctx; method: string; canGoBack: boolean }) {
  const { s, t, c, theme } = ctx
  if (!canGoBack) return <Text style={[s.backText, s.backStatic]}>{method}</Text>
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t.back}, ${method}`}
      onPress={c.back}
      hitSlop={{ top: 4, bottom: 4 }}
      style={({ pressed }) => [s.back, pressed ? s.backPressed : null]}
    >
      <Image source={ARROW_LEFT} style={[s.backArrow, { tintColor: theme.colors.colorTextMuted }]} accessibilityIgnoresInvertColors />
      <Text style={s.backText}>{method}</Text>
    </Pressable>
  )
}

/** "Powered by Paystrater" under every screen; it opens paystrater.com */
function PoweredBy({ ctx }: { ctx: Ctx }) {
  const { s, t, theme } = ctx
  return (
    <View style={s.footer}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${t.poweredBy} Paystrater`}
        onPress={() => void ctx.openUrl(PAYSTRATER_SITE).catch(() => undefined)}
        hitSlop={8}
        style={({ pressed }) => [s.powered, pressed ? s.pressed : null]}
      >
        <Text style={s.poweredText}>{t.poweredBy}</Text>
        <Image source={WORDMARK} style={[s.wordmark, { tintColor: theme.colors.colorTextMuted }]} accessibilityIgnoresInvertColors />
      </Pressable>
    </View>
  )
}

function MethodTile({ ctx, method, title, hint }: { ctx: Ctx; method: PaymentMethod; title: string; hint: string }) {
  const { s, c, theme } = ctx
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${hint}`} onPress={() => c.choose(method)} style={({ pressed }) => [s.method, pressed ? s.methodPressed : null]}>
      <View style={s.methodIcon}>
        <Image source={method === "pay_with_paystrater" ? MARK : method === "transfer_to_pay" ? WALLET : SPARKLE} style={[s.methodIconImage, { tintColor: theme.colors.colorPrimaryText }]} accessibilityIgnoresInvertColors />
      </View>
      <View style={s.grow}>
        <Text style={s.methodTitle}>{title}</Text>
        <Text style={s.methodHint}>{hint}</Text>
      </View>
      <Image source={CHEVRON} style={[s.chevron, { tintColor: theme.colors.colorTextMuted }]} accessibilityIgnoresInvertColors />
    </Pressable>
  )
}

function Body({ ctx }: { ctx: Ctx }) {
  const { c, t, s, errorText } = ctx
  // hidden: a method step names its method in the row at the bottom; the heading stays for screen readers
  const title = (text: string, hidden = false) => (
    <Text style={hidden ? s.hidden : s.title} accessibilityRole="header">
      {text}
    </Text>
  )
  const methods = c.methods.filter((m) => MOBILE_METHODS.includes(m))
  const actionError = c.error ? (
    <Text style={s.alert} accessibilityRole="alert" accessibilityLiveRegion="assertive">
      {errorText(c.error)}
    </Text>
  ) : null
  const canGoBack = methods.length > 1 && !c.payment?.method
  const back = (method: string) => <BackRow ctx={ctx} method={method} canGoBack={canGoBack} />

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
      return c.error ? problem : <ActivityIndicator accessibilityLabel={t.loading} color={ctx.theme.colors.colorPrimaryText} />
    case "unavailable":
      return problem
    case "methods":
      return (
        <View style={s.stack}>
          {title(t.chooseMethod)}
          <View style={s.methods}>
            {methods.map((m) => (
              <MethodTile
                key={m}
                ctx={ctx}
                method={m}
                title={m === "pay_with_paystrater" ? t.methodPayWithPaystrater : m === "transfer_to_pay" ? t.methodTransferToPay : t.methodAgentic}
                hint={
                  m === "pay_with_paystrater"
                    ? t.methodPayWithPaystraterHint
                    : m === "transfer_to_pay"
                      ? fill(t.methodTransferToPayHint, { chains: c.chains.map((x) => x.chainName).join(", ") })
                      : t.methodAgenticHint
                }
              />
            ))}
          </View>
          {actionError}
        </View>
      )
    case "pay_with_paystrater":
      return <PayWithPaystrater ctx={ctx} title={title} actionError={actionError} back={back} />
    case "transfer_to_pay":
      return c.deposit ? <DepositView ctx={ctx} deposit={c.deposit} title={title} actionError={actionError} /> : <TransferForm ctx={ctx} title={title} actionError={actionError} back={back} />
    case "agentic":
      return <Agent ctx={ctx} title={title} actionError={actionError} back={back} />
    case "processing":
    case "updating":
      return (
        <View style={s.result}>
          <ActivityIndicator color={ctx.theme.colors.colorPrimaryText} />
          {title(c.stage === "processing" ? t.statusProcessing : t.statusUnknown)}
          {c.stage === "processing" ? <Text style={[s.muted, s.center]}>{t.statusProcessingHint}</Text> : null}
        </View>
      )
    case "final":
      return <Result ctx={ctx} title={title} />
  }
}

interface StepProps {
  ctx: Ctx
  title: (text: string, hidden?: boolean) => ReactNode
  actionError: ReactNode
  back: (method: string) => ReactNode
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
        {sent.name ? <Text style={s.note}>{named(t.sentTo, { name: sent.name })}</Text> : null}
        <Text style={s.muted}>{t.approveInAppHint}</Text>
        <Button ctx={ctx} label={t.openApp} onPress={() => void ctx.openUrl(link).catch(() => undefined)} />
        {left !== undefined ? <Text style={s.muted}>{left > 0 ? fill(t.expiresIn, { time: formatDuration(left) }) : t.expired}</Text> : null}
        <Text style={s.muted}>{t.wrongAccount}</Text>
        {actionError}
      </View>
    )
  }
  return (
    <View style={s.stack}>
      {title(t.methodPayWithPaystrater, true)}
      <Field ctx={ctx} label={t.payerLabel} help={t.payerHelp} error={problem === "payerRequired" ? t.payerRequired : undefined} value={payer} onChangeText={setPayer} maxLength={100} autoCapitalize="none" autoCorrect={false} textContentType="username" />
      {actionError}
      <Button
        ctx={ctx}
        label={t.sendRequest}
        disabled={c.busy}
        onPress={async () => {
          const res = await c.payWithPaystrater(payer)
          // The request is sent; the Paystrater app opens only when the customer taps "Open the Paystrater app"
          setProblem(res.ok ? undefined : res.field)
        }}
      />
      {back(t.methodPayWithPaystrater)}
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
      {title(t.methodTransferToPay, true)}
      {c.chains.length > 1 ? (
        <View style={s.field}>
          <Text style={s.fieldLabel}>{t.chooseChain}</Text>
          <View style={s.chains} accessibilityRole="radiogroup">
            {c.chains.map((ch) => (
              <Pressable
                key={ch.chainId}
                accessibilityRole="radio"
                accessibilityState={{ checked: chosen === ch.chainId }}
                onPress={() => setChainId(ch.chainId)}
                style={({ pressed }) => [s.chain, pressed ? s.methodPressed : null, chosen === ch.chainId ? s.chainOn : null]}
              >
                <Text style={chosen === ch.chainId ? s.chainTextOn : s.chainText}>{ch.chainName}</Text>
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
      {back(t.methodTransferToPay)}
    </View>
  )
}

/** An AI agent payment: Continue gets the prompt (POST /v1/checkout/agentic), which the customer shares with their agent */
function Agent({ ctx, title, actionError, back }: StepProps) {
  const { c, t, s } = ctx
  const prompt = c.payment?.agentPrompt
  if (prompt) {
    return (
      <View style={s.stack}>
        {title(t.agentTitle)}
        <Text style={s.muted}>{t.agentHint}</Text>
        <Text selectable style={[s.well, s.mono]}>
          {prompt}
        </Text>
        <CopyButton ctx={ctx} value={prompt} label={t.copyPrompt} shareLabel={t.sharePrompt} />
        {actionError}
      </View>
    )
  }
  return (
    <View style={s.stack}>
      {title(t.agentTitle, true)}
      <Text style={s.muted}>{t.agentHint}</Text>
      {actionError}
      <Button ctx={ctx} label={t.continue} disabled={c.busy} onPress={() => void c.startAgentic()} />
      {back(t.methodAgentic)}
    </View>
  )
}

/** Copies with the app's clipboard module, and says "Copied"; without one it opens the share sheet */
function CopyButton({ ctx, value, label, shareLabel }: { ctx: Ctx; value: string; label: string; shareLabel: string }) {
  const [done, setDone] = useState(false)
  const copy = clipboardSetter()
  if (!copy) return <Button ctx={ctx} kind="tonal" label={shareLabel} onPress={() => void Share.share({ message: value }).catch(() => undefined)} />
  return <Button ctx={ctx} kind="tonal" label={done ? ctx.t.copied : label} onPress={() => void copy(value).then(() => (setDone(true), setTimeout(setDone, 2000, false)), () => undefined)} />
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
        {/* Selectable too, for apps without a clipboard module (see optional/clipboard.js) */}
        <Text selectable style={s.mono} accessibilityLabel={`${t.depositAddress}: ${deposit.depositAddress}`}>
          {deposit.depositAddress}
        </Text>
        <Text selectable style={[s.body, { fontWeight: "700" }]}>
          {formatAmount(deposit.amount)} {deposit.tokenTicker}
        </Text>
        {clipboardSetter() ? null : <Text style={s.help}>{t.selectToCopy}</Text>}
        <CopyButton ctx={ctx} value={deposit.depositAddress} label={t.copyAddress} shareLabel={t.shareAddress} />
        {/* The exact amount the server asked for, every decimal and no symbol */}
        <CopyButton ctx={ctx} value={deposit.amount} label={t.copyAmount} shareLabel={t.shareAmount} />
      </View>
      {walletReady && link ? <Button ctx={ctx} label={t.openInWallet} onPress={() => void ctx.openUrl(link)} /> : null}
      <Text style={s.note}>{fill(t.depositNotice, { token: deposit.tokenTicker, chain })}</Text>
      {isPositiveAmount(deposit.receivedAmount) ? <Text style={s.muted}>{fill(t.received, { amount: formatAmount(deposit.receivedAmount!), token: deposit.tokenTicker })}</Text> : null}
      <View style={s.rowBetween}>
        <View style={[s.row, s.grow]}>
          <ActivityIndicator size="small" color={ctx.theme.colors.colorPrimaryText} />
          <Text style={[s.muted, s.grow]} accessibilityLiveRegion="polite">
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
      {hint ? <Text style={[s.muted, s.center]}>{hint.charAt(0).toUpperCase() + hint.slice(1)}</Text> : null}
      {p.status === "expired" && !c.underpaid && !c.late && ctx.onStartAgain ? <Button ctx={ctx} kind="secondary" label={t.startAgain} onPress={ctx.onStartAgain} /> : null}
    </View>
  )
}

/** The web checkout's stylesheet (sdk-react src/react/styles.ts) in React Native */
function makeStyles(theme: PaystraterTheme) {
  const k = theme.colors
  const font = theme.fontFamily ? { fontFamily: theme.fontFamily } : null
  const mono = theme.fontFamilyMono ? { fontFamily: theme.fontFamilyMono } : null
  const pill = { borderRadius: theme.borderRadiusButton, alignItems: "center" as const, justifyContent: "center" as const }
  return StyleSheet.create({
    root: { backgroundColor: k.colorBackground, borderColor: k.colorBorder, borderWidth: 1, borderRadius: theme.borderRadiusCard, padding: 20, overflow: "hidden" },
    ribbon: { position: "absolute", top: 12, right: 12, zIndex: 1, paddingHorizontal: 8, paddingVertical: 3, fontSize: 11, lineHeight: 16, fontWeight: "500", color: k.colorWarning, backgroundColor: k.colorSurfaceHover, borderRadius: 11, overflow: "hidden", ...font },
    header: { gap: 4, marginBottom: 20 },
    row: { flexDirection: "row", alignItems: "center", gap: 10 },
    headRow: { gap: 12, marginBottom: 20 },
    headRowTest: { paddingRight: 72 },
    rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
    grow: { flex: 1 },
    logo: { width: 40, height: 40, borderRadius: 13, backgroundColor: k.colorPrimarySoft, alignItems: "center", justifyContent: "center", overflow: "hidden" },
    logoImage: { backgroundColor: k.colorSurface, borderWidth: 1, borderColor: k.colorBorder },
    initials: { fontSize: 14, fontWeight: "600", color: k.colorPrimaryText, ...font },
    merchantName: { fontSize: 16, lineHeight: 24, fontWeight: "600", color: k.colorText, ...font },
    label: { fontSize: 12, lineHeight: 16, fontWeight: "500", color: k.colorTextMuted, ...font },
    amount: { fontSize: 26, lineHeight: 34, fontWeight: "700", color: k.colorPrimaryText, ...mono },
    token: { fontSize: 14, fontWeight: "500", color: k.colorTextMuted, ...font },
    body: { fontSize: 15, lineHeight: 22, color: k.colorTextBody, ...font },
    muted: { fontSize: 13, lineHeight: 18, color: k.colorTextMuted, ...font },
    help: { fontSize: 12, lineHeight: 16, color: k.colorTextMuted, ...font },
    center: { textAlign: "center" },
    title: { fontSize: 18, lineHeight: 26, fontWeight: "600", color: k.colorText, ...font },
    hidden: { position: "absolute", width: 1, height: 1, opacity: 0 },
    stack: { gap: 12 },
    methods: { gap: 8 },
    method: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12, paddingLeft: 14, paddingRight: 16, borderWidth: 1, borderColor: k.colorBorder, borderRadius: theme.borderRadiusSurface, backgroundColor: k.colorBackground },
    methodPressed: { backgroundColor: k.colorSurfaceHover, borderColor: k.colorBorderStrong },
    methodIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: k.colorPrimarySoft, alignItems: "center", justifyContent: "center" },
    methodIconImage: { width: 20, height: 20 },
    methodTitle: { fontSize: 14, lineHeight: 20, fontWeight: "600", color: k.colorText, ...font },
    methodHint: { marginTop: 2, fontSize: 12, lineHeight: 16, color: k.colorTextMuted, ...font },
    chevron: { width: 16, height: 16 },
    primary: { ...pill, minHeight: 48, paddingHorizontal: 24, backgroundColor: k.colorPrimary },
    primaryText: { fontSize: 14, fontWeight: "500", color: k.colorOnPrimary, ...font },
    secondary: { ...pill, minHeight: 40, paddingHorizontal: 20, borderWidth: 1, borderColor: k.colorBorderStrong },
    secondaryText: { fontSize: 14, fontWeight: "500", color: k.colorText, ...font },
    tonal: { ...pill, minHeight: 36, paddingHorizontal: 16, alignSelf: "flex-start", backgroundColor: k.colorPrimarySoft },
    tonalText: { fontSize: 13, fontWeight: "500", color: k.colorPrimaryText, ...font },
    linkText: { fontSize: 13, fontWeight: "500", color: k.colorPrimaryText, ...font },
    pressed: { opacity: 0.85 },
    disabled: { opacity: 0.5 },
    back: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 6, minHeight: 32, marginLeft: -10, paddingHorizontal: 10, borderRadius: theme.borderRadiusButton },
    backPressed: { backgroundColor: k.colorSurfaceHover },
    backArrow: { width: 14, height: 14 },
    backText: { fontSize: 13, lineHeight: 18, fontWeight: "500", color: k.colorTextMuted, ...font },
    backStatic: { alignSelf: "flex-start" },
    footer: { marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: k.colorBorder, alignItems: "center" },
    powered: { flexDirection: "row", alignItems: "center", gap: 7, minHeight: 24, paddingHorizontal: 8 },
    poweredText: { fontSize: 12, lineHeight: 16, color: k.colorTextSubtle, ...font },
    wordmark: { width: (15 * 258) / 45, height: 15 },
    field: { gap: 6 },
    fieldLabel: { fontSize: 13, lineHeight: 18, fontWeight: "500", color: k.colorText, ...font },
    optional: { fontSize: 12, fontWeight: "400", color: k.colorTextMuted, ...font },
    input: { minHeight: 48, paddingHorizontal: 16, fontSize: 14, color: k.colorText, backgroundColor: k.colorBackground, borderWidth: 1, borderColor: k.colorBorder, borderRadius: theme.borderRadius, ...font },
    inputFocus: { borderColor: k.colorPrimaryText },
    inputError: { borderColor: k.colorDanger },
    error: { fontSize: 12, lineHeight: 16, color: k.colorDanger, ...font },
    alert: { paddingVertical: 12, paddingHorizontal: 14, fontSize: 13, lineHeight: 18, color: k.colorDanger, backgroundColor: k.colorDangerSoft, borderRadius: 13, overflow: "hidden", ...font },
    note: { paddingVertical: 12, paddingHorizontal: 14, fontSize: 13, lineHeight: 18, color: k.colorTextBody, backgroundColor: k.colorPrimarySoft, borderRadius: 13, overflow: "hidden", ...font },
    chains: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chain: { ...pill, minHeight: 40, paddingHorizontal: 16, borderWidth: 1, borderColor: k.colorBorder, backgroundColor: k.colorBackground },
    chainOn: { borderColor: k.colorPrimaryText, backgroundColor: k.colorPrimarySoft },
    chainText: { fontSize: 13, fontWeight: "500", color: k.colorText, ...font },
    chainTextOn: { fontSize: 13, fontWeight: "500", color: k.colorPrimaryText, ...font },
    well: { gap: 8, padding: 16, backgroundColor: k.colorSurface, borderWidth: 1, borderColor: k.colorBorder, borderRadius: theme.borderRadiusSurface, overflow: "hidden" },
    mono: { fontSize: 13, lineHeight: 20, color: k.colorText, ...mono },
    disclosure: { minHeight: 40, justifyContent: "center", alignSelf: "flex-start" },
    details: { gap: 4 },
    result: { alignItems: "center", gap: 10, paddingTop: 16, paddingBottom: 8 },
    mark: { width: 52, height: 52, lineHeight: 52, borderRadius: 26, textAlign: "center", fontSize: 22, fontWeight: "700", overflow: "hidden" },
    markOk: { color: k.colorSuccess, backgroundColor: k.colorSuccessSoft },
    markBad: { color: k.colorDanger, backgroundColor: k.colorDangerSoft },
    markNeutral: { color: k.colorTextMuted, backgroundColor: k.colorSurfaceHover }
  })
}

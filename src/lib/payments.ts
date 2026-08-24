export const CURRENCY_CODE = "USD"

const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: CURRENCY_CODE,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Formatea centavos como moneda: 120050 -> "$1,200.50" */
export function formatMoney(cents: number): string {
  return moneyFormatter.format((cents || 0) / 100)
}

/**
 * Convierte lo que el usuario escribe a centavos. Tolera "$1.200,50",
 * "1,200.50", "1200", " 1 200 ". Devuelve null si no hay un número válido.
 */
export function parseAmountToCents(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.,-]/g, "").trim()
  if (!cleaned) return null

  const lastDot = cleaned.lastIndexOf(".")
  const lastComma = cleaned.lastIndexOf(",")
  let normalized: string

  if (lastDot === -1 && lastComma === -1) {
    normalized = cleaned
  } else if (lastComma > lastDot) {
    // formato es-EC: 1.200,50
    normalized = cleaned.replace(/\./g, "").replace(",", ".")
  } else {
    // formato en-US: 1,200.50
    normalized = cleaned.replace(/,/g, "")
  }

  const value = Number(normalized)
  if (!Number.isFinite(value)) return null
  return Math.round(value * 100)
}

export type PaymentState = "UNPRICED" | "PENDING" | "PARTIAL" | "PAID"

export type PaymentKind = "PAYMENT" | "WITHHOLDING" | "ADJUSTMENT"

export const paymentKinds = ["PAYMENT", "WITHHOLDING", "ADJUSTMENT"] as const

export const paymentKindLabels: Record<PaymentKind, string> = {
  PAYMENT: "Cobro",
  WITHHOLDING: "Retención",
  ADJUSTMENT: "Ajuste",
}

/** Explica en la interfaz por qué un movimiento cierra saldo sin ser plata. */
export const paymentKindHints: Record<PaymentKind, string> = {
  PAYMENT: "Plata que entró.",
  WITHHOLDING: "Retención en la fuente o de IVA: cierra saldo pero no entra a la cuenta.",
  ADJUSTMENT: "Descuento, condonación o corrección acordada.",
}

export function isPaymentKind(value: unknown): value is PaymentKind {
  return value === "PAYMENT" || value === "WITHHOLDING" || value === "ADJUSTMENT"
}

export interface PaymentLike {
  amountCents: number
  /** Ausente equivale a PAYMENT: así los registros viejos siguen valiendo. */
  kind?: string | null
}

export interface PaymentSummary {
  priceCents: number
  /** Plata que efectivamente entró. Es lo que se muestra como "cobrado". */
  paidCents: number
  /** Retenciones y ajustes: cierran saldo pero nunca entraron a la cuenta. */
  offsetCents: number
  /** Lo que dejó de deberse: cobrado + retenido/ajustado. */
  settledCents: number
  /** Lo que falta cobrar. Nunca negativo. */
  dueCents: number
  /** Excedente por encima del valor del mes. Normalmente 0. */
  overpaidCents: number
  /** 0–100, recortado. */
  percent: number
  state: PaymentState
  /** Cantidad de movimientos registrados (cobros, retenciones y ajustes). */
  entries: number
}

/**
 * El saldo se cierra con lo cobrado **más** las retenciones y ajustes. Sin esa
 * distinción, una retención quedaba como cobro parcial: el mes seguía "debiendo"
 * plata que nunca iba a llegar, y el recordatorio automático le reclamaba a un
 * cliente que ya había pagado completo.
 */
export function summarizePayments(priceCents: number, payments: PaymentLike[]): PaymentSummary {
  const price = Math.max(0, Math.round(priceCents || 0))

  let paid = 0
  let offset = 0
  for (const entry of payments) {
    const amount = Math.round(entry.amountCents || 0)
    if (entry.kind === "WITHHOLDING" || entry.kind === "ADJUSTMENT") offset += amount
    else paid += amount
  }
  const settled = paid + offset

  const due = Math.max(0, price - settled)
  // Sin valor cargado no hay excedente que reclamar, sólo cobros sueltos.
  const overpaid = price === 0 ? 0 : Math.max(0, settled - price)

  let state: PaymentState
  if (price === 0) state = "UNPRICED"
  else if (settled <= 0) state = "PENDING"
  else if (settled < price) state = "PARTIAL"
  else state = "PAID"

  return {
    priceCents: price,
    paidCents: paid,
    offsetCents: offset,
    settledCents: settled,
    dueCents: due,
    overpaidCents: overpaid,
    percent: price === 0 ? 0 : Math.min(100, Math.round((settled / price) * 100)),
    state,
    entries: payments.length,
  }
}

export const paymentStateLabels: Record<PaymentState, string> = {
  UNPRICED: "Sin valor",
  PENDING: "Pendiente",
  PARTIAL: "Pago parcial",
  PAID: "Pagado",
}

export const paymentMethodLabels: Record<string, string> = {
  CASH: "Efectivo",
  TRANSFER: "Transferencia",
  CARD: "Tarjeta",
  PAYPAL: "PayPal",
  CRYPTO: "Cripto",
  OTHER: "Otro",
}

export const paymentMethods = ["TRANSFER", "CASH", "CARD", "PAYPAL", "CRYPTO", "OTHER"] as const

const dateFormatter = new Intl.DateTimeFormat("es-EC", {
  day: "numeric",
  month: "short",
  year: "numeric",
})

/** "4 jun 2026" — compacto, sin los "de" que alargan el formato local. */
export function formatPaymentDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const parts = dateFormatter.formatToParts(d)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? ""
  return `${part("day")} ${part("month").replace(".", "")} ${part("year")}`
}

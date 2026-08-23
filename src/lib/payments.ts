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
    // formato es-AR: 1.200,50
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

export interface PaymentLike {
  amountCents: number
}

export interface PaymentSummary {
  priceCents: number
  paidCents: number
  /** Lo que falta cobrar. Nunca negativo. */
  dueCents: number
  /** Excedente cobrado por encima del precio. Normalmente 0. */
  overpaidCents: number
  /** 0–100, recortado. */
  percent: number
  state: PaymentState
  installments: number
}

export function summarizePayments(priceCents: number, payments: PaymentLike[]): PaymentSummary {
  const price = Math.max(0, Math.round(priceCents || 0))
  const paid = payments.reduce((sum, p) => sum + Math.round(p.amountCents || 0), 0)
  const due = Math.max(0, price - paid)
  // Sin precio acordado no hay excedente que reclamar, sólo cobros sueltos.
  const overpaid = price === 0 ? 0 : Math.max(0, paid - price)

  let state: PaymentState
  if (price === 0) state = "UNPRICED"
  else if (paid <= 0) state = "PENDING"
  else if (paid < price) state = "PARTIAL"
  else state = "PAID"

  return {
    priceCents: price,
    paidCents: paid,
    dueCents: due,
    overpaidCents: overpaid,
    percent: price === 0 ? 0 : Math.min(100, Math.round((paid / price) * 100)),
    state,
    installments: payments.length,
  }
}

export const paymentStateLabels: Record<PaymentState, string> = {
  UNPRICED: "Sin precio",
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

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
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

import {
  formatMoney,
  formatPaymentDate,
  isPaymentKind,
  paymentKindLabels,
  paymentMethodLabels,
  paymentStateLabels,
  type PaymentState,
  type PaymentSummary,
} from "@/lib/payments"

export interface PaymentRecord {
  id: string
  amountCents: number
  /** PAYMENT | WITHHOLDING | ADJUSTMENT. Ausente se lee como PAYMENT. */
  kind: string
  method: string
  note: string
  paidAt: string
}

/** Una retención no es plata que entró, así que tampoco se pinta como tal. */
function isCash(record: PaymentRecord) {
  return record.kind !== "WITHHOLDING" && record.kind !== "ADJUSTMENT"
}

const stampStyles: Record<PaymentState, string> = {
  PAID: "bg-emerald-500/10 text-emerald-300 ring-emerald-400/25",
  PARTIAL: "bg-amber-500/10 text-amber-300 ring-amber-400/25",
  PENDING: "bg-white/[0.04] text-zinc-300 ring-white/10",
  UNPRICED: "bg-white/[0.04] text-zinc-400 ring-white/10",
}

export const paymentDotStyles: Record<PaymentState, string> = {
  PAID: "bg-emerald-400",
  PARTIAL: "bg-amber-400",
  PENDING: "bg-zinc-500",
  UNPRICED: "bg-zinc-600",
}

export function PaymentStamp({ state, className = "" }: { state: PaymentState; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${stampStyles[state]} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${paymentDotStyles[state]}`} aria-hidden />
      {paymentStateLabels[state]}
    </span>
  )
}

/**
 * Barra de avance del cobro. Cada pago es un segmento propio, así se lee
 * de un vistazo en cuántas veces se fue cancelando el plan.
 */
export function PaymentProgress({
  summary,
  payments,
}: {
  summary: PaymentSummary
  payments: PaymentRecord[]
}) {
  const { priceCents, settledCents, state } = summary
  const tone = state === "PAID" ? "bg-emerald-400" : "bg-amber-400"
  const reference = Math.max(priceCents, settledCents) || 1

  return (
    <div
      className="flex h-2 w-full gap-px overflow-hidden rounded-full bg-white/[0.07]"
      role="img"
      aria-label={`Saldado ${formatMoney(settledCents)} de ${formatMoney(priceCents)}`}
    >
      {payments.map((payment) => (
        <div
          key={payment.id}
          className={`h-full transition-[width,background-color] duration-500 ease-out ${
            isCash(payment) ? tone : "bg-sky-400/70"
          }`}
          style={{ width: `${Math.min(100, (payment.amountCents / reference) * 100)}%` }}
        />
      ))}
    </div>
  )
}

/** Encabezado de estado de cuenta: cifras, avance y saldo. */
export function PaymentAccountHeader({
  summary,
  payments,
  title = "Estado de cobro",
  action,
}: {
  summary: PaymentSummary
  payments: PaymentRecord[]
  title?: string
  action?: React.ReactNode
}) {
  const { paidCents, offsetCents, settledCents, priceCents, dueCents, overpaidCents, state, entries } =
    summary
  const unpriced = state === "UNPRICED"

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight text-zinc-200">{title}</h2>
        <div className="flex items-center gap-2">
          <PaymentStamp state={state} />
          {action}
        </div>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-3xl font-semibold tabular-nums tracking-tight text-white">
          {formatMoney(settledCents)}
        </span>
        <span className="text-sm text-zinc-400">
          {unpriced ? (
            "cobrados hasta ahora"
          ) : (
            <>
              de <span className="tabular-nums text-zinc-300">{formatMoney(priceCents)}</span>{" "}
              acordados
            </>
          )}
        </span>
      </div>

      {offsetCents > 0 && (
        <p className="text-xs text-zinc-400">
          Entraron <span className="tabular-nums text-zinc-300">{formatMoney(paidCents)}</span>; los{" "}
          <span className="tabular-nums text-sky-300">{formatMoney(offsetCents)}</span> restantes son
          retenciones o ajustes y no van a llegar a la cuenta.
        </p>
      )}

      {!unpriced && <PaymentProgress summary={summary} payments={payments} />}

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs">
        <span className="text-zinc-400">
          {entries === 0
            ? "Todavía sin movimientos registrados"
            : entries === 1
              ? "1 movimiento registrado"
              : `${entries} movimientos registrados`}
        </span>
        {unpriced ? (
          <span className="text-zinc-400">Todavía sin valor cargado</span>
        ) : dueCents > 0 ? (
          <span className="text-amber-300">
            Saldo pendiente <span className="font-medium tabular-nums">{formatMoney(dueCents)}</span>
          </span>
        ) : overpaidCents > 0 ? (
          <span className="text-emerald-300">
            Saldo a favor <span className="font-medium tabular-nums">{formatMoney(overpaidCents)}</span>
          </span>
        ) : (
          <span className="text-emerald-300">Sin saldo pendiente</span>
        )}
      </div>
    </div>
  )
}

/** Historial cronológico de cobros, en modo lectura. */
export function PaymentLedger({
  payments,
  emptyLabel = "Cuando se registre un pago va a aparecer acá.",
}: {
  payments: PaymentRecord[]
  emptyLabel?: string
}) {
  if (payments.length === 0) {
    return <p className="py-6 text-center text-sm text-zinc-400">{emptyLabel}</p>
  }

  return (
    <ol className="relative space-y-px border-l border-white/10 pl-4">
      {payments.map((payment) => {
        const cash = isCash(payment)
        const kindLabel = isPaymentKind(payment.kind) ? paymentKindLabels[payment.kind] : ""
        return (
          <li key={payment.id} className="relative flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5">
            <span
              className={`absolute -left-[1.3125rem] top-[1.0625rem] h-1.5 w-1.5 rounded-full ring-2 ring-[#0c0c0e] ${
                cash ? "bg-emerald-400" : "bg-sky-400"
              }`}
              aria-hidden
            />
            <div className="min-w-0">
              <p className="text-sm text-zinc-200">
                {formatPaymentDate(payment.paidAt)}
                <span className="text-zinc-400">
                  {" · "}
                  {cash ? paymentMethodLabels[payment.method] ?? payment.method : kindLabel}
                </span>
              </p>
              {payment.note && <p className="truncate text-xs text-zinc-400">{payment.note}</p>}
            </div>
            <span
              className={`shrink-0 text-sm font-medium tabular-nums ${
                cash ? "text-emerald-300" : "text-sky-300"
              }`}
            >
              {cash ? "+" : "−"} {formatMoney(payment.amountCents)}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

import { summarizePayments, type PaymentLike } from "./payments"
import { totalMargin, type MarginSummary } from "./margin"

/**
 * Estado de cuenta del cliente: la deuda es del cliente, no del mes.
 *
 * Antes, si julio quedaba debiendo $200, agosto arrancaba en cero y esa plata
 * sólo vivía en la cabeza del creador (o escrita a mano en el campo de detalle
 * del recibo). Acá el saldo se acumula a lo largo de todos los meses.
 *
 * A propósito **no** se arrastra la deuda como una línea del mes siguiente: eso
 * la contaría dos veces —julio seguiría debiendo $200 y agosto cobraría otros
 * $200—. El arrastre es de lectura: cada mes conserva lo suyo y el total se
 * suma acá.
 */

export interface ClientMonth {
  id: string
  period: string
  title: string
  status: string
  priceCents: number
  costCents: number
  payments: PaymentLike[]
}

export interface MonthBalance {
  id: string
  period: string
  title: string
  status: string
  priceCents: number
  costCents: number
  paidCents: number
  dueCents: number
  settledCents: number
}

export interface ClientAccount {
  /** Suma del valor de todos los meses. */
  valueCents: number
  /** Plata que efectivamente entró. */
  paidCents: number
  /** Retenciones y ajustes: cerraron saldo sin entrar a la cuenta. */
  offsetCents: number
  /** Todo lo que dejó de deberse. */
  settledCents: number
  /** Saldo acumulado del cliente, sumando todos sus meses. */
  dueCents: number
  /** Meses que todavía deben algo. */
  monthsWithDebt: number
  /** El mes más viejo con deuda: el que conviene reclamar primero. */
  oldestDebtPeriod: string | null
  /** Cada mes con su propio saldo, del más reciente al más viejo. */
  months: MonthBalance[]
  /** Margen acumulado del cliente: lo facturado menos lo que costó producirlo. */
  margin: MarginSummary
}

export function summarizeClientAccount(months: ClientMonth[]): ClientAccount {
  const balances: MonthBalance[] = months.map((month) => {
    const summary = summarizePayments(month.priceCents, month.payments)
    return {
      id: month.id,
      period: month.period,
      title: month.title,
      status: month.status,
      priceCents: summary.priceCents,
      costCents: Math.max(0, Math.round(month.costCents || 0)),
      paidCents: summary.paidCents,
      settledCents: summary.settledCents,
      dueCents: summary.dueCents,
    }
  })

  const account: ClientAccount = {
    valueCents: 0,
    paidCents: 0,
    offsetCents: 0,
    settledCents: 0,
    dueCents: 0,
    monthsWithDebt: 0,
    oldestDebtPeriod: null,
    months: [...balances].sort((a, b) => b.period.localeCompare(a.period)),
    margin: totalMargin(
      balances.map((m) => ({ valueCents: m.priceCents, costCents: m.costCents })),
    ),
  }

  for (const month of balances) {
    account.valueCents += month.priceCents
    account.paidCents += month.paidCents
    account.settledCents += month.settledCents
    account.dueCents += month.dueCents
    if (month.dueCents > 0) {
      account.monthsWithDebt += 1
      if (!account.oldestDebtPeriod || month.period.localeCompare(account.oldestDebtPeriod) < 0) {
        account.oldestDebtPeriod = month.period
      }
    }
  }
  account.offsetCents = account.settledCents - account.paidCents

  return account
}

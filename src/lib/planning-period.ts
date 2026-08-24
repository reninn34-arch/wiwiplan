/**
 * Utilidades de período (`YYYY-MM`) sin dependencias de servidor, para que la
 * aritmética de fechas del duplicado se pueda probar sola.
 */

/** Selección de qué se copia al duplicar un mes. */
export interface CloneSelection {
  /** Ideas con su pilar, formato, plataforma, referencia, prioridad y tags. */
  ideas: boolean
  /** Precio del mes y fechas de cobro (las cuotas se corren al mes destino). */
  pricing: boolean
  /** Costos de producción: el editor de todos los meses es el mismo editor. */
  costs: boolean
  /** Descripción, audiencia, objetivos y notas del plan. */
  notes: boolean
}

/** Por defecto se copia todo; el cuerpo sólo tiene que apagar lo que no quiere. */
export function normalizeSelection(raw: unknown): CloneSelection {
  const value = (raw ?? {}) as Partial<Record<keyof CloneSelection, unknown>>
  return {
    ideas: value.ideas !== false,
    pricing: value.pricing !== false,
    costs: value.costs !== false,
    notes: value.notes !== false,
  }
}

export function isValidPeriod(period: string): boolean {
  const [y, m] = period.split("-").map(Number)
  return (
    /^\d{4}-\d{2}$/.test(period) && Number.isInteger(y) && Number.isInteger(m) && m >= 1 && m <= 12
  )
}

/**
 * Reubica una fecha dentro del período destino conservando el día del mes: una
 * entrega del 15 sigue siendo del 15. Si ese día no existe en el mes destino
 * (el 31 en febrero) cae al último día del mes.
 */
export function moveToPeriod(date: Date, period: string): Date | null {
  if (!isValidPeriod(period)) return null
  const [y, m] = period.split("-").map(Number)
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const day = Math.min(date.getUTCDate(), lastDay)
  return new Date(
    Date.UTC(y, m - 1, day, date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()),
  )
}

const MONTH_NAMES: Record<string, string> = {
  "01": "Enero", "02": "Febrero", "03": "Marzo", "04": "Abril",
  "05": "Mayo", "06": "Junio", "07": "Julio", "08": "Agosto",
  "09": "Septiembre", "10": "Octubre", "11": "Noviembre", "12": "Diciembre",
}

/** `2026-08` → `Agosto 2026`. Lo que no tenga forma de período vuelve igual. */
export function formatPeriodLabel(period: string): string {
  const parts = period.split("-")
  if (parts.length === 2) return `${MONTH_NAMES[parts[1]] ?? parts[1]} ${parts[0]}`
  return period
}

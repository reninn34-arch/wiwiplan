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

/** Nombre y abreviaturas de cada mes, en el orden del período. */
const MONTH_TOKENS: string[][] = [
  ["enero", "ene"],
  ["febrero", "feb"],
  ["marzo", "mar"],
  ["abril", "abr"],
  ["mayo", "may"],
  ["junio", "jun"],
  ["julio", "jul"],
  ["agosto", "ago"],
  ["septiembre", "setiembre", "sep", "set"],
  ["octubre", "oct"],
  ["noviembre", "nov"],
  ["diciembre", "dic"],
]

/** Minúsculas y sin tildes, para que "Setiembre" y "setiembre" den lo mismo. */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
}

/**
 * Traduce lo que la persona escribe a los períodos que buscar. Los meses se
 * guardan como `2026-08`, pero en toda la interfaz se leen como "Agosto 2026":
 * quien busca escribe el nombre, no el número, así que buscar el texto crudo no
 * encontraba nada.
 *
 * - `agosto` → `-08` (agosto de cualquier año)
 * - `agosto 2026` → `2026-08`
 * - `2026` → `2026-`
 *
 * Devuelve vacío si no hay nada parecido a un mes o un año, para no ensuciar la
 * búsqueda normal.
 */
export function periodQueryPatterns(query: string): string[] {
  const tokens = normalize(query).split(/[^a-z0-9]+/).filter(Boolean)
  if (tokens.length === 0) return []

  const months = new Set<string>()
  let year = ""

  for (const token of tokens) {
    if (/^\d{4}$/.test(token)) {
      year = token
      continue
    }
    // Desde tres letras: "ago" alcanza, pero una sola letra engancharía todo.
    if (token.length < 3) continue
    MONTH_TOKENS.forEach((names, index) => {
      if (names.some((name) => name.startsWith(token))) {
        months.add(String(index + 1).padStart(2, "0"))
      }
    })
  }

  if (months.size === 0) return year ? [`${year}-`] : []
  return [...months].map((month) => (year ? `${year}-${month}` : `-${month}`))
}

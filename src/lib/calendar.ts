import { isValidPeriod } from "./planning-period"

/**
 * Rejilla del mes para ver el plan como calendario de publicaciones.
 *
 * Las fechas de entrega son **fechas de calendario**, no instantes: el "15 de
 * agosto" es el 15 de agosto sin importar dónde estés parado. Se guardan como
 * medianoche UTC (que es lo que hace `new Date("2026-08-15")`), así que acá se
 * leen siempre por sus componentes UTC. Formatearlas con la zona local las
 * corría un día para atrás en Ecuador, que está en UTC-5.
 */

/** Lunes primero: agrupa el fin de semana, que es como se planifica contenido. */
export const WEEKDAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] as const

export interface CalendarDay {
  /** Clave de día, `YYYY-MM-DD`. Es también la clave con la que se agrupan las ideas. */
  key: string
  dayOfMonth: number
  /** Los bordes de la rejilla son relleno del mes vecino. */
  inPeriod: boolean
  isToday: boolean
  isWeekend: boolean
}

/** `2026-08-15T00:00:00.000Z` → `2026-08-15`. Vacío si no hay fecha. */
export function dayKeyOf(iso: string | null | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return toKey(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
}

/** Hoy según el calendario del usuario, no según UTC. */
export function todayKey(now: Date = new Date()): string {
  return toKey(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

function toKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

/**
 * Semanas de siete días que cubren el período, con el relleno justo para que
 * empiecen en lunes. No agrega una fila vacía al final: se generan sólo las
 * semanas que el mes realmente toca.
 */
export function buildMonthGrid(period: string, today: string = todayKey()): CalendarDay[][] {
  if (!isValidPeriod(period)) return []
  const [year, month] = period.split("-").map(Number)

  const first = new Date(Date.UTC(year, month - 1, 1))
  // getUTCDay: 0 es domingo. Con lunes primero, el domingo queda en la posición 6.
  const leading = (first.getUTCDay() + 6) % 7
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const weeks = Math.ceil((leading + daysInMonth) / 7)

  const grid: CalendarDay[][] = []
  for (let w = 0; w < weeks; w += 1) {
    const week: CalendarDay[] = []
    for (let d = 0; d < 7; d += 1) {
      const offset = w * 7 + d - leading
      const date = new Date(Date.UTC(year, month - 1, 1 + offset))
      const key = toKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
      week.push({
        key,
        dayOfMonth: date.getUTCDate(),
        inPeriod: date.getUTCMonth() === month - 1 && date.getUTCFullYear() === year,
        isToday: key === today,
        isWeekend: d >= 5,
      })
    }
    grid.push(week)
  }
  return grid
}

/** Agrupa por clave de día lo que tenga fecha. Lo que no la tenga queda afuera. */
export function groupByDay<T extends { dueDate: string | null }>(items: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const key = dayKeyOf(item.dueDate)
    if (!key) continue
    const bucket = map.get(key)
    if (bucket) bucket.push(item)
    else map.set(key, [item])
  }
  return map
}

const DAY_MONTH = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]

/** `2026-08-15T00:00:00.000Z` → `15 ago`. Lee UTC, así no se corre un día. */
export function formatDayLabel(iso: string | null | undefined): string {
  const key = dayKeyOf(iso)
  if (!key) return ""
  const [, month, day] = key.split("-").map(Number)
  return `${day} ${DAY_MONTH[month - 1] ?? month}`
}

/** `2026-08-15` → `15/08`. Compacto, para tablas. */
export function formatDayShort(iso: string | null | undefined): string {
  const key = dayKeyOf(iso)
  if (!key) return ""
  const [, month, day] = key.split("-")
  return `${day}/${month}`
}

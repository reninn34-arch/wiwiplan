/**
 * La otra mitad del dinero. Hasta acá la app sabía lo que entraba pero no lo
 * que salía: el editor, la pauta, el fotógrafo, las licencias de música. Saber
 * que el plan de $600 costó $380 producirlo es lo que decide si subes la tarifa
 * o sueltas la cuenta; sin eso, "margen" es una intuición y no un número.
 *
 * La pauta que le recobras al cliente no lleva marca especial: si la cargas
 * como línea del valor **y** como costo, entra y sale, y el margen queda igual.
 * Que es exactamente lo correcto.
 */

export type CostCategory = "TEAM" | "ADS" | "PRODUCTION" | "TOOLS" | "OTHER"

export const costCategories = ["TEAM", "ADS", "PRODUCTION", "TOOLS", "OTHER"] as const

export const costCategoryLabels: Record<CostCategory, string> = {
  TEAM: "Equipo",
  ADS: "Pauta",
  PRODUCTION: "Producción",
  TOOLS: "Herramientas",
  OTHER: "Otro",
}

/** Ejemplos concretos, para que elegir categoría no sea adivinar. */
export const costCategoryHints: Record<CostCategory, string> = {
  TEAM: "Editor, camarógrafo, community.",
  ADS: "Pauta publicitaria.",
  PRODUCTION: "Locación, talento, utilería, viáticos.",
  TOOLS: "Licencias, software, música.",
  OTHER: "Cualquier otro gasto del mes.",
}

export function isCostCategory(value: unknown): value is CostCategory {
  return (
    value === "TEAM" ||
    value === "ADS" ||
    value === "PRODUCTION" ||
    value === "TOOLS" ||
    value === "OTHER"
  )
}

export interface CostLike {
  amountCents: number
  category?: string | null
}

export interface MarginSummary {
  /** Valor del mes. */
  valueCents: number
  /** Todo lo que costó producirlo. */
  costCents: number
  /** Valor menos costo. Puede ser negativo: un mes puede dar pérdida. */
  marginCents: number
  /**
   * Margen sobre el valor, 0–100. `null` cuando no hay valor cargado, porque
   * un porcentaje sobre cero no significa nada.
   */
  marginPercent: number | null
  /** Cuánto se fue en cada categoría, para ver dónde se va la plata. */
  byCategory: Record<CostCategory, number>
}

const emptyByCategory = (): Record<CostCategory, number> => ({
  TEAM: 0,
  ADS: 0,
  PRODUCTION: 0,
  TOOLS: 0,
  OTHER: 0,
})

export function summarizeMargin(valueCents: number, costs: CostLike[]): MarginSummary {
  const value = Math.max(0, Math.round(valueCents || 0))
  const byCategory = emptyByCategory()

  let cost = 0
  for (const entry of costs) {
    const amount = Math.round(entry.amountCents || 0)
    cost += amount
    const category = isCostCategory(entry.category) ? entry.category : "OTHER"
    byCategory[category] += amount
  }

  const margin = value - cost

  return {
    valueCents: value,
    costCents: cost,
    marginCents: margin,
    marginPercent: value === 0 ? null : Math.round((margin / value) * 100),
    byCategory,
  }
}

/** Suma de varios meses, para el margen acumulado de un cliente. */
export function totalMargin(months: Array<{ valueCents: number; costCents: number }>): MarginSummary {
  let value = 0
  let cost = 0
  for (const month of months) {
    value += Math.max(0, Math.round(month.valueCents || 0))
    cost += Math.round(month.costCents || 0)
  }
  const margin = value - cost
  return {
    valueCents: value,
    costCents: cost,
    marginCents: margin,
    marginPercent: value === 0 ? null : Math.round((margin / value) * 100),
    byCategory: emptyByCategory(),
  }
}

/**
 * Los dos totales del mes, que están atados: un costo marcado como recobrable
 * cuenta también como valor. Es la aritmética que `recalcPlanningMoney` guarda
 * en `Planning.priceCents` y `Planning.costCents`.
 */
export function planningTotals(
  items: Array<{ amountCents: number }>,
  costs: Array<{ amountCents: number; billable?: boolean }>,
): { priceCents: number; costCents: number } {
  const itemsTotal = items.reduce((sum, i) => sum + Math.round(i.amountCents || 0), 0)
  let costTotal = 0
  let billableTotal = 0
  for (const cost of costs) {
    const amount = Math.round(cost.amountCents || 0)
    costTotal += amount
    if (cost.billable) billableTotal += amount
  }
  return {
    // Ninguno baja de cero: un descuento puede anular el mes, no dejarlo en rojo.
    priceCents: Math.max(0, itemsTotal + billableTotal),
    costCents: Math.max(0, costTotal),
  }
}

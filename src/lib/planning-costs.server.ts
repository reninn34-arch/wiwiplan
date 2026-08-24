import "server-only"
import { prisma } from "@/lib/prisma"
import { isCostCategory, type CostCategory } from "@/lib/margin"
import { parseItemAmount } from "@/lib/money-input"

/**
 * Costos del mes. Misma regla que las líneas del valor, para que no haya dos
 * verdades: **nadie escribe `Planning.costCents` a mano**. Se toca el costo y se
 * llama a `recalcPlanningMoney`, dentro de la misma transacción.
 */

/** Sirve tanto para el cliente normal como para uno de transacción. */
type Db = Pick<typeof prisma, "planning" | "planningCost">

export interface PlanningCostRecord {
  id: string
  label: string
  amountCents: number
  category: string
  /** Se le recobra al cliente: cuenta también como valor y sale en la factura. */
  billable: boolean
  order: number
}

const COST_SELECT = {
  id: true,
  label: true,
  amountCents: true,
  category: true,
  billable: true,
  order: true,
} as const

export function normalizeCategory(raw: unknown): CostCategory {
  return isCostCategory(raw) ? raw : "OTHER"
}

export { parseItemAmount as parseCostAmount }

export function listCosts(db: Db, planningId: string): Promise<PlanningCostRecord[]> {
  return db.planningCost.findMany({
    where: { planningId },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: COST_SELECT,
  })
}

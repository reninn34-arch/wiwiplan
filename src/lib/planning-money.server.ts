import "server-only"
import { prisma } from "@/lib/prisma"
import { listItems, type PlanningItemRecord } from "@/lib/planning-items.server"
import { listCosts, type PlanningCostRecord } from "@/lib/planning-costs.server"
import { planningTotals } from "@/lib/margin"

/**
 * Las dos mitades del dinero del mes se recalculan juntas, porque están atadas:
 * un costo marcado como recobrable cuenta **también** como valor. Antes había
 * que cargar la pauta dos veces a mano —una como línea del valor y otra como
 * costo— y nada garantizaba que los dos números coincidieran.
 *
 * Regla única: nadie escribe `priceCents` ni `costCents` a mano. Se toca una
 * línea o un costo y se llama a esto, dentro de la misma transacción.
 */

type Db = Pick<typeof prisma, "planning" | "planningItem" | "planningCost">

export interface PlanningMoney {
  /** Líneas del valor + costos recobrables. */
  priceCents: number
  /** Todo lo que costó producir el mes, recobrable o no. */
  costCents: number
  items: PlanningItemRecord[]
  costs: PlanningCostRecord[]
}

export async function recalcPlanningMoney(db: Db, planningId: string): Promise<PlanningMoney> {
  const [items, costs] = await Promise.all([listItems(db, planningId), listCosts(db, planningId)])

  const { priceCents, costCents } = planningTotals(items, costs)

  await db.planning.update({
    where: { id: planningId },
    data: { priceCents, costCents },
  })

  return { priceCents, costCents, items, costs }
}

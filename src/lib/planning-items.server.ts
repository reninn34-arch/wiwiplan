import "server-only"
import { prisma } from "@/lib/prisma"
import { parseItemAmount } from "@/lib/money-input"

export { parseItemAmount }

/**
 * Valor del mes, línea por línea. Antes el precio era un entero suelto en el
 * plan: si el mes fue $600 de plan + $150 de una sesión extra, quedaba "$750"
 * y a los tres meses nadie se acordaba de dónde salía. Ahora cada concepto es
 * una línea, y `Planning.priceCents` es la suma cacheada de todas ellas.
 *
 * Regla única, para que no haya dos verdades: **nadie escribe `priceCents` a
 * mano**. Se toca la línea y se llama a `recalcPlanningMoney`.
 */

/** Sirve tanto para el cliente normal como para uno de transacción. */
type Db = Pick<typeof prisma, "planning" | "planningItem">

export interface PlanningItemRecord {
  id: string
  label: string
  amountCents: number
  order: number
}

const ITEM_SELECT = { id: true, label: true, amountCents: true, order: true } as const

export function listItems(db: Db, planningId: string): Promise<PlanningItemRecord[]> {
  return db.planningItem.findMany({
    where: { planningId },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: ITEM_SELECT,
  })
}

/**
 * Siembra la primera línea del mes con la tarifa del cliente. Es el punto del
 * cambio que se nota: el mes de un cliente con plan fijo ya nace con su precio
 * puesto, sin volver a teclearlo.
 */
export async function seedItemsFromClientRate(
  db: Db,
  planningId: string,
  client: { planName: string; rateCents: number } | null,
): Promise<number> {
  if (!client || client.rateCents <= 0) return 0
  await db.planningItem.create({
    data: {
      planningId,
      label: client.planName.trim() || "Plan del mes",
      amountCents: client.rateCents,
      order: 0,
    },
  })
  // Recién creado no hay costos, así que el valor es la tarifa y nada más.
  await db.planning.update({ where: { id: planningId }, data: { priceCents: client.rateCents } })
  return client.rateCents
}

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { normalizeCategory, parseCostAmount } from "@/lib/planning-costs.server"
import { recalcPlanningMoney } from "@/lib/planning-money.server"
import { isCostCategory } from "@/lib/margin"

/** Ownership por la relación: el costo es del plan y el plan es del usuario. */
function ownedWhere(costId: string, planningId: string, userId: string) {
  return { id: costId, planningId, planning: { userId } }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; costId: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const { id, costId } = await params
    const body = await request.json()

    let amountCents: number | undefined
    if (body?.amountCents !== undefined) {
      const parsed = parseCostAmount(body.amountCents)
      if (parsed === null || parsed < 0) {
        return NextResponse.json({ error: "El monto no es válido" }, { status: 400 })
      }
      amountCents = parsed
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.planningCost.updateMany({
        where: ownedWhere(costId, id, session.user!.id!),
        data: {
          ...(amountCents !== undefined ? { amountCents } : {}),
          ...(typeof body?.label === "string" ? { label: body.label.trim() } : {}),
          ...(isCostCategory(body?.category) ? { category: normalizeCategory(body.category) } : {}),
          ...(typeof body?.billable === "boolean" ? { billable: body.billable } : {}),
        },
      })
      if (updated.count === 0) return null
      return recalcPlanningMoney(tx, id)
    })

    if (!result) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 })
    }
    return NextResponse.json(result)
  } catch (error) {
    console.error("Error actualizando costo del mes:", error)
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; costId: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const { id, costId } = await params
    const result = await prisma.$transaction(async (tx) => {
      const deleted = await tx.planningCost.deleteMany({
        where: ownedWhere(costId, id, session.user!.id!),
      })
      if (deleted.count === 0) return null
      return recalcPlanningMoney(tx, id)
    })

    if (!result) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 })
    }
    return NextResponse.json(result)
  } catch (error) {
    console.error("Error al eliminar costo del mes:", error)
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 })
  }
}

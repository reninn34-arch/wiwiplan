import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { parseItemAmount } from "@/lib/planning-items.server"
import { recalcPlanningMoney } from "@/lib/planning-money.server"

/** Ownership por la relación: la línea es del plan y el plan es del usuario. */
function ownedWhere(itemId: string, planningId: string, userId: string) {
  return { id: itemId, planningId, planning: { userId } }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const { id, itemId } = await params
    const body = await request.json()

    let amountCents: number | undefined
    if (body?.amountCents !== undefined) {
      const parsed = parseItemAmount(body.amountCents)
      if (parsed === null) {
        return NextResponse.json({ error: "El monto no es válido" }, { status: 400 })
      }
      amountCents = parsed
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.planningItem.updateMany({
        where: ownedWhere(itemId, id, session.user!.id!),
        data: {
          ...(amountCents !== undefined ? { amountCents } : {}),
          ...(typeof body?.label === "string" ? { label: body.label.trim() } : {}),
        },
      })
      if (updated.count === 0) return null
      return recalcPlanningMoney(tx, id)
    })

    if (!result) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 })
    }
    return NextResponse.json(result)
  } catch (error) {
    console.error("Error actualizando línea del mes:", error)
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const { id, itemId } = await params
    const result = await prisma.$transaction(async (tx) => {
      const deleted = await tx.planningItem.deleteMany({
        where: ownedWhere(itemId, id, session.user!.id!),
      })
      if (deleted.count === 0) return null
      return recalcPlanningMoney(tx, id)
    })

    if (!result) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 })
    }
    return NextResponse.json(result)
  } catch (error) {
    console.error("Error al eliminar línea del mes:", error)
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 })
  }
}

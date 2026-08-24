import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { listCosts, normalizeCategory, parseCostAmount } from "@/lib/planning-costs.server"
import { recalcPlanningMoney } from "@/lib/planning-money.server"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const { id } = await params
    const owned = await prisma.planning.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true, costCents: true },
    })
    if (!owned) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 })
    }

    const costs = await listCosts(prisma, id)
    return NextResponse.json({ costCents: owned.costCents, costs })
  } catch (error) {
    console.error("Error al listar costos del mes:", error)
    return NextResponse.json({ error: "Error al listar" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = await request.json()

    const amountCents = parseCostAmount(body?.amountCents)
    if (amountCents === null || amountCents < 0) {
      return NextResponse.json({ error: "El monto no es válido" }, { status: 400 })
    }

    const owned = await prisma.planning.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true, _count: { select: { costs: true } } },
    })
    if (!owned) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 })
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.planningCost.create({
        data: {
          planningId: owned.id,
          label: typeof body?.label === "string" ? body.label.trim() : "",
          amountCents,
          category: normalizeCategory(body?.category),
          billable: body?.billable === true,
          order: owned._count.costs,
        },
      })
      return recalcPlanningMoney(tx, owned.id)
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error("Error creando costo del mes:", error)
    return NextResponse.json({ error: "Error al crear" }, { status: 500 })
  }
}

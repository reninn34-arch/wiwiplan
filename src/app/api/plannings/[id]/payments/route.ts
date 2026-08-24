import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { PaymentMethod } from "@/generated/prisma/enums"
import { isPaymentKind } from "@/lib/payments"

const MAX_CENTS = 1_000_000_000 // 10M USD, tope de cordura

function isValidMethod(value: unknown): value is PaymentMethod {
  return typeof value === "string" && value in PaymentMethod
}

async function ownsPlanning(planningId: string, userId: string) {
  const planning = await prisma.planning.findFirst({
    where: { id: planningId, userId },
    select: { id: true },
  })
  return Boolean(planning)
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const { id } = await params
    if (!(await ownsPlanning(id, session.user.id))) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 })
    }

    const payments = await prisma.payment.findMany({
      where: { planningId: id },
      orderBy: { paidAt: "asc" },
    })
    return NextResponse.json(payments)
  } catch (error) {
    console.error("Error fetching payments:", error)
    return NextResponse.json({ error: "Error al obtener los cobros" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const { id } = await params
    if (!(await ownsPlanning(id, session.user.id))) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 })
    }

    const body = await request.json()
    const amountCents = Math.round(Number(body.amountCents))

    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return NextResponse.json({ error: "El monto tiene que ser mayor a cero" }, { status: 400 })
    }
    if (amountCents > MAX_CENTS) {
      return NextResponse.json({ error: "El monto supera el máximo permitido" }, { status: 400 })
    }

    const paidAt = body.paidAt ? new Date(body.paidAt) : new Date()
    if (Number.isNaN(paidAt.getTime())) {
      return NextResponse.json({ error: "La fecha del cobro no es válida" }, { status: 400 })
    }

    const payment = await prisma.payment.create({
      data: {
        planningId: id,
        amountCents,
        kind: isPaymentKind(body.kind) ? body.kind : "PAYMENT",
        method: isValidMethod(body.method) ? body.method : PaymentMethod.TRANSFER,
        note: typeof body.note === "string" ? body.note.slice(0, 300) : "",
        paidAt,
      },
    })

    return NextResponse.json(payment, { status: 201 })
  } catch (error) {
    console.error("Error creating payment:", error)
    return NextResponse.json({ error: "Error al registrar el cobro" }, { status: 500 })
  }
}

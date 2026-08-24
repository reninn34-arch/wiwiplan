import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { PaymentMethod, PaymentKind } from "@/generated/prisma/enums"
import { isPaymentKind } from "@/lib/payments"

const MAX_CENTS = 1_000_000_000

function isValidMethod(value: unknown): value is PaymentMethod {
  return typeof value === "string" && value in PaymentMethod
}

async function findOwnedPayment(planningId: string, paymentId: string, userId: string) {
  return prisma.payment.findFirst({
    where: { id: paymentId, planningId, planning: { userId } },
    select: { id: true },
  })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const { id, paymentId } = await params
    const existing = await findOwnedPayment(id, paymentId, session.user.id)
    if (!existing) {
      return NextResponse.json({ error: "Cobro no encontrado" }, { status: 404 })
    }

    const body = await request.json()
    const data: {
      amountCents?: number
      kind?: PaymentKind
      method?: PaymentMethod
      note?: string
      paidAt?: Date
    } = {}

    if (body.amountCents !== undefined) {
      const amountCents = Math.round(Number(body.amountCents))
      if (!Number.isFinite(amountCents) || amountCents <= 0) {
        return NextResponse.json({ error: "El monto tiene que ser mayor a cero" }, { status: 400 })
      }
      if (amountCents > MAX_CENTS) {
        return NextResponse.json({ error: "El monto supera el máximo permitido" }, { status: 400 })
      }
      data.amountCents = amountCents
    }

    if (body.paidAt !== undefined) {
      const paidAt = new Date(body.paidAt)
      if (Number.isNaN(paidAt.getTime())) {
        return NextResponse.json({ error: "La fecha del cobro no es válida" }, { status: 400 })
      }
      data.paidAt = paidAt
    }

    if (isPaymentKind(body.kind)) data.kind = body.kind
    if (body.method !== undefined && isValidMethod(body.method)) data.method = body.method
    if (typeof body.note === "string") data.note = body.note.slice(0, 300)

    const payment = await prisma.payment.update({ where: { id: paymentId }, data })
    return NextResponse.json(payment)
  } catch (error) {
    console.error("Error updating payment:", error)
    return NextResponse.json({ error: "Error al actualizar el cobro" }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const { id, paymentId } = await params
    const existing = await findOwnedPayment(id, paymentId, session.user.id)
    if (!existing) {
      return NextResponse.json({ error: "Cobro no encontrado" }, { status: 404 })
    }

    await prisma.payment.delete({ where: { id: paymentId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting payment:", error)
    return NextResponse.json({ error: "Error al eliminar el cobro" }, { status: 500 })
  }
}

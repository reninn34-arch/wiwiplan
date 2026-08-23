import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

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
      select: { id: true },
    })
    if (!owned) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 })
    }

    const installments = await prisma.paymentInstallment.findMany({
      where: { planningId: id },
      orderBy: { dueDate: "asc" },
      select: { id: true, label: true, amountCents: true, dueDate: true },
    })
    return NextResponse.json(installments)
  } catch (error) {
    console.error("Error al listar fechas de cobro:", error)
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

    const amount = Math.round(Number(body?.amountCents))
    const dueDate = body?.dueDate ? new Date(`${body.dueDate}T12:00:00`) : null
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "El monto tiene que ser mayor a cero" }, { status: 400 })
    }
    if (!dueDate || Number.isNaN(dueDate.getTime())) {
      return NextResponse.json({ error: "Fecha inválida" }, { status: 400 })
    }

    const owned = await prisma.planning.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true, _count: { select: { installments: true } } },
    })
    if (!owned) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 })
    }

    const installment = await prisma.paymentInstallment.create({
      data: {
        planningId: owned.id,
        label: typeof body?.label === "string" ? body.label.trim() : "",
        amountCents: amount,
        dueDate,
      },
      select: { id: true, label: true, amountCents: true, dueDate: true },
    })
    return NextResponse.json(installment, { status: 201 })
  } catch (error) {
    console.error("Error creando fecha de cobro:", error)
    return NextResponse.json({ error: "Error al crear" }, { status: 500 })
  }
}

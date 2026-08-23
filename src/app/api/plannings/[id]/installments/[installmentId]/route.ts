import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; installmentId: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const { id, installmentId } = await params
    const result = await prisma.paymentInstallment.deleteMany({
      where: { id: installmentId, planningId: id, planning: { userId: session.user.id } },
    })
    if (result.count === 0) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error al eliminar fecha de cobro:", error)
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 })
  }
}

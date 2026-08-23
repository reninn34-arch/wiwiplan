import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/** Estados que ya cuentan como aprobados: aprobar de nuevo no los toca. */
const APPROVED_STATES = ["APPROVED", "PUBLISHED"]

export async function POST(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params

    const shareLink = await prisma.shareLink.findUnique({ where: { token } })
    if (!shareLink) {
      return NextResponse.json({ error: "Enlace no válido" }, { status: 404 })
    }

    if (shareLink.expiresAt && new Date() > shareLink.expiresAt) {
      return NextResponse.json({ error: "Enlace expirado" }, { status: 410 })
    }

    const planning = await prisma.planning.findUnique({
      where: { id: shareLink.planningId },
      select: { userId: true, title: true, status: true },
    })
    if (!planning) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 })
    }

    // Aprobar es idempotente y nunca retrocede: un plan ya publicado no vuelve
    // a "aprobado" porque alguien reabra el enlace y toque el botón otra vez.
    if (APPROVED_STATES.includes(planning.status)) {
      return NextResponse.json({ success: true, status: planning.status, alreadyApproved: true })
    }

    await prisma.planning.update({
      where: { id: shareLink.planningId },
      data: { status: "APPROVED" },
    })

    await prisma.notification.create({
      data: {
        userId: planning.userId,
        type: "approve",
        title: "Planificación aprobada",
        message: `El cliente aprobó "${planning.title}"`,
        link: `/planning/${shareLink.planningId}`,
      },
    })

    return NextResponse.json({ success: true, status: "APPROVED" })
  } catch (error) {
    console.error("Error approving planning:", error)
    return NextResponse.json({ error: "Error al aprobar" }, { status: 500 })
  }
}

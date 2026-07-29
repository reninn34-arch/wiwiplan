import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

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

    const planning = await prisma.planning.update({
      where: { id: shareLink.planningId },
      data: { status: "APPROVED" },
      select: { userId: true, title: true },
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

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error approving planning:", error)
    return NextResponse.json({ error: "Error al aprobar" }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = await request.json()
    const { panelIds } = body as { panelIds: string[] }

    if (!Array.isArray(panelIds)) {
      return NextResponse.json({ error: "panelIds requerido" }, { status: 400 })
    }

    const planning = await prisma.planning.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true },
    })
    if (!planning) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 })
    }

    await prisma.$transaction(
      panelIds.map((panelId, index) =>
        prisma.storyboardPanel.updateMany({
          where: { id: panelId, storyboard: { planningId: id } },
          data: { order: index },
        })
      )
    )
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error al reordenar storyboard:", error)
    return NextResponse.json({ error: "Error al reordenar" }, { status: 500 })
  }
}

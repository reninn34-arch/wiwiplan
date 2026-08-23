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
    const { ideaIds } = body as { ideaIds: string[] }

    if (!Array.isArray(ideaIds)) {
      return NextResponse.json({ error: "ideaIds requerido" }, { status: 400 })
    }

    const planning = await prisma.planning.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true },
    })
    if (!planning) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 })
    }

    await prisma.$transaction(
      ideaIds.map((ideaId, index) =>
        prisma.contentIdea.updateMany({
          where: { id: ideaId, planningId: id },
          data: { order: index },
        })
      )
    )
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error al reordenar ideas:", error)
    return NextResponse.json({ error: "Error al reordenar" }, { status: 500 })
  }
}

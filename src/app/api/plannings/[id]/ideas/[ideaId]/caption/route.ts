import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

/** El copy de la publicación. Va aparte porque se escribe cerca de la fecha. */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; ideaId: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const { id, ideaId } = await params
    const body = await request.json()
    const caption = typeof body?.caption === "string" ? body.caption.slice(0, 5000) : ""

    const updated = await prisma.contentIdea.updateMany({
      where: { id: ideaId, planningId: id, planning: { userId: session.user.id } },
      data: { caption },
    })
    if (updated.count === 0) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 })
    }
    return NextResponse.json({ success: true, caption })
  } catch (error) {
    console.error("Error al guardar el copy:", error)
    return NextResponse.json({ error: "Error al guardar" }, { status: 500 })
  }
}

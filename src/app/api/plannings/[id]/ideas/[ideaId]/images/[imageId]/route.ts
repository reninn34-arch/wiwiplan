import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; ideaId: string; imageId: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const { ideaId, imageId } = await params
    const result = await prisma.contentIdeaImage.deleteMany({
      where: { id: imageId, ideaId, idea: { planning: { userId: session.user.id } } },
    })
    if (result.count === 0) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error al eliminar imagen:", error)
    return NextResponse.json({ error: "Error al eliminar la imagen" }, { status: 500 })
  }
}

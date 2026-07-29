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
    const { tagIds } = body as { tagIds: string[] }

    await prisma.contentIdeaTag.deleteMany({ where: { contentIdeaId: id } })
    if (tagIds.length > 0) {
      await prisma.contentIdeaTag.createMany({
        data: tagIds.map((tagId) => ({ contentIdeaId: id, tagId })),
      })
    }
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Error al actualizar tags" }, { status: 500 })
  }
}

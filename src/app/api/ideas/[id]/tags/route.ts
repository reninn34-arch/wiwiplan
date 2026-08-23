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

    if (!Array.isArray(tagIds)) {
      return NextResponse.json({ error: "tagIds requerido" }, { status: 400 })
    }

    const idea = await prisma.contentIdea.findFirst({
      where: { id, planning: { userId: session.user.id } },
      select: { id: true },
    })
    if (!idea) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 })
    }

    const validTags = await prisma.tag.findMany({
      where: { id: { in: tagIds }, userId: session.user.id },
      select: { id: true },
    })

    await prisma.contentIdeaTag.deleteMany({ where: { contentIdeaId: id } })
    if (validTags.length > 0) {
      await prisma.contentIdeaTag.createMany({
        data: validTags.map((tag) => ({ contentIdeaId: id, tagId: tag.id })),
      })
    }

    const updated = await prisma.contentIdea.findUnique({
      where: { id },
      select: {
        id: true,
        contentIdeaTags: {
          select: { tag: { select: { id: true, name: true, color: true } } },
        },
      },
    })

    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: "Error al actualizar tags" }, { status: 500 })
  }
}

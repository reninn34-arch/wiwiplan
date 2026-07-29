import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string; ideaId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const { ideaId } = await params
    const body = await request.json()

    const idea = await prisma.contentIdea.updateMany({
      where: { id: ideaId },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.postType !== undefined ? { postType: body.postType } : {}),
        ...(body.platform !== undefined ? { platform: body.platform } : {}),
        ...(body.referenceUrl !== undefined ? { referenceUrl: body.referenceUrl } : {}),
        ...(body.referenceEmbed !== undefined ? { referenceEmbed: body.referenceEmbed } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.order !== undefined ? { order: body.order } : {}),
        ...(body.pilar !== undefined ? { pilar: body.pilar } : {}),
        ...(body.priority !== undefined ? { priority: body.priority } : {}),
        ...(body.storyboardId !== undefined ? { storyboardId: body.storyboardId || null } : {}),
        ...(body.dueDate !== undefined ? { dueDate: body.dueDate ? new Date(body.dueDate) : null } : {}),
      },
    })
    return NextResponse.json(idea)
  } catch {
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string; ideaId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const { ideaId } = await params
    await prisma.contentIdea.delete({ where: { id: ideaId } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { ImageError, normalizeImageDataUrl } from "@/lib/image-processing.server"

type AuthResult = { ok: false; response: NextResponse } | { ok: true; userId: string }

async function getSessionOrUnauthorized(): Promise<AuthResult> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { ok: false, response: NextResponse.json({ error: "No autorizado" }, { status: 401 }) }
    }
    return { ok: true, userId: session.user.id }
  } catch (error) {
    console.error("Error de sesión:", error)
    return { ok: false, response: NextResponse.json({ error: "Error de autenticación" }, { status: 500 }) }
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string; ideaId: string }> }) {
  const authResult = await getSessionOrUnauthorized()
  if (!authResult.ok) return authResult.response

  try {
    const { ideaId } = await params
    const body = await request.json()
    const referenceEmbed =
      body.referenceEmbed !== undefined
        ? await normalizeImageDataUrl(body.referenceEmbed)
        : undefined

    const idea = await prisma.contentIdea.updateMany({
      where: { id: ideaId, planning: { userId: authResult.userId } },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.postType !== undefined ? { postType: body.postType } : {}),
        ...(body.platform !== undefined ? { platform: body.platform } : {}),
        ...(body.referenceUrl !== undefined ? { referenceUrl: body.referenceUrl } : {}),
        ...(referenceEmbed !== undefined ? { referenceEmbed } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.order !== undefined ? { order: body.order } : {}),
        ...(body.pilar !== undefined ? { pilar: body.pilar } : {}),
        ...(body.priority !== undefined ? { priority: body.priority } : {}),
        ...(body.storyboardId !== undefined ? { storyboardId: body.storyboardId || null } : {}),
        ...(body.dueDate !== undefined
          ? {
              dueDate: body.dueDate ? new Date(body.dueDate) : null,
              // Mover de día es una cita nueva: el aviso vuelve a quedar
              // pendiente, como al reprogramar desde el panel.
              notifiedAt: null,
            }
          : {}),
      },
    })
    if (idea.count === 0) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 })
    }
    return NextResponse.json(idea)
  } catch (error) {
    console.error("Error al actualizar idea:", error)
    if (error instanceof ImageError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string; ideaId: string }> }) {
  const authResult = await getSessionOrUnauthorized()
  if (!authResult.ok) return authResult.response

  try {
    const { ideaId } = await params
    const result = await prisma.contentIdea.deleteMany({
      where: { id: ideaId, planning: { userId: authResult.userId } },
    })
    if (result.count === 0) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error al eliminar idea:", error)
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * El cliente comenta una pieza desde el enlace compartido.
 *
 * El permiso es el enlace mismo. Antes el comentario iba directo a la idea, sin
 * mirar ningún enlace: cualquiera con el id de una pieza podía leer y escribir
 * comentarios, y seguía pudiendo después de que el enlace venciera o se
 * regenerara, que es justo la forma de cerrarle la puerta a alguien.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const body = await request.json()

    const shareLink = await prisma.shareLink.findUnique({
      where: { token },
      select: { planningId: true, expiresAt: true },
    })
    if (!shareLink) {
      return NextResponse.json({ error: "Enlace no válido" }, { status: 404 })
    }
    if (shareLink.expiresAt && new Date() > shareLink.expiresAt) {
      return NextResponse.json({ error: "Enlace expirado" }, { status: 410 })
    }

    const text = typeof body.text === "string" ? body.text.trim() : ""
    if (!text || text.length > 2000) {
      return NextResponse.json({ error: "Comentario inválido" }, { status: 400 })
    }
    const authorName =
      typeof body.authorName === "string" && body.authorName.trim()
        ? body.authorName.trim().slice(0, 60)
        : "Cliente"

    // La pieza tiene que ser de este plan: el enlace de un mes no abre los demás.
    const idea = await prisma.contentIdea.findFirst({
      where: { id: typeof body.ideaId === "string" ? body.ideaId : "", planningId: shareLink.planningId },
      select: { id: true, title: true, planningId: true, planning: { select: { userId: true } } },
    })
    if (!idea) {
      return NextResponse.json({ error: "Pieza no encontrada" }, { status: 404 })
    }

    const comment = await prisma.comment.create({
      data: { contentIdeaId: idea.id, authorName, text },
    })

    await prisma.notification.create({
      data: {
        userId: idea.planning.userId,
        type: "comment",
        title: "Nuevo comentario",
        message: `"${text.slice(0, 120)}${text.length > 120 ? "…" : ""}" en "${idea.title}"`,
        // Directo a la conversación de la pieza: el aviso dice de cuál se
        // trata, así que abrir el mes y buscarla era un paso que sobraba.
        link: `/planning/${idea.planningId}?idea=${idea.id}&ver=comentarios`,
      },
    })

    return NextResponse.json(comment, { status: 201 })
  } catch (error) {
    console.error("Error al comentar desde el enlace:", error)
    return NextResponse.json({ error: "Error al crear comentario" }, { status: 500 })
  }
}

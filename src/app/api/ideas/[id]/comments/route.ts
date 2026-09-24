import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

/**
 * La conversación de una pieza, del lado del creador.
 *
 * Sólo con sesión y sólo sobre piezas propias. El cliente comenta por
 * `/api/share/[token]/comments`, que valida el enlace; esta ruta antes no
 * validaba nada y dejaba leer y escribir en la pieza de cualquiera.
 */

async function ownIdea(ideaId: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }) }
  const idea = await prisma.contentIdea.findFirst({
    where: { id: ideaId, planning: { userId: session.user.id } },
    select: { id: true },
  })
  if (!idea) return { error: NextResponse.json({ error: "No encontrada" }, { status: 404 }) }
  return { idea, user: session.user }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const owned = await ownIdea(id)
    if (owned.error) return owned.error

    const comments = await prisma.comment.findMany({
      where: { contentIdeaId: owned.idea.id },
      orderBy: { createdAt: "asc" },
    })
    return NextResponse.json(comments)
  } catch {
    return NextResponse.json({ error: "Error" }, { status: 500 })
  }
}

/**
 * El creador responde. La respuesta sale en el enlace del cliente, debajo de
 * lo que pidió, así la conversación queda junto a la pieza y no en un chat
 * aparte donde nadie la encuentra el mes siguiente.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const owned = await ownIdea(id)
    if (owned.error) return owned.error

    const body = await request.json()
    const text = typeof body.text === "string" ? body.text.trim() : ""
    if (!text || text.length > 2000) {
      return NextResponse.json({ error: "Comentario inválido" }, { status: 400 })
    }

    const comment = await prisma.comment.create({
      data: {
        contentIdeaId: owned.idea.id,
        authorName: (owned.user.name || owned.user.email?.split("@")[0] || "Estudio").slice(0, 60),
        text,
        byOwner: true,
      },
    })
    return NextResponse.json(comment, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Error al crear comentario" }, { status: 500 })
  }
}

/** Quitar un comentario: el spam, la prueba, lo que se escribió en la pieza equivocada. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const owned = await ownIdea(id)
    if (owned.error) return owned.error

    const commentId = request.nextUrl.searchParams.get("commentId") ?? ""
    const result = await prisma.comment.deleteMany({
      where: { id: commentId, contentIdeaId: owned.idea.id },
    })
    if (result.count === 0) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 })
  }
}

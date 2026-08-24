import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const { id } = await params
    const planning = await prisma.planning.findFirst({
      where: { id, userId: session.user.id },
      include: {
        client: { select: { id: true, name: true, email: true, logo: true } },
        contentIdeas: { orderBy: { order: "asc" } },
        storyboards: {
          orderBy: { createdAt: "desc" },
          include: { panels: { orderBy: { order: "asc" } } },
        },
        shareLinks: { orderBy: { createdAt: "desc" } },
      },
    })

    if (!planning) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 })
    }

    return NextResponse.json(planning)
  } catch (error) {
    console.error("Error fetching planning:", error)
    return NextResponse.json({ error: "Error al obtener" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = await request.json()

    // `priceCents` ya no se acepta acá: es la suma de las líneas del mes y se
    // cambia por /items, que es lo único que lo recalcula.

    const planning = await prisma.planning.updateMany({
      where: { id, userId: session.user.id },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.period !== undefined ? { period: body.period } : {}),
        ...(body.targetAudience !== undefined ? { targetAudience: body.targetAudience } : {}),
        ...(body.goals !== undefined ? { goals: body.goals } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.clientId !== undefined ? { clientId: body.clientId } : {}),
      },
    })

    if (planning.count === 0) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating planning:", error)
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const { id } = await params
    await prisma.planning.deleteMany({ where: { id, userId: session.user.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting planning:", error)
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 })
  }
}

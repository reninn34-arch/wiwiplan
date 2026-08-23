import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { panelSelect } from "@/lib/media"
import { panelsWithImage } from "@/lib/media.server"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = await request.json()

    const planning = await prisma.planning.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true },
    })
    if (!planning) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 })
    }

    const storyboard = await prisma.storyboard.create({
      data: {
        planningId: id,
        title: body.title ?? "Storyboard",
        description: body.description ?? "",
        createdBy: session.user.id,
      },
    })
    return NextResponse.json(storyboard, { status: 201 })
  } catch (error) {
    console.error("Error creating storyboard:", error)
    return NextResponse.json({ error: "Error al crear storyboard" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { storyboardId, title } = body

    if (!storyboardId || title === undefined) {
      return NextResponse.json({ error: "storyboardId y title requeridos" }, { status: 400 })
    }

    const planning = await prisma.planning.findFirst({
      where: { id: (await params).id, userId: session.user.id },
      select: { id: true },
    })
    if (!planning) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 })
    }

    await prisma.storyboard.updateMany({
      where: { id: storyboardId, planningId: planning.id },
      data: { title },
    })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Error al actualizar storyboard" }, { status: 500 })
  }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const { id } = await params
    const planning = await prisma.planning.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true },
    })
    if (!planning) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 })
    }

    const storyboards = await prisma.storyboard.findMany({
      where: { planningId: id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        description: true,
        panels: { orderBy: { order: "asc" }, select: panelSelect },
      },
    })

    const withImage = await panelsWithImage(storyboards.map((s) => s.id))

    return NextResponse.json(
      storyboards.map((sb) => ({
        ...sb,
        panels: sb.panels.map((panel) => ({ ...panel, hasImage: withImage.has(panel.id) })),
      })),
    )
  } catch {
    return NextResponse.json({ error: "Error al obtener storyboards" }, { status: 500 })
  }
}

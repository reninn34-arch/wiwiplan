import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { panelSelect } from "@/lib/media"
import { ImageError, normalizeImageDataUrl } from "@/lib/image-processing.server"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; panelId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const { panelId } = await params
    const body = await request.json()

    const storyboard = await prisma.storyboard.findFirst({
      where: { id: panelId, planning: { userId: session.user.id } },
      select: { id: true },
    })
    if (!storyboard) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 })
    }

    const count = await prisma.storyboardPanel.count({ where: { storyboardId: panelId } })
    const imageUrl = await normalizeImageDataUrl(body.imageUrl ?? "")

    const panel = await prisma.storyboardPanel.create({
      data: {
        storyboardId: panelId,
        sceneNumber: count + 1,
        imageUrl,
        description: body.description ?? "",
        duration: body.duration ?? "",
        notes: body.notes ?? "",
        order: count,
      },
      select: panelSelect,
    })
    return NextResponse.json({ ...panel, hasImage: Boolean(imageUrl) }, { status: 201 })
  } catch (error) {
    if (error instanceof ImageError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error("Error creating panel:", error)
    return NextResponse.json({ error: "Error al crear panel" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string; panelId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const { panelId } = await params
    const body = await request.json()

    const imageUrl =
      body.imageUrl !== undefined ? await normalizeImageDataUrl(body.imageUrl) : undefined

    const panel = await prisma.storyboardPanel.updateMany({
      where: { id: panelId, storyboard: { planning: { userId: session.user.id } } },
      data: {
        ...(imageUrl !== undefined ? { imageUrl } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.duration !== undefined ? { duration: body.duration } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
        ...(body.sceneNumber !== undefined ? { sceneNumber: body.sceneNumber } : {}),
        ...(body.order !== undefined ? { order: body.order } : {}),
      },
    })
    if (panel.count === 0) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 })
    }
    return NextResponse.json(panel)
  } catch (error) {
    if (error instanceof ImageError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "Error al actualizar panel" }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string; panelId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const { panelId } = await params
    const result = await prisma.storyboardPanel.deleteMany({
      where: { id: panelId, storyboard: { planning: { userId: session.user.id } } },
    })
    if (result.count === 0) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Error al eliminar panel" }, { status: 500 })
  }
}

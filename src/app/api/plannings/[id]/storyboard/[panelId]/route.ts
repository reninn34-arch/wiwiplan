import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; panelId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const { panelId } = await params
    const body = await request.json()

    const count = await prisma.storyboardPanel.count({ where: { storyboardId: panelId } })

    const panel = await prisma.storyboardPanel.create({
      data: {
        storyboardId: panelId,
        sceneNumber: count + 1,
        imageUrl: body.imageUrl ?? "",
        description: body.description ?? "",
        duration: body.duration ?? "",
        notes: body.notes ?? "",
        order: count,
      },
    })
    return NextResponse.json(panel, { status: 201 })
  } catch (error) {
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

    const panel = await prisma.storyboardPanel.update({
      where: { id: panelId },
      data: {
        ...(body.imageUrl !== undefined ? { imageUrl: body.imageUrl } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.duration !== undefined ? { duration: body.duration } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
        ...(body.sceneNumber !== undefined ? { sceneNumber: body.sceneNumber } : {}),
        ...(body.order !== undefined ? { order: body.order } : {}),
      },
    })
    return NextResponse.json(panel)
  } catch {
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
    await prisma.storyboardPanel.delete({ where: { id: panelId } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Error al eliminar panel" }, { status: 500 })
  }
}

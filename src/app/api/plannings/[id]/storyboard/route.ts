import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = await request.json()

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

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const { id } = await params
    const storyboards = await prisma.storyboard.findMany({
      where: { planningId: id },
      orderBy: { createdAt: "desc" },
      include: { panels: { orderBy: { order: "asc" } } },
    })
    return NextResponse.json(storyboards)
  } catch {
    return NextResponse.json({ error: "Error al obtener storyboards" }, { status: 500 })
  }
}

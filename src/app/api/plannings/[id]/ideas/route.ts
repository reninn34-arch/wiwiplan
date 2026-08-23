import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { ImageError, normalizeImageDataUrl } from "@/lib/image-processing.server"

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

    const count = await prisma.contentIdea.count({ where: { planningId: id } })
    const referenceEmbed = await normalizeImageDataUrl(body.referenceEmbed ?? "")

    const idea = await prisma.contentIdea.create({
      data: {
        planningId: id,
        title: body.title ?? "Sin título",
        description: body.description ?? "",
        postType: body.postType ?? "OTHER",
        platform: body.platform ?? "OTHER",
        referenceUrl: body.referenceUrl ?? "",
        referenceEmbed,
        status: body.status ?? "IDEA",
        pilar: body.pilar ?? "",
        priority: body.priority ?? "MEDIUM",
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        storyboardId: body.storyboardId ?? null,
        order: body.order ?? count,
        createdBy: session.user.id,
      },
    })
    return NextResponse.json(idea, { status: 201 })
  } catch (error) {
    if (error instanceof ImageError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error("Error creating idea:", error)
    return NextResponse.json({ error: "Error al crear idea" }, { status: 500 })
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

    const ideas = await prisma.contentIdea.findMany({
      where: { planningId: id },
      orderBy: { order: "asc" },
      include: { contentIdeaTags: { include: { tag: true } } },
    })
    return NextResponse.json(ideas)
  } catch {
    return NextResponse.json({ error: "Error al obtener ideas" }, { status: 500 })
  }
}

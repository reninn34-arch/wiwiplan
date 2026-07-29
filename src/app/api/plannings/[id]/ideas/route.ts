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

    const count = await prisma.contentIdea.count({ where: { planningId: id } })

    const idea = await prisma.contentIdea.create({
      data: {
        planningId: id,
        title: body.title,
        description: body.description ?? "",
        postType: body.postType ?? "OTHER",
        platform: body.platform ?? "OTHER",
        referenceUrl: body.referenceUrl ?? "",
        referenceEmbed: body.referenceEmbed ?? "",
        status: body.status ?? "IDEA",
        order: body.order ?? count,
        createdBy: session.user.id,
      },
    })
    return NextResponse.json(idea, { status: 201 })
  } catch (error) {
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

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const comments = await prisma.comment.findMany({
      where: { contentIdeaId: id },
      orderBy: { createdAt: "asc" },
    })
    return NextResponse.json(comments)
  } catch {
    return NextResponse.json({ error: "Error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()

    const text = typeof body.text === "string" ? body.text.trim() : ""
    if (!text || text.length > 2000) {
      return NextResponse.json({ error: "Comentario inválido" }, { status: 400 })
    }
    const authorName =
      typeof body.authorName === "string" && body.authorName.trim()
        ? body.authorName.trim().slice(0, 60)
        : "Cliente"

    const comment = await prisma.comment.create({
      data: {
        contentIdeaId: id,
        authorName,
        text,
      },
    })

    const idea = await prisma.contentIdea.findUnique({
      where: { id },
      select: { title: true, planningId: true, createdBy: true },
    })

    if (idea) {
      await prisma.notification.create({
        data: {
          userId: idea.createdBy,
          type: "comment",
          title: "Nuevo comentario",
          message: `"${text.slice(0, 120)}${text.length > 120 ? "…" : ""}" en "${idea.title}"`,
          link: `/planning/${idea.planningId}`,
        },
      })
    }

    return NextResponse.json(comment, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Error al crear comentario" }, { status: 500 })
  }
}

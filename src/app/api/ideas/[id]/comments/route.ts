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
    const comment = await prisma.comment.create({
      data: {
        contentIdeaId: id,
        authorName: body.authorName ?? "Cliente",
        text: body.text,
      },
    })
    return NextResponse.json(comment, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Error al crear comentario" }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const tags = await prisma.tag.findMany({
    where: { userId: session.user.id },
    orderBy: { name: "asc" },
  })
  return NextResponse.json(tags)
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const tag = await prisma.tag.create({
      data: {
        name: body.name,
        color: body.color ?? "#6366f1",
        userId: session.user.id,
      },
    })
    return NextResponse.json(tag, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Error al crear tag" }, { status: 500 })
  }
}

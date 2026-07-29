import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const planning = await prisma.planning.create({
      data: {
        title: body.title ?? "Sin título",
        description: body.description ?? "",
        targetAudience: body.targetAudience ?? "",
        goals: body.goals ?? "",
        notes: body.notes ?? "",
        clientId: body.clientId ?? null,
        userId: session.user.id,
      },
    })
    return NextResponse.json(planning, { status: 201 })
  } catch (error) {
    console.error("Error creating planning:", error)
    return NextResponse.json({ error: "Error al crear" }, { status: 500 })
  }
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const plannings = await prisma.planning.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
      include: {
        client: { select: { id: true, name: true } },
        _count: { select: { contentIdeas: true, storyboards: true } },
      },
    })
    return NextResponse.json(plannings)
  } catch (error) {
    console.error("Error fetching plannings:", error)
    return NextResponse.json({ error: "Error al obtener" }, { status: 500 })
  }
}

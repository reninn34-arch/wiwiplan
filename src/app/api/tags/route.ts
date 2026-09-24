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
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 40) : ""
    if (!name) {
      return NextResponse.json({ error: "El tag necesita un nombre" }, { status: 400 })
    }
    const color =
      typeof body.color === "string" && /^#[0-9a-f]{6}$/i.test(body.color) ? body.color : "#6366f1"

    // El nombre es único por cuenta: pedir uno que ya existe devuelve ése en
    // vez de chocar con la restricción y responder un error que no explica nada.
    const existing = await prisma.tag.findFirst({
      where: { userId: session.user.id, name: { equals: name, mode: "insensitive" } },
    })
    if (existing) return NextResponse.json(existing)

    const tag = await prisma.tag.create({
      data: { name, color, userId: session.user.id },
    })
    return NextResponse.json(tag, { status: 201 })
  } catch (error) {
    console.error("Error al crear tag:", error)
    return NextResponse.json({ error: "Error al crear tag" }, { status: 500 })
  }
}

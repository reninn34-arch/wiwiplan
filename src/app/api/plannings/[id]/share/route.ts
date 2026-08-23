import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { nanoid } from "nanoid"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const { id } = await params
    let expiresAt: Date | null = null
    try {
      const body = await request.json()
      expiresAt = body.expiresAt ? new Date(body.expiresAt) : null
    } catch {
      // no body sent, default to no expiration
    }

    const planning = await prisma.planning.findFirst({
      where: { id, userId: session.user.id },
    })
    if (!planning) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 })
    }

    // Generar de nuevo reemplaza el enlace anterior: queda uno solo vigente y
    // los tokens viejos dejan de funcionar en el momento.
    const shareLink = await prisma.$transaction(async (tx) => {
      await tx.shareLink.deleteMany({ where: { planningId: id } })
      return tx.shareLink.create({
        data: { token: nanoid(32), planningId: id, expiresAt },
      })
    })

    return NextResponse.json(shareLink, { status: 201 })
  } catch (error) {
    console.error("Error creating share link:", error)
    return NextResponse.json({ error: "Error al crear enlace" }, { status: 500 })
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

    const links = await prisma.shareLink.findMany({
      where: { planningId: id },
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json(links)
  } catch {
    return NextResponse.json({ error: "Error al obtener enlaces" }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { ImageError, normalizeAvatarDataUrl } from "@/lib/image-processing.server"
import { parseRateCents } from "@/lib/money-input"

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = await request.json()

    const email = typeof body?.email === "string" ? body.email.trim() : ""
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "El correo no es válido" }, { status: 400 })
    }

    // El logo sólo se toca si viene en el pedido: editar nombre o correo no
    // tiene que borrar el que ya estaba cargado.
    const data: Record<string, unknown> = {
      name: body.name,
      email,
    }
    if (body?.logo !== undefined) {
      data.logo = body.logo ? await normalizeAvatarDataUrl(body.logo) : null
    }
    if (body?.planName !== undefined) {
      data.planName = typeof body.planName === "string" ? body.planName.trim() : ""
    }
    if (body?.rateCents !== undefined) {
      const rate = parseRateCents(body.rateCents)
      if (rate === null) {
        return NextResponse.json({ error: "La tarifa no es válida" }, { status: 400 })
      }
      data.rateCents = rate
    }

    await prisma.client.updateMany({
      where: { id, userId: session.user.id },
      data,
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof ImageError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error("Error al actualizar cliente:", error)
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const { id } = await params
    await prisma.client.deleteMany({ where: { id, userId: session.user.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error al eliminar cliente:", error)
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 })
  }
}

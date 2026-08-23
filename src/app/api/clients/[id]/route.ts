import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { ImageError, normalizeAvatarDataUrl } from "@/lib/image-processing.server"

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = await request.json()
    const logo = body.logo ? await normalizeAvatarDataUrl(body.logo) : null

    await prisma.client.updateMany({
      where: { id, userId: session.user.id },
      data: { name: body.name, email: body.email ?? "", logo },
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

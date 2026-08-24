import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { ImageError, normalizeAvatarDataUrl } from "@/lib/image-processing.server"
import { parseRateCents } from "@/lib/money-input"

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const logo = body.logo ? await normalizeAvatarDataUrl(body.logo) : null

    const rateCents = parseRateCents(body.rateCents)
    if (rateCents === null) {
      return NextResponse.json({ error: "La tarifa no es válida" }, { status: 400 })
    }

    const client = await prisma.client.create({
      data: {
        name: body.name,
        email: body.email ?? "",
        logo,
        planName: typeof body.planName === "string" ? body.planName.trim() : "",
        rateCents,
        userId: session.user.id,
      },
    })
    return NextResponse.json(client, { status: 201 })
  } catch (error) {
    if (error instanceof ImageError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error("Error creating client:", error)
    return NextResponse.json({ error: "Error al crear cliente" }, { status: 500 })
  }
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const clients = await prisma.client.findMany({
      where: { userId: session.user.id },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        planName: true,
        rateCents: true,
        _count: { select: { plannings: true } },
      },
    })
    return NextResponse.json(clients)
  } catch {
    return NextResponse.json({ error: "Error al obtener clientes" }, { status: 500 })
  }
}

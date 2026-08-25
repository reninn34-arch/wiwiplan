import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { isSocialNetwork, normalizeHandle } from "@/lib/social"

/**
 * Las redes de un cliente. Se cargan una vez acá y después cada pieza sólo
 * elige entre ellas, en vez de repetir la lista completa de redes cada vez.
 */

const ACCOUNT_SELECT = { id: true, network: true, handle: true, mode: true } as const

async function ownsClient(clientId: string, userId: string) {
  const client = await prisma.client.findFirst({
    where: { id: clientId, userId },
    select: { id: true },
  })
  return Boolean(client)
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const { id } = await params
    if (!(await ownsClient(id, session.user.id))) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 })
    }

    const accounts = await prisma.clientAccount.findMany({
      where: { clientId: id },
      orderBy: { createdAt: "asc" },
      select: ACCOUNT_SELECT,
    })
    return NextResponse.json(accounts)
  } catch (error) {
    console.error("Error al listar las redes del cliente:", error)
    return NextResponse.json({ error: "Error al listar" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = await request.json()

    if (!isSocialNetwork(body?.network)) {
      return NextResponse.json({ error: "Esa red no existe" }, { status: 400 })
    }
    if (!(await ownsClient(id, session.user.id))) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 })
    }

    const existing = await prisma.clientAccount.findFirst({
      where: { clientId: id, network: body.network },
      select: { id: true },
    })
    if (existing) {
      return NextResponse.json({ error: "Ese cliente ya tiene esa red" }, { status: 409 })
    }

    const account = await prisma.clientAccount.create({
      data: {
        clientId: id,
        network: body.network,
        handle: normalizeHandle(typeof body?.handle === "string" ? body.handle : ""),
        // Siempre nace en "Te avisamos": lo automático exige cuenta Business
        // conectada, y eso todavía no existe. Prometerlo sería mentir.
        mode: "ASSISTED",
      },
      select: ACCOUNT_SELECT,
    })
    return NextResponse.json(account, { status: 201 })
  } catch (error) {
    console.error("Error al agregar la red:", error)
    return NextResponse.json({ error: "Error al agregar" }, { status: 500 })
  }
}

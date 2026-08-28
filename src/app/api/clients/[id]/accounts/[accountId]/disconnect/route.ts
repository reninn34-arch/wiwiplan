import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

/**
 * Desconecta la cuenta: borra el token y vuelve al carril asistido.
 *
 * No revoca el permiso del lado de Meta —eso lo hace el dueño desde su propia
 * configuración—, pero deja a la app sin poder publicar, que es lo que se pide
 * al tocar "desconectar".
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; accountId: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const { id, accountId } = await params
    const updated = await prisma.clientAccount.updateMany({
      where: { id: accountId, clientId: id, client: { userId: session.user.id } },
      data: {
        externalId: null,
        externalName: null,
        pageId: null,
        accessToken: null,
        tokenExpiresAt: null,
        connectedAt: null,
        mode: "ASSISTED",
      },
    })
    if (updated.count === 0) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error al desconectar la cuenta:", error)
    return NextResponse.json({ error: "No se pudo desconectar" }, { status: 500 })
  }
}

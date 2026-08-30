import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { canAutoPublish, isPublishMode, networkLabels, normalizeHandle, type SocialNetwork } from "@/lib/social"

/** Ownership por la relación: la cuenta es del cliente y el cliente del usuario. */
function ownedWhere(accountId: string, clientId: string, userId: string) {
  return { id: accountId, clientId, client: { userId } }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; accountId: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const { id, accountId } = await params
    const body = await request.json()

    if (body?.mode !== undefined && !isPublishMode(body.mode)) {
      return NextResponse.json({ error: "Ese modo no existe" }, { status: 400 })
    }

    // El modo automático sólo se acepta con la cuenta realmente conectada. La
    // comprobación se quedó desde antes de que existiera el publicador, y sigue
    // valiendo por otra razón: prometer que algo sale solo cuando no hay token
    // deja publicaciones que nunca salen y nadie sabe por qué.
    if (body?.mode === "AUTOMATIC") {
      const conectada = await prisma.clientAccount.findFirst({
        where: { ...ownedWhere(accountId, id, session.user.id), NOT: { externalId: null } },
        select: { accessToken: true, network: true },
      })
      if (!conectada?.accessToken) {
        return NextResponse.json(
          { error: "Conecta la cuenta antes de ponerla en automático" },
          { status: 400 },
        )
      }
      // Sin publicador detrás, "sale sola" sería una promesa vacía: la pieza
      // se quedaría esperando una hora que nunca llega y sin aviso, porque el
      // aviso es justo lo que el modo automático desactiva.
      const red = conectada.network as SocialNetwork
      if (!canAutoPublish(red)) {
        return NextResponse.json(
          {
            error: `Todavía no se puede publicar solo en ${networkLabels[red]}. Déjala en «Te avisamos».`,
          },
          { status: 400 },
        )
      }
    }

    const updated = await prisma.clientAccount.updateMany({
      where: ownedWhere(accountId, id, session.user.id),
      data: {
        ...(typeof body?.handle === "string" ? { handle: normalizeHandle(body.handle) } : {}),
        ...(body?.mode !== undefined ? { mode: body.mode } : {}),
      },
    })
    if (updated.count === 0) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 })
    }

    const account = await prisma.clientAccount.findFirst({
      where: { id: accountId },
      select: { id: true, network: true, handle: true, mode: true },
    })
    return NextResponse.json(account)
  } catch (error) {
    console.error("Error al actualizar la red:", error)
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; accountId: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const { id, accountId } = await params
    // Al borrar la red se van sus destinos: una pieza no puede quedar apuntando
    // a una cuenta que ya no existe. Lo hace la cascada del esquema.
    const deleted = await prisma.clientAccount.deleteMany({
      where: ownedWhere(accountId, id, session.user.id),
    })
    if (deleted.count === 0) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error al quitar la red:", error)
    return NextResponse.json({ error: "Error al quitar" }, { status: 500 })
  }
}

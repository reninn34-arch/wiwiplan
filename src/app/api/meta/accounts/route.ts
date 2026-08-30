import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { unseal } from "@/lib/secret-box.server"
import { listConnectableAccounts, type ConnectableNetwork } from "@/lib/meta.server"
import { restoreAttempts } from "@/lib/auto-publish.server"

/**
 * Las cuentas que la autorización dejó disponibles, para elegir cuál es la de
 * este cliente. Aparece cuando una agencia administra varias páginas desde su
 * propio Facebook y la autorización devuelve más de una.
 */
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const accountId = request.nextUrl.searchParams.get("accountId") ?? ""
    const account = await prisma.clientAccount.findFirst({
      where: { id: accountId, client: { userId: session.user.id } },
      select: { id: true, accessToken: true, network: true },
    })
    if (!account) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 })
    }

    const token = unseal(account.accessToken)
    if (!token) {
      return NextResponse.json(
        { error: "La conexión caducó. Vuelve a conectar la cuenta." },
        { status: 409 },
      )
    }

    // La red importa para listar: en Instagram sólo valen las páginas con una
    // cuenta vinculada; en Facebook vale cualquiera.
    return NextResponse.json(
      await listConnectableAccounts(token, account.network as ConnectableNetwork),
    )
  } catch (error) {
    console.error("[meta] No se pudieron listar las cuentas:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al listar" },
      { status: 502 },
    )
  }
}

/** Fija cuál de las cuentas disponibles es la de este cliente. */
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const accountId = typeof body?.accountId === "string" ? body.accountId : ""
    const externalId = typeof body?.externalId === "string" ? body.externalId : ""

    const account = await prisma.clientAccount.findFirst({
      where: { id: accountId, client: { userId: session.user.id } },
      select: { id: true, accessToken: true, network: true },
    })
    if (!account) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 })
    }

    const token = unseal(account.accessToken)
    if (!token) {
      return NextResponse.json({ error: "La conexión caducó" }, { status: 409 })
    }

    // Se vuelve a consultar en vez de confiar en lo que manda el navegador:
    // así nadie puede fijar una cuenta que la autorización no concedió.
    const available = await listConnectableAccounts(token, account.network as ConnectableNetwork)
    const chosen = available.find((a) => a.externalId === externalId)
    if (!chosen) {
      return NextResponse.json({ error: "Esa cuenta no está autorizada" }, { status: 400 })
    }

    const { seal } = await import("@/lib/secret-box.server")
    const updated = await prisma.clientAccount.update({
      where: { id: account.id },
      data: {
        externalId: chosen.externalId,
        externalName: chosen.name,
        pageId: chosen.pageId,
        // Se guarda el token de la página, que es el que publica; el del
        // usuario ya cumplió su función de listar.
        accessToken: seal(chosen.pageToken),
        connectedAt: new Date(),
      },
      select: { id: true, externalId: true, externalName: true, connectedAt: true },
    })

    // La cuenta vuelve a servir: sus piezas pendientes recuperan los intentos
    // que gastaron mientras estaba caída.
    await restoreAttempts(account.id)

    return NextResponse.json(updated)
  } catch (error) {
    console.error("[meta] No se pudo fijar la cuenta:", error)
    return NextResponse.json({ error: "No se pudo conectar" }, { status: 500 })
  }
}

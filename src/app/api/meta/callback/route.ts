import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { seal } from "@/lib/secret-box.server"
import {
  diagnosePages,
  exchangeCode,
  listConnectableAccounts,
  longLivedToken,
  verifyState,
} from "@/lib/meta.server"

/**
 * Vuelta de Meta tras autorizar.
 *
 * No usa la sesión para saber de quién es la conexión: usa el `state` firmado,
 * porque quien autoriza puede ser el cliente desde su propio teléfono, sin
 * haber iniciado sesión en WiwiPlan.
 */
function backTo(request: NextRequest, params: Record<string, string>) {
  const url = new URL("/dashboard", request.url)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return NextResponse.redirect(url)
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const error = params.get("error_description") ?? params.get("error")
  if (error) {
    return backTo(request, { conexion: "cancelada", detalle: error.slice(0, 140) })
  }

  const state = verifyState(params.get("state") ?? "")
  if (!state) {
    return backTo(request, { conexion: "invalida" })
  }

  const account = await prisma.clientAccount.findFirst({
    where: { id: state.accountId, client: { userId: state.userId } },
    select: { id: true, clientId: true },
  })
  if (!account) {
    return backTo(request, { conexion: "invalida" })
  }

  try {
    const short = await exchangeCode(params.get("code") ?? "")
    const { token, expiresAt } = await longLivedToken(short)
    const available = await listConnectableAccounts(token)

    if (available.length === 0) {
      // El caso más frecuente y el que más confunde. Se cuentan las páginas
      // para distinguir las dos causas, que se arreglan en sitios distintos:
      // sin páginas es a quién administras; páginas sin Instagram es la
      // vinculación de cada cuenta.
      const diag = await diagnosePages(token).catch(() => ({ pages: 0, withInstagram: 0 }))
      return backTo(request, {
        conexion: "sin-cuentas",
        cliente: account.clientId,
        paginas: String(diag.pages),
      })
    }

    // Una sola candidata: no hay nada que elegir, se conecta y listo.
    if (available.length === 1) {
      const only = available[0]
      await prisma.clientAccount.update({
        where: { id: account.id },
        data: {
          externalId: only.instagramId,
          externalName: only.username,
          pageId: only.pageId,
          accessToken: seal(only.pageToken),
          tokenExpiresAt: expiresAt,
          connectedAt: new Date(),
        },
      })
      return backTo(request, { conexion: "lista", cliente: account.clientId })
    }

    // Varias: una agencia suele administrar las páginas de todos sus clientes
    // desde un solo Facebook, así que hay que preguntar cuál es la de éste.
    await prisma.clientAccount.update({
      where: { id: account.id },
      data: { accessToken: seal(token), tokenExpiresAt: expiresAt },
    })
    return backTo(request, { conexion: "elegir", cuenta: account.id, cliente: account.clientId })
  } catch (e) {
    console.error("[meta] Falló la conexión:", e)
    const detalle = e instanceof Error ? e.message.slice(0, 140) : ""
    return backTo(request, { conexion: "error", detalle })
  }
}

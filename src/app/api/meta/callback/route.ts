import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { seal } from "@/lib/secret-box.server"
import {
  diagnosePages,
  exchangeCode,
  listConnectableAccounts,
  longLivedToken,
  verifyState,
  type ConnectableNetwork,
} from "@/lib/meta.server"
import { restoreAttempts } from "@/lib/auto-publish.server"

/**
 * Vuelta de Meta tras autorizar.
 *
 * No usa la sesión para saber de quién es la conexión: usa el `state` firmado,
 * porque quien autoriza puede ser el cliente desde su propio teléfono, sin
 * haber iniciado sesión en WiwiPlan.
 */
/**
 * Vuelve a la ficha del cliente, que es la única pantalla que sabe leer el
 * resultado. Antes volvía siempre al dashboard: el aviso se generaba, viajaba
 * en la URL y aterrizaba donde nadie lo miraba, así que la conexión fallaba en
 * silencio y parecía que el botón no hacía nada.
 *
 * Sólo cae al dashboard cuando ni siquiera se sabe de qué cliente era —un
 * `state` inválido—, porque ahí no hay ficha a la que volver.
 */
function backTo(
  request: NextRequest,
  clientId: string | null,
  params: Record<string, string>,
) {
  const url = new URL(clientId ? `/clients/${clientId}` : "/dashboard", request.url)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return NextResponse.redirect(url)
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const error = params.get("error_description") ?? params.get("error")
  if (error) {
    return backTo(request, null, { conexion: "cancelada", detalle: error.slice(0, 140) })
  }

  const state = verifyState(params.get("state") ?? "")
  if (!state) {
    return backTo(request, null, { conexion: "invalida" })
  }

  const account = await prisma.clientAccount.findFirst({
    where: { id: state.accountId, client: { userId: state.userId } },
    select: { id: true, clientId: true, network: true },
  })
  if (!account) {
    return backTo(request, null, { conexion: "invalida" })
  }

  try {
    const short = await exchangeCode(params.get("code") ?? "")
    const { token, expiresAt } = await longLivedToken(short)
    const available = await listConnectableAccounts(token, account.network as ConnectableNetwork)

    if (available.length === 0) {
      // El caso más frecuente y el que más confunde. Se cuentan las páginas
      // para distinguir las dos causas, que se arreglan en sitios distintos:
      // sin páginas es a quién administras; páginas sin Instagram es la
      // vinculación de cada cuenta.
      const diag = await diagnosePages(token).catch(() => ({ pages: 0, withInstagram: 0 }))
      return backTo(request, account.clientId, {
        conexion: "sin-cuentas",
        paginas: String(diag.pages),
      })
    }

    // Una sola candidata: no hay nada que elegir, se conecta y listo.
    if (available.length === 1) {
      const only = available[0]
      await prisma.clientAccount.update({
        where: { id: account.id },
        data: {
          externalId: only.externalId,
          externalName: only.name,
          pageId: only.pageId,
          accessToken: seal(only.pageToken),
          tokenExpiresAt: expiresAt,
          connectedAt: new Date(),
        },
      })
      // Igual que al elegir entre varias: reconectar devuelve los intentos que
      // las piezas gastaron mientras la cuenta no servía.
      await restoreAttempts(account.id)
      return backTo(request, account.clientId, { conexion: "lista" })
    }

    // Varias: una agencia suele administrar las páginas de todos sus clientes
    // desde un solo Facebook, así que hay que preguntar cuál es la de éste.
    await prisma.clientAccount.update({
      where: { id: account.id },
      data: { accessToken: seal(token), tokenExpiresAt: expiresAt },
    })
    return backTo(request, account.clientId, { conexion: "elegir", cuenta: account.id })
  } catch (e) {
    console.error("[meta] Falló la conexión:", e)
    const detalle = e instanceof Error ? e.message.slice(0, 140) : ""
    return backTo(request, account.clientId, { conexion: "error", detalle })
  }
}

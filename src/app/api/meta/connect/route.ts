import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { authorizeUrl, metaConfigured, metaRedirectUri, signState } from "@/lib/meta.server"

/**
 * Arranca la autorización de Meta para una red concreta de un cliente.
 * Redirige a Facebook; lo demás pasa en `/api/meta/callback`.
 */
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", request.url))
  }
  if (!metaConfigured()) {
    return NextResponse.json(
      { error: "Faltan META_APP_ID y META_APP_SECRET en las variables del proyecto" },
      { status: 503 },
    )
  }

  // Meta compara la URI de retorno carácter por carácter y, cuando no coincide,
  // dice "URL bloqueada" sin decir cuál esperaba. Con `?ver=1` se ve la que
  // mandamos, para poder copiarla exacta en vez de escribirla de memoria.
  if (request.nextUrl.searchParams.get("ver")) {
    return NextResponse.json({
      redirectUri: metaRedirectUri(),
      usaConfiguracion: Boolean(process.env.META_CONFIG_ID),
      appIdPresente: Boolean(process.env.META_APP_ID),
      secretPresente: Boolean(process.env.META_APP_SECRET),
    })
  }

  const accountId = request.nextUrl.searchParams.get("accountId") ?? ""
  const account = await prisma.clientAccount.findFirst({
    where: { id: accountId, client: { userId: session.user.id } },
    select: { id: true, network: true },
  })
  if (!account) {
    return NextResponse.json({ error: "Esa red no es tuya" }, { status: 404 })
  }
  if (account.network !== "INSTAGRAM" && account.network !== "FACEBOOK") {
    return NextResponse.json(
      { error: "Por ahora sólo se pueden conectar Instagram y Facebook" },
      { status: 400 },
    )
  }

  const state = signState({ accountId: account.id, userId: session.user.id })
  return NextResponse.redirect(authorizeUrl(state))
}

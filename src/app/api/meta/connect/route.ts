import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { authorizeUrl, metaConfigured, signState } from "@/lib/meta.server"

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

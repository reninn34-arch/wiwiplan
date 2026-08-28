import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { publishTarget } from "@/lib/auto-publish.server"

/**
 * Publica ahora, sin esperar a la hora. Es la única forma de probar el
 * publicador sin programar algo y quedarse mirando el reloj — y también sirve
 * cuando una pieza falló y quieres reintentarla a mano.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; ideaId: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const { id, ideaId } = await params
    const body = await request.json().catch(() => ({}))
    const accountId = typeof body?.accountId === "string" ? body.accountId : ""

    const target = await prisma.ideaTarget.findFirst({
      where: {
        ideaId,
        ...(accountId ? { accountId } : {}),
        idea: { planningId: id, planning: { userId: session.user.id } },
      },
      select: {
        accountId: true,
        containerId: true,
        attempts: true,
        publishedAt: true,
        account: { select: { mode: true, externalId: true } },
      },
    })
    if (!target) {
      return NextResponse.json({ error: "Esa red no está elegida en la pieza" }, { status: 404 })
    }
    if (target.publishedAt) {
      return NextResponse.json({ error: "Esa pieza ya salió en esa red" }, { status: 409 })
    }
    if (target.account.mode !== "AUTOMATIC" || !target.account.externalId) {
      return NextResponse.json(
        { error: "Esa cuenta no está en automático. Conéctala y ponla en «Sale sola»." },
        { status: 400 },
      )
    }

    // Se reintenta desde cero al pedirlo a mano: si quedaron intentos agotados
    // por un fallo que ya arreglaste, insistir es justamente lo que quieres.
    await prisma.ideaTarget.update({
      where: { ideaId_accountId: { ideaId, accountId: target.accountId } },
      data: { attempts: 0, lastError: null },
    })

    const result = await publishTarget({
      ideaId,
      accountId: target.accountId,
      containerId: target.containerId,
      attempts: 0,
    })

    if (result === "published") {
      return NextResponse.json({ estado: "publicada" })
    }
    if (result === "processing") {
      return NextResponse.json({
        estado: "procesando",
        mensaje: "Meta está procesando el archivo. Se publica sola en unos minutos.",
      })
    }

    const fresh = await prisma.ideaTarget.findUnique({
      where: { ideaId_accountId: { ideaId, accountId: target.accountId } },
      select: { lastError: true },
    })
    return NextResponse.json(
      { estado: "fallo", error: fresh?.lastError ?? "No se pudo publicar" },
      { status: 502 },
    )
  } catch (error) {
    console.error("Error al publicar a mano:", error)
    return NextResponse.json({ error: "Error al publicar" }, { status: 500 })
  }
}

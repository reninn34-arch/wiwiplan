import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * Lo que el cliente dice de **una** pieza, desde el enlace compartido.
 *
 * Existe aparte de aprobar el plan entero porque son decisiones distintas: un
 * cliente que quiere cambios en dos de doce piezas no puede aprobar el mes ni
 * rechazarlo, y hasta ahora sólo tenía esas dos salidas. El resultado era que
 * comentaba y el plan se quedaba en el limbo.
 *
 * Va sin sesión, como el resto del enlace compartido: quien tiene el token es
 * el cliente, y pedirle que se registre para opinar es perder la opinión.
 */

const DECISIONES = ["APPROVED", "CHANGES"] as const
type Decision = (typeof DECISIONES)[number]

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; ideaId: string }> },
) {
  try {
    const { token, ideaId } = await params
    const body = await request.json().catch(() => ({}))
    const decision = body?.decision as Decision

    if (!DECISIONES.includes(decision)) {
      return NextResponse.json({ error: "Esa decisión no existe" }, { status: 400 })
    }

    const shareLink = await prisma.shareLink.findUnique({ where: { token } })
    if (!shareLink) {
      return NextResponse.json({ error: "Enlace no válido" }, { status: 404 })
    }
    if (shareLink.expiresAt && new Date() > shareLink.expiresAt) {
      return NextResponse.json({ error: "Enlace expirado" }, { status: 410 })
    }

    // La pieza tiene que ser de **este** plan: con el token de un cliente no se
    // puede opinar sobre las piezas de otro.
    const idea = await prisma.contentIdea.findFirst({
      where: { id: ideaId, planningId: shareLink.planningId },
      select: {
        id: true,
        title: true,
        planning: { select: { userId: true, title: true } },
      },
    })
    if (!idea) {
      return NextResponse.json({ error: "Esa pieza no es de este plan" }, { status: 404 })
    }

    const updated = await prisma.contentIdea.update({
      where: { id: idea.id },
      data: { clientReview: decision, reviewedAt: new Date() },
      select: { clientReview: true, reviewedAt: true },
    })

    // Sólo se avisa de los cambios pedidos. Una aprobación es la marcha normal
    // de las cosas; que te suene el teléfono doce veces porque el cliente fue
    // aprobando el mes entero es ruido que enseña a ignorar los avisos.
    if (decision === "CHANGES") {
      await prisma.notification.create({
        data: {
          userId: idea.planning.userId,
          type: "changes",
          title: "El cliente pidió cambios",
          message: `"${idea.title || "Una pieza"}" en ${idea.planning.title}`,
          link: `/planning/${shareLink.planningId}`,
        },
      })
    }

    return NextResponse.json({
      success: true,
      clientReview: updated.clientReview,
      reviewedAt: updated.reviewedAt?.toISOString() ?? null,
    })
  } catch (error) {
    console.error("Error al registrar la revisión del cliente:", error)
    return NextResponse.json({ error: "No se pudo guardar" }, { status: 500 })
  }
}

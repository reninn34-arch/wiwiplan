import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { isValidTime } from "@/lib/social"

/**
 * Cuándo y dónde sale una pieza, en una sola operación. Va aparte del PUT
 * general de la idea porque cambia dos cosas a la vez —la fecha/hora y las
 * redes— y tienen que moverse juntas: una pieza programada sin redes no sale a
 * ningún lado, y unas redes sin fecha no salen nunca.
 */

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; ideaId: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const { id, ideaId } = await params
    const body = await request.json()

    const idea = await prisma.contentIdea.findFirst({
      where: { id: ideaId, planningId: id, planning: { userId: session.user.id } },
      select: { id: true, planning: { select: { clientId: true } } },
    })
    if (!idea) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 })
    }

    // Hora vacía es válido y quiere decir "tiene día pero todavía no hora".
    const publishTime =
      body?.publishTime === undefined ? undefined : String(body.publishTime).trim()
    if (publishTime !== undefined && publishTime !== "" && !isValidTime(publishTime)) {
      return NextResponse.json({ error: "Esa hora no es válida" }, { status: 400 })
    }

    // El día viaja como fecha pura (`2026-08-15`): la publicación es un día de
    // calendario, no un instante, así que no se corre según la zona horaria.
    let dueDate: Date | null | undefined
    if (body?.dueDate !== undefined) {
      if (!body.dueDate) {
        dueDate = null
      } else {
        const parsed = new Date(`${String(body.dueDate).slice(0, 10)}T00:00:00.000Z`)
        if (Number.isNaN(parsed.getTime())) {
          return NextResponse.json({ error: "Esa fecha no es válida" }, { status: 400 })
        }
        dueDate = parsed
      }
    }

    // Sólo redes del cliente dueño de este mes: apuntar a la cuenta de otro
    // cliente publicaría en el perfil equivocado.
    let accountIds: string[] | undefined
    const rawAccountIds: unknown = body?.accountIds
    if (Array.isArray(rawAccountIds)) {
      const requested: string[] = Array.from(
        new Set(rawAccountIds.map((value: unknown) => String(value))),
      )
      const owned = idea.planning.clientId
        ? await prisma.clientAccount.findMany({
            where: {
              id: { in: requested },
              clientId: idea.planning.clientId,
              client: { userId: session.user.id },
            },
            select: { id: true },
          })
        : []
      if (owned.length !== requested.length) {
        return NextResponse.json(
          { error: "Alguna de esas redes no es de este cliente" },
          { status: 400 },
        )
      }
      accountIds = owned.map((a) => a.id)
    }

    const result = await prisma.$transaction(async (tx) => {
      if (publishTime !== undefined || dueDate !== undefined) {
        await tx.contentIdea.update({
          where: { id: ideaId },
          data: {
            ...(publishTime !== undefined ? { publishTime } : {}),
            ...(dueDate !== undefined ? { dueDate } : {}),
            // Cambiar el día o la hora es una cita nueva, así que el aviso
            // vuelve a estar pendiente. Sin esto, una pieza que ya se avisó y
            // se corrió a mañana no volvía a avisar nunca.
            notifiedAt: null,
          },
        })
      }

      if (accountIds !== undefined) {
        // Se reemplaza el conjunto entero, pero sólo se borra lo que sale: si
        // una red sigue elegida conserva su `publishedAt`, o marcar "publicada"
        // se perdería al tocar cualquier otra red.
        await tx.ideaTarget.deleteMany({
          where: { ideaId, accountId: { notIn: accountIds.length > 0 ? accountIds : [""] } },
        })
        const existing = await tx.ideaTarget.findMany({
          where: { ideaId },
          select: { accountId: true },
        })
        const already = new Set(existing.map((t) => t.accountId))
        const toCreate = accountIds.filter((accountId) => !already.has(accountId))
        if (toCreate.length > 0) {
          await tx.ideaTarget.createMany({
            data: toCreate.map((accountId) => ({ ideaId, accountId })),
          })
        }
      }

      return tx.contentIdea.findUnique({
        where: { id: ideaId },
        select: {
          id: true,
          dueDate: true,
          publishTime: true,
          targets: { select: { accountId: true, publishedAt: true } },
        },
      })
    })

    if (!result) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 })
    }

    return NextResponse.json({
      id: result.id,
      dueDate: result.dueDate?.toISOString() ?? null,
      publishTime: result.publishTime,
      targets: result.targets.map((t) => ({
        accountId: t.accountId,
        publishedAt: t.publishedAt?.toISOString() ?? null,
      })),
    })
  } catch (error) {
    console.error("Error al programar la pieza:", error)
    return NextResponse.json({ error: "Error al programar" }, { status: 500 })
  }
}

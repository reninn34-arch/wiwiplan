import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { ideaDetailInclude } from "@/lib/idea-detail.server"

/**
 * Otra pieza como ésta, justo debajo de ella.
 *
 * Un mes está lleno de piezas parecidas —la promo de cada martes, el carrusel
 * de la serie—, y reescribir formato, pilar, tags y redes cada vez es la
 * fricción que se paga veinte veces por mes.
 *
 * Viaja lo que describe la pieza (brief, copy, referencia, tags, redes y la
 * hora habitual). No viaja lo que es propio de esa publicación en concreto: el
 * día —la copia queda sin fecha para ubicarla en el calendario, en vez de
 * chocar con la original—, el estado de producción, los comentarios del
 * cliente, las imágenes ni los archivos subidos.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; ideaId: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  const userId = session.user.id

  try {
    const { id, ideaId } = await params
    const source = await prisma.contentIdea.findFirst({
      where: { id: ideaId, planningId: id, planning: { userId } },
      include: {
        contentIdeaTags: { select: { tagId: true } },
        targets: { select: { accountId: true } },
      },
    })
    if (!source) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 })
    }

    const copy = await prisma.$transaction(async (tx) => {
      // Se abre el hueco debajo de la original para que la copia aparezca
      // al lado, no al final de una lista de veinte.
      await tx.contentIdea.updateMany({
        where: { planningId: id, order: { gt: source.order } },
        data: { order: { increment: 1 } },
      })
      return tx.contentIdea.create({
        data: {
          planningId: id,
          createdBy: userId,
          title: `${source.title} (copia)`.slice(0, 300),
          description: source.description,
          caption: source.caption,
          pilar: source.pilar,
          postType: source.postType,
          platform: source.platform,
          referenceUrl: source.referenceUrl,
          referenceEmbed: source.referenceEmbed,
          priority: source.priority,
          storyboardId: source.storyboardId,
          publishTime: source.publishTime,
          order: source.order + 1,
          contentIdeaTags: {
            create: source.contentIdeaTags.map((t) => ({ tagId: t.tagId })),
          },
          targets: {
            create: source.targets.map((t) => ({ accountId: t.accountId })),
          },
        },
        include: ideaDetailInclude,
      })
    })

    return NextResponse.json(copy, { status: 201 })
  } catch (error) {
    console.error("Error al duplicar idea:", error)
    return NextResponse.json({ error: "Error al duplicar" }, { status: 500 })
  }
}

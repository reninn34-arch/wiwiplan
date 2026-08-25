import "server-only"
import { prisma } from "@/lib/prisma"
import { moveToPeriod, type CloneSelection } from "@/lib/planning-period"

/**
 * Duplicar el mes anterior. El 70% de un plan mensual es el esqueleto del mes
 * pasado —los mismos pilares, la misma cadencia, los mismos formatos—, así que
 * el mes nuevo arranca de ese esqueleto y no de una pantalla vacía.
 *
 * Lo que se copia es la *estructura*, nunca el trabajo ya hecho: las ideas
 * vuelven a estado IDEA y sin comentarios ni imágenes del cliente, y los cobros
 * registrados no viajan. Los storyboards tampoco: son la producción concreta de
 * ese mes, no una plantilla.
 */

export interface CloneResult {
  planningId: string
  ideas: number
  installments: number
}

export interface CloneParams {
  userId: string
  sourceId: string
  clientId: string | null
  period: string
  title?: string
  selection: CloneSelection
}

/**
 * Crea el mes nuevo copiando del plan origen. Todo ocurre en una transacción:
 * o queda el mes completo o no queda nada a medias.
 */
export async function createPlanningFromTemplate(params: CloneParams): Promise<CloneResult | null> {
  const { userId, sourceId, clientId, period, selection } = params

  const source = await prisma.planning.findFirst({
    where: { id: sourceId, userId },
    include: {
      contentIdeas: {
        orderBy: { order: "asc" },
        include: {
          contentIdeaTags: { select: { tagId: true } },
          targets: { select: { accountId: true } },
        },
      },
      installments: { orderBy: { dueDate: "asc" } },
      items: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
      costs: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
    },
  })
  if (!source) return null

  return prisma.$transaction(
    async (tx) => {
      const planning = await tx.planning.create({
        data: {
          title: params.title?.trim() || source.title,
          period,
          clientId,
          userId,
          description: selection.notes ? source.description : "",
          targetAudience: selection.notes ? source.targetAudience : "",
          goals: selection.notes ? source.goals : "",
          notes: selection.notes ? source.notes : "",
          priceCents: selection.pricing ? source.priceCents : 0,
          costCents: selection.costs ? source.costCents : 0,
        },
      })

      // Los costos recurrentes son casi todos: el editor de agosto es el de
      // julio. Copiarlos evita volver a cargarlos mes a mes.
      if (selection.costs && source.costs.length > 0) {
        await tx.planningCost.createMany({
          data: source.costs.map((cost) => ({
            planningId: planning.id,
            label: cost.label,
            amountCents: cost.amountCents,
            category: cost.category,
            billable: cost.billable,
            order: cost.order,
          })),
        })
      }

      // Las líneas viajan junto al total: sin ellas el precio copiado sería
      // otra vez un número sin explicación.
      if (selection.pricing && source.items.length > 0) {
        await tx.planningItem.createMany({
          data: source.items.map((item) => ({
            planningId: planning.id,
            label: item.label,
            amountCents: item.amountCents,
            order: item.order,
          })),
        })
      }

      // Las redes elegidas sólo viajan si el mes nuevo es del mismo cliente:
      // apuntar a la cuenta de otro cliente publicaría en el perfil equivocado.
      const sameClient = clientId !== null && clientId === source.clientId

      let ideas = 0
      if (selection.ideas) {
        for (const idea of source.contentIdeas) {
          await tx.contentIdea.create({
            data: {
              planningId: planning.id,
              createdBy: userId,
              title: idea.title,
              description: idea.description,
              pilar: idea.pilar,
              postType: idea.postType,
              platform: idea.platform,
              referenceUrl: idea.referenceUrl,
              referenceEmbed: idea.referenceEmbed,
              priority: idea.priority,
              order: idea.order,
              // Estado arranca de cero: la idea se vuelve a trabajar. El día se
              // corre al mes destino y la hora se conserva, porque la cadencia
              // —"los martes a las 9"— es justamente lo que se está copiando.
              dueDate: idea.dueDate ? moveToPeriod(idea.dueDate, period) : null,
              publishTime: idea.publishTime,
              contentIdeaTags: {
                create: idea.contentIdeaTags.map((t) => ({ tagId: t.tagId })),
              },
              ...(sameClient && idea.targets.length > 0
                ? { targets: { create: idea.targets.map((t) => ({ accountId: t.accountId })) } }
                : {}),
            },
          })
          ideas += 1
        }
      }

      let installments = 0
      if (selection.pricing && source.installments.length > 0) {
        const rows = source.installments
          .map((i) => ({
            planningId: planning.id,
            label: i.label,
            amountCents: i.amountCents,
            dueDate: moveToPeriod(i.dueDate, period),
          }))
          .filter((r): r is typeof r & { dueDate: Date } => r.dueDate !== null)
        if (rows.length > 0) {
          await tx.paymentInstallment.createMany({ data: rows })
          installments = rows.length
        }
      }

      return { planningId: planning.id, ideas, installments }
    },
    { timeout: 20000 },
  )
}

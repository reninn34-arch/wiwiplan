import "server-only"
import { prisma } from "@/lib/prisma"
import { pushToUser } from "@/lib/push.server"
import {
  describePublication,
  networkLabels,
  publishMomentUtc,
  type SocialNetwork,
} from "@/lib/social"

/**
 * Barrido de avisos de publicación: busca lo que ya llegó a su hora y todavía
 * no salió, y avisa al teléfono.
 *
 * Reglas, y el porqué de cada una:
 * - Sólo piezas con día **y** hora: sin hora no hay momento al que avisar.
 * - Sólo con redes elegidas: avisar de algo que no sale a ningún lado es ruido.
 * - Sólo si falta publicar en alguna: lo ya publicado no se recuerda.
 * - Una sola vez por pieza (`notifiedAt`), o cada corrida avisaría de lo mismo.
 * - Nunca de piezas viejas: si algo quedó sin avisar hace tres semanas, no
 *   sirve despertar a nadie por eso ahora.
 */

/** Más allá de esto, avisar ya no ayuda: sólo molesta. */
const MAX_LATE_HOURS = 12

export interface PublishReminderOutcome {
  notified: number
  skipped: number
  errors: number
}

export async function runPublishReminders(userId?: string): Promise<PublishReminderOutcome> {
  const now = new Date()
  const outcome: PublishReminderOutcome = { notified: 0, skipped: 0, errors: 0 }

  const candidates = await prisma.contentIdea.findMany({
    where: {
      ...(userId ? { planning: { userId } } : {}),
      notifiedAt: null,
      NOT: { dueDate: null, publishTime: "" },
      targets: { some: { publishedAt: null } },
    },
    select: {
      id: true,
      title: true,
      planningId: true,
      dueDate: true,
      publishTime: true,
      planning: { select: { userId: true, client: { select: { name: true } } } },
      targets: {
        where: { publishedAt: null },
        select: { account: { select: { network: true } } },
      },
    },
  })

  for (const idea of candidates) {
    const moment = publishMomentUtc(idea.dueDate?.toISOString() ?? null, idea.publishTime)
    if (!moment) {
      outcome.skipped += 1
      continue
    }

    const lateHours = (now.getTime() - moment.getTime()) / 3_600_000
    if (lateHours < 0 || lateHours > MAX_LATE_HOURS) {
      outcome.skipped += 1
      continue
    }

    const networks = idea.targets.map(
      (t) => networkLabels[t.account.network as SocialNetwork] ?? t.account.network,
    )
    const summary = describePublication(
      idea.dueDate?.toISOString() ?? null,
      idea.publishTime,
      networks,
    )

    try {
      const result = await pushToUser(idea.planning.userId, {
        title: `Toca publicar: ${idea.title || "una pieza"}`,
        body: `${idea.planning.client?.name ?? "Sin cliente"} — ${summary.sentence}`,
        url: `/planning/${idea.planningId}?idea=${idea.id}`,
        tag: `publicar-${idea.id}`,
      })

      if (result.sent > 0) {
        // Sólo se marca si alguien lo recibió: si no había ningún dispositivo
        // conectado, conviene volver a intentarlo en la próxima corrida.
        await prisma.contentIdea.update({
          where: { id: idea.id },
          data: { notifiedAt: now },
        })
        outcome.notified += 1
      } else {
        outcome.skipped += 1
      }
    } catch (error) {
      console.error("Error avisando de una publicación:", error)
      outcome.errors += 1
    }
  }

  return outcome
}

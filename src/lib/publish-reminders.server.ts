import "server-only"
import { prisma } from "@/lib/prisma"
import { pushConfigured, pushToUser } from "@/lib/push.server"
import { publishTarget } from "@/lib/auto-publish.server"
import { schedulePublishSweep } from "@/lib/publish-schedule.server"
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
  /** Salieron solas, por el carril automático. */
  published: number
  /** Meta todavía las está procesando; se retoman en la corrida siguiente. */
  processing: number
  notified: number
  /** Encontradas, pero su hora todavía no llegó o quedó muy atrás. */
  notDue: number
  /** Les tocaba, pero no había ningún dispositivo al que avisar. */
  noDevices: number
  errors: number
  /** Presente sólo si el servidor no tiene llaves: sin ellas no sale nada. */
  pushDisabled?: true
}

export async function runPublishReminders(userId?: string): Promise<PublishReminderOutcome> {
  const now = new Date()
  const outcome: PublishReminderOutcome = {
    published: 0,
    processing: 0,
    notified: 0,
    notDue: 0,
    noDevices: 0,
    errors: 0,
  }

  // Sin llaves no hay envío posible, y callarlo deja un "no pasó nada" sin
  // explicación. Mejor decirlo antes de recorrer nada.
  if (!pushConfigured()) {
    console.error(
      "[push] Faltan NEXT_PUBLIC_VAPID_PUBLIC_KEY o VAPID_PRIVATE_KEY: " +
        "el barrido no puede enviar ningún aviso.",
    )
    outcome.pushDisabled = true
    return outcome
  }

  const candidates = await prisma.contentIdea.findMany({
    where: {
      ...(userId ? { planning: { userId } } : {}),
      notifiedAt: null,
      // Dos condiciones separadas a propósito: `NOT: { a, b }` en Prisma niega
      // la conjunción —NOT(a Y b)— así que juntas dejaban pasar piezas con día
      // pero sin hora, y al revés. Se necesita que estén las dos.
      NOT: { dueDate: null },
      publishTime: { not: "" },
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
        select: {
          accountId: true,
          containerId: true,
          attempts: true,
          account: { select: { network: true, mode: true, externalId: true } },
        },
      },
    },
  })

  for (const idea of candidates) {
    const moment = publishMomentUtc(idea.dueDate?.toISOString() ?? null, idea.publishTime)
    if (!moment) {
      outcome.notDue += 1
      continue
    }

    const lateHours = (now.getTime() - moment.getTime()) / 3_600_000
    if (lateHours < 0 || lateHours > MAX_LATE_HOURS) {
      outcome.notDue += 1
      continue
    }

    let seguirDespues = false

    // Primero lo que sale solo. Lo que no se pueda publicar cae al aviso, que
    // es la red de seguridad: una publicación que no salió y nadie avisó es
    // peor que no haberla prometido automática.
    const pendientes: typeof idea.targets = []
    for (const target of idea.targets) {
      const automatica = target.account.mode === "AUTOMATIC" && target.account.externalId
      if (!automatica) {
        pendientes.push(target)
        continue
      }

      const resultado = await publishTarget({
        ideaId: idea.id,
        accountId: target.accountId,
        containerId: target.containerId,
        attempts: target.attempts,
      })

      if (resultado === "published") {
        outcome.published += 1
      } else if (resultado === "processing") {
        outcome.processing += 1
        // Meta sigue procesando —lo normal en un reel, que tarda minutos—.
        // Hay que volver pronto: la cita de esta pieza ya se gastó, y el único
        // reloj periódico en producción es el diario. Sin esto, un reel que
        // tarda tres minutos se publicaría al día siguiente.
        seguirDespues = true
      } else {
        pendientes.push(target)
      }
    }

    if (seguirDespues) {
      // Se acota a dos horas desde su hora: pasado eso, algo va mal de verdad y
      // seguir volviendo cada minuto sólo acumula citas. Ahí lo recoge el reloj
      // diario y, si tampoco sale, cae al aviso.
      const lateHoras = (now.getTime() - moment.getTime()) / 3_600_000
      if (lateHoras < 2) {
        await schedulePublishSweep(new Date(Date.now() + 90_000))
      }
    }

    // Todo salió solo: no hay nada que avisar.
    if (pendientes.length === 0) {
      if (outcome.processing === 0) {
        await prisma.contentIdea.update({
          where: { id: idea.id },
          data: { notifiedAt: now },
        })
      }
      continue
    }

    const networks = pendientes.map(
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
        // A la pantalla de publicar: cuando suena el aviso lo único que hace
        // falta es el copy, abrir la red y decir que ya salió.
        url: `/publicar/${idea.id}`,
        tag: `publicar-${idea.id}`,
      })

      if (result.dropped > 0) {
        console.warn(`[push] ${result.dropped} suscripción(es) revocadas, limpiadas.`)
      }
      if (result.errors > 0) {
        console.error(`[push] ${result.errors} envío(s) fallaron para "${idea.title}".`)
      }

      if (result.sent > 0) {
        // Sólo se marca si alguien lo recibió: si no había ningún dispositivo
        // conectado, conviene volver a intentarlo en la próxima corrida.
        await prisma.contentIdea.update({
          where: { id: idea.id },
          data: { notifiedAt: now },
        })
        outcome.notified += 1
      } else {
        // Le tocaba y no había a quién avisar: ningún dispositivo conectado, o
        // todos revocados. No se marca, para reintentar en la próxima corrida.
        outcome.noDevices += 1
      }
    } catch (error) {
      console.error("Error avisando de una publicación:", error)
      outcome.errors += 1
    }
  }

  return outcome
}

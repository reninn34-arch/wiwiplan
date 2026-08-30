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

/**
 * Más allá de esto, avisar ya no ayuda: sólo molesta.
 *
 * Son 26 y no 12 por una razón concreta: el reloj de respaldo corre **una vez
 * al día**. Con una ventana de 12 horas, todo lo programado entre las 07:00 y
 * las 19:00 de Ecuador caía en un hueco —cuando el reloj llegaba, ya estaba
 * descartado por viejo—, así que durante toda la jornada laboral la cita
 * puntual era el único mecanismo y no tenía nada detrás. 26 garantiza que el
 * reloj diario alcance cualquier pieza del día anterior.
 */
const MAX_LATE_HOURS = 26

/**
 * Publicar **sola** algo con más atraso que esto no se hace.
 *
 * Ampliar la ventana de aviso no puede significar que una pieza de ayer a las
 * diez de la mañana salga hoy de madrugada: a esa altura ya no corresponde al
 * momento que se eligió, y sacarla igual es peor que no sacarla. Pasado este
 * plazo la pieza cae al carril asistido, que es donde una persona decide.
 */
const MAX_PUBLISH_LATE_HOURS = 6

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

  // Sin llaves no hay aviso posible, y callarlo deja un "no pasó nada" sin
  // explicación. Pero **no se corta el barrido**: antes se devolvía aquí
  // mismo, y eso ataba publicar a que el push estuviera configurado. Son cosas
  // distintas —una publica en Instagram, la otra suena en un teléfono— y el
  // día que caduquen las llaves VAPID nada debería dejar de salir por eso.
  const puedeAvisar = pushConfigured()
  if (!puedeAvisar) {
    console.error(
      "[push] Faltan NEXT_PUBLIC_VAPID_PUBLIC_KEY o VAPID_PRIVATE_KEY: " +
        "se publica igual, pero no se puede avisar de lo que quede pendiente.",
    )
    outcome.pushDisabled = true
  }

  // Ya no se filtra por `notifiedAt: null`, y ese cambio es el que arregla el
  // fallo más silencioso que tenía el carril automático: bastaba **un** fallo
  // pasajero para que la pieza cayera al aviso, quedara marcada como avisada y
  // no se volviera a mirar nunca. Los cuatro intentos de reintento existían en
  // el papel y no llegaban a usarse jamás. Ahora el aviso deja de repetirse
  // —eso se decide más abajo, con `notifiedAt`— pero la pieza sigue en la
  // lista mientras le quede crédito para intentarlo.
  //
  // A cambio hace falta acotar por fecha: sin el filtro anterior, la consulta
  // crecería con cada pieza vieja sin publicar. Tres días cubren de sobra la
  // ventana de 26 horas contando el desfase horario.
  const desde = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)

  const candidates = await prisma.contentIdea.findMany({
    where: {
      ...(userId ? { planning: { userId } } : {}),
      // `gte` ya descarta las nulas, así que no hace falta el `NOT` de antes.
      dueDate: { gte: desde },
      publishTime: { not: "" },
      targets: { some: { publishedAt: null } },
    },
    select: {
      id: true,
      title: true,
      planningId: true,
      dueDate: true,
      publishTime: true,
      notifiedAt: true,
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
    let procesandoEstaPieza = false

    // Pasado el plazo, deja de salir sola aunque la cuenta sea automática: una
    // pieza de ayer publicada de madrugada es peor que una que no salió.
    const aTiempoParaPublicar = lateHours <= MAX_PUBLISH_LATE_HOURS

    // Primero lo que sale solo. Lo que no se pueda publicar cae al aviso, que
    // es la red de seguridad: una publicación que no salió y nadie avisó es
    // peor que no haberla prometido automática.
    const pendientes: typeof idea.targets = []
    for (const target of idea.targets) {
      const automatica =
        target.account.mode === "AUTOMATIC" && target.account.externalId && aTiempoParaPublicar
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
        procesandoEstaPieza = true
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
      // La condición miraba `outcome.processing`, que es el acumulado de toda
      // la corrida: un reel de otra pieza aún procesándose impedía marcar ésta.
      // Lo que importa es si **esta** pieza sigue en el aire.
      if (!procesandoEstaPieza && !idea.notifiedAt) {
        await prisma.contentIdea.update({
          where: { id: idea.id },
          data: { notifiedAt: now },
        })
      }
      continue
    }

    // Queda algo pendiente, pero de esta pieza ya se avisó. Sigue en la lista
    // para que el carril automático pueda reintentarla; repetir el aviso sería
    // despertar a alguien por lo mismo en cada corrida.
    if (idea.notifiedAt) continue

    // Sin llaves de push no hay a dónde mandar el aviso. Ya quedó dicho en el
    // resultado (`pushDisabled`) y en los registros; lo publicado se publicó.
    if (!puedeAvisar) {
      outcome.noDevices += 1
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

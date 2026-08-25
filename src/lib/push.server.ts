import "server-only"
import webpush from "web-push"
import { prisma } from "@/lib/prisma"

/**
 * Envío de avisos push. Un usuario puede tener varios dispositivos —el teléfono
 * y la computadora son dos suscripciones distintas— y se le avisa a todos.
 *
 * Cuando el navegador revoca una suscripción, el envío responde 404 o 410. Esa
 * fila se borra sola: si no, cada barrido volvería a intentar contra un
 * dispositivo que ya no existe, para siempre.
 */

let configured = false

/** `false` si faltan las llaves VAPID: sin ellas no se puede firmar nada. */
function ensureConfigured(): boolean {
  if (configured) return true

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) return false

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:soporte@wiwiplan.app",
    publicKey,
    privateKey,
  )
  configured = true
  return true
}

export interface PushPayload {
  title: string
  body: string
  /** A dónde lleva al tocarlo. */
  url: string
  /** Agrupa avisos del mismo asunto para que no se apilen repetidos. */
  tag?: string
}

export interface PushOutcome {
  sent: number
  /** Suscripciones que el navegador ya había revocado y se limpiaron. */
  dropped: number
  errors: number
}

/** Manda el aviso a todos los dispositivos de un usuario. */
export async function pushToUser(userId: string, payload: PushPayload): Promise<PushOutcome> {
  const outcome: PushOutcome = { sent: 0, dropped: 0, errors: 0 }
  if (!ensureConfigured()) return outcome

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  })

  const body = JSON.stringify(payload)
  const stale: string[] = []

  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        body,
      )
      outcome.sent += 1
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) {
        stale.push(subscription.id)
        outcome.dropped += 1
      } else {
        outcome.errors += 1
        console.error("Error enviando aviso push:", status ?? error)
      }
    }
  }

  if (stale.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: stale } } })
  }

  return outcome
}

export function pushConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
}

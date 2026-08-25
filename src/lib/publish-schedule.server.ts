import "server-only"
import { Client } from "@upstash/qstash"

/**
 * La cita exacta de cada pieza.
 *
 * Los relojes periódicos garantizan que ningún aviso se pierda, pero llegan
 * cuando les toca a ellos: "toca publicar a las 9:00" sonaba 9:07. Para la hora
 * justa, cada vez que se programa una pieza se agenda en QStash un mensaje que
 * despierta el barrido exactamente a esa hora; los periódicos quedan como red
 * de seguridad por si un mensaje se pierde.
 *
 * Va en archivo aparte porque es otra responsabilidad: este decide CUÁNDO
 * despertar; `publish-reminders.server.ts` decide A QUIÉN avisar.
 */

/** URL pública de la app: es a donde QStash tiene que poder llamar. */
function appUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }
  return "https://wiwiplan.vercel.app"
}

/**
 * Agenda un barrido para el instante exacto. Nunca lanza: un fallo acá no puede
 * romper el guardado de la pieza, que ya quedó programada y va a ser avisada
 * por los relojes periódicos aunque esto falle.
 */
export async function schedulePublishSweep(atUtc: Date): Promise<void> {
  const token = process.env.QSTASH_TOKEN
  if (!token) {
    // Sin la variable el aviso puntual no existe y callarlo dejaría un "no
    // llegó nada" sin explicación. En desarrollo no hace falta: lo cubre el
    // reloj interno del proceso.
    console.warn(
      "[qstash] QSTASH_TOKEN no está configurado: los avisos llegan con el " +
        "reloj periódico, no a la hora justa.",
    )
    return
  }

  // QStash entrega a partir del instante dado, en segundos Unix.
  const notBefore = Math.ceil(atUtc.getTime() / 1000)
  if (notBefore <= Math.floor(Date.now() / 1000)) {
    return // Ya pasó: los barridos periódicos se encargan de lo atrasado.
  }

  try {
    const client = new Client({ token })
    await client.publishJSON({
      url: `${appUrl()}/api/publish-reminders/run`,
      notBefore,
      // Reintenta poco a propósito: si el despertar falla, igual lo agarran
      // los relojes periódicos, y cada barrido es idempotente (`notifiedAt`).
      retries: 2,
      timeout: 30,
    })
  } catch (error) {
    console.error("[qstash] No se pudo agendar el despertar puntual:", error)
  }
}

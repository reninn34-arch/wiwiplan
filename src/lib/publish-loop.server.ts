import "server-only"
import { runPublishReminders } from "@/lib/publish-reminders.server"

/**
 * El reloj propio de la app: un temporizador dentro del proceso del servidor
 * que revisa solo, sin depender de nadie de afuera.
 *
 * Funciona siempre que la app corra como un **proceso vivo**: `npm run dev`, un
 * VPS, Railway, Render, Docker. Ahí hay un Node encendido y este intervalo
 * sigue latiendo aunque nadie abra la app.
 *
 * No funciona en Vercel, y no por cómo esté escrito: las funciones sin servidor
 * se prenden con cada petición y se apagan al responder, así que entre una y
 * otra no queda nada corriendo que pueda contar el tiempo. Por eso se apaga
 * solo ahí y el timbre lo toca QStash. El código de los avisos es el mismo en
 * los dos casos; lo único que cambia es quién despierta al barrido.
 */

const INTERVAL_MS = 60_000

/** Sobrevive a los recargados en caliente, igual que el cliente de Prisma. */
const globalForLoop = globalThis as unknown as {
  publishReminderLoop: NodeJS.Timeout | undefined
}

export function startPublishReminderLoop(): void {
  if (globalForLoop.publishReminderLoop) return

  const tick = async () => {
    try {
      const outcome = await runPublishReminders()
      if (outcome.notified > 0) {
        console.log(`[avisos] Se avisó de ${outcome.notified} pieza(s).`)
      }
    } catch (error) {
      // Nunca dejar que un fallo mate el intervalo: si esta corrida falla, la
      // próxima tiene que seguir intentando.
      console.error("[avisos] Falló una corrida del barrido:", error)
    }
  }

  const timer = setInterval(tick, INTERVAL_MS)
  // No mantiene el proceso vivo por sí solo: si la app se apaga, se apaga.
  timer.unref?.()
  globalForLoop.publishReminderLoop = timer

  // Una primera pasada al arrancar, para no esperar el minuto completo.
  void tick()

  console.log(`[avisos] Reloj interno activo: revisa cada ${INTERVAL_MS / 1000}s.`)
}

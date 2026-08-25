/**
 * Se ejecuta una sola vez cuando arranca el servidor. Es el único lugar donde
 * Next deja enganchar algo al inicio del proceso, y por eso vive acá el reloj
 * interno de los avisos.
 */
export async function register() {
  // El runtime de edge no tiene temporizadores largos ni acceso a la base.
  if (process.env.NEXT_RUNTIME !== "nodejs") return

  // En Vercel cada petición prende y apaga una función: no hay proceso que
  // pueda contar el tiempo, así que el intervalo no serviría de nada. Allí la
  // hora justa la pone la cita de QStash, con el cron diario como respaldo.
  if (process.env.VERCEL) return

  // Durante `next build` no hay servidor que atender.
  if (process.env.NEXT_PHASE === "phase-production-build") return

  const { startPublishReminderLoop } = await import("@/lib/publish-loop.server")
  startPublishReminderLoop()
}

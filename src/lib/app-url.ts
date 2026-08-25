/**
 * La URL pública de la app. Se usa para todo lo que necesita que **alguien de
 * afuera** pueda llamarnos: la cita de QStash, el aviso del almacenamiento.
 *
 * Devuelve `null` cuando no hay una alcanzable —en desarrollo, típicamente—, y
 * eso es información útil, no un fallo: quien la pida decide qué hacer sin esa
 * URL en vez de mandar un `localhost` que nadie puede resolver.
 */
export function publicAppUrl(): string | null {
  const explicit = process.env.NEXT_PUBLIC_APP_URL
  if (explicit && !explicit.includes("localhost")) return explicit.replace(/\/$/, "")

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL
  if (vercel) return `https://${vercel}`

  return null
}

import { dayKeyOf } from "./calendar"

/**
 * Vocabulario de la publicación. Todo lo que la persona lee sale de acá, para
 * que en ningún lado aparezca un `ASSISTED` ni un `2026-08-15T00:00`.
 *
 * La regla al nombrar: frases que alguien entiende sin que se las expliquen.
 * "Te avisamos" y "Sale sola" dicen qué va a pasar; "asistida" y "automática"
 * obligan a aprender qué significan.
 */

export type SocialNetwork = "INSTAGRAM" | "FACEBOOK" | "TIKTOK" | "YOUTUBE" | "LINKEDIN"

export const socialNetworks = ["INSTAGRAM", "FACEBOOK", "TIKTOK", "YOUTUBE", "LINKEDIN"] as const

export const networkLabels: Record<SocialNetwork, string> = {
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  TIKTOK: "TikTok",
  YOUTUBE: "YouTube",
  LINKEDIN: "LinkedIn",
}

/** Color de cada red, para reconocerla sin leer. */
export const networkColors: Record<SocialNetwork, string> = {
  INSTAGRAM: "#e1306c",
  FACEBOOK: "#1877f2",
  TIKTOK: "#25f4ee",
  YOUTUBE: "#ff0000",
  LINKEDIN: "#0a66c2",
}

export function isSocialNetwork(value: unknown): value is SocialNetwork {
  return socialNetworks.includes(value as SocialNetwork)
}

export type PublishMode = "ASSISTED" | "AUTOMATIC"

export const publishModeLabels: Record<PublishMode, string> = {
  ASSISTED: "Te avisamos",
  AUTOMATIC: "Sale sola",
}

export const publishModeHints: Record<PublishMode, string> = {
  ASSISTED: "A la hora te llega un aviso y publicas tú de un toque.",
  AUTOMATIC: "Se publica sola, sin que hagas nada.",
}

export function isPublishMode(value: unknown): value is PublishMode {
  return value === "ASSISTED" || value === "AUTOMATIC"
}

/** Quita arrobas y espacios: la gente pega "@kibou" y a veces " @Kibou ". */
export function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@+/, "").trim()
}

const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]

/** `"09:00"` válido. Vacío quiere decir "sin hora", que es distinto de inválido. */
export function isValidTime(value: string): boolean {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return false
  const hours = Number(match[1])
  const minutes = Number(match[2])
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59
}

/** `"09:00"` → `"9:00 am"`. Se lee más rápido que el formato de 24 horas. */
export function formatTime(value: string): string {
  if (!isValidTime(value)) return ""
  const [rawHours, minutes] = value.trim().split(":")
  const hours = Number(rawHours)
  const suffix = hours < 12 ? "am" : "pm"
  const display = hours % 12 === 0 ? 12 : hours % 12
  return `${display}:${minutes} ${suffix}`
}

export interface PublicationSummary {
  /** La frase completa, para leerla y verificar de un vistazo. */
  sentence: string
  /** Lo que falta para que salga. Vacío = está lista. */
  missing: string[]
  ready: boolean
}

/**
 * Lo que la persona necesita leer para quedarse tranquila: una frase entera que
 * dice qué va a pasar, y qué falta si algo falta.
 *
 * Mostrar los campos por separado obliga a armar la frase en la cabeza, y ahí
 * es donde entra la duda de "¿lo programé bien?". La frase completa se verifica
 * sola: si dice lo que querías, está bien.
 */
export function describePublication(
  dueDate: string | null,
  publishTime: string,
  networks: string[],
): PublicationSummary {
  const key = dayKeyOf(dueDate)
  const time = formatTime(publishTime)

  const missing: string[] = []
  if (!key) missing.push("el día")
  if (!time) missing.push("la hora")
  if (networks.length === 0) missing.push("dónde sale")

  if (!key) {
    return { sentence: "Todavía no tiene día", missing, ready: false }
  }

  const [year, month, day] = key.split("-").map(Number)
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()].toLowerCase()

  let sentence = `Sale el ${weekday} ${day} de ${MONTHS[month - 1]}`
  if (time) sentence += ` a las ${time}`
  if (networks.length > 0) sentence += ` en ${joinWithY(networks)}`

  return { sentence, missing, ready: missing.length === 0 }
}

/** "Instagram, TikTok y Facebook" — como se dice, no separado por comas a secas. */
export function joinWithY(values: string[]): string {
  if (values.length === 0) return ""
  if (values.length === 1) return values[0]
  return `${values.slice(0, -1).join(", ")} y ${values[values.length - 1]}`
}

/**
 * Ecuador está en UTC-5 todo el año, sin horario de verano. Por eso alcanza con
 * un desplazamiento fijo: "las 9 del martes" siempre son las 14:00 UTC de ese
 * martes. Si alguna vez hay clientes en otra zona, esto pasa a ser un dato del
 * usuario en vez de una constante.
 */
export const APP_UTC_OFFSET_HOURS = -5

/**
 * El instante real en que toca publicar, a partir del día de calendario y la
 * hora de reloj. `null` si falta alguno de los dos: sin día o sin hora no hay
 * momento al que avisar.
 */
export function publishMomentUtc(dueDate: string | null, publishTime: string): Date | null {
  const key = dayKeyOf(dueDate)
  if (!key || !isValidTime(publishTime)) return null

  const [year, month, day] = key.split("-").map(Number)
  const [hours, minutes] = publishTime.trim().split(":").map(Number)

  return new Date(Date.UTC(year, month - 1, day, hours - APP_UTC_OFFSET_HOURS, minutes))
}

/**
 * A dónde mandar a la persona para publicar. Se usan direcciones https y no
 * esquemas propios (`instagram://`): en el teléfono el sistema las abre en la
 * app igual, y en la computadora al menos abren la web en vez de no hacer nada.
 */
export const networkOpenUrls: Record<SocialNetwork, string> = {
  INSTAGRAM: "https://www.instagram.com/",
  FACEBOOK: "https://www.facebook.com/",
  TIKTOK: "https://www.tiktok.com/upload",
  YOUTUBE: "https://studio.youtube.com/",
  LINKEDIN: "https://www.linkedin.com/feed/",
}

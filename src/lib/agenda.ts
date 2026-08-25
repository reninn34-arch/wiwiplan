import { dayKeyOf, todayKey } from "./calendar"

/**
 * La agenda: qué sale y cuándo, cruzando todos los clientes.
 *
 * El calendario responde "cómo viene el mes de Kibou". Esto responde otra cosa
 * distinta y que no tenía dónde vivir: "¿qué me toca hoy?". Cuando llevas seis
 * clientes en paralelo, esa pregunta no se contesta abriendo seis meses.
 */

export type AgendaBucket = "LATE" | "TODAY" | "TOMORROW" | "WEEK" | "LATER" | "UNSCHEDULED"

export const bucketLabels: Record<AgendaBucket, string> = {
  LATE: "Se pasaron",
  TODAY: "Hoy",
  TOMORROW: "Mañana",
  WEEK: "Esta semana",
  LATER: "Más adelante",
  UNSCHEDULED: "Sin fecha",
}

/** Qué significa cada grupo, para que nadie tenga que deducirlo. */
export const bucketHints: Record<AgendaBucket, string> = {
  LATE: "Llegó su hora y todavía no salieron.",
  TODAY: "",
  TOMORROW: "",
  WEEK: "En los próximos siete días.",
  LATER: "",
  UNSCHEDULED: "Les falta día para poder avisarte.",
}

export interface AgendaPiece {
  id: string
  title: string
  planningId: string
  clientName: string
  dueDate: string | null
  publishTime: string
  /** Una entrada por red, con su marca de publicada. */
  targets: Array<{ accountId: string; network: string; publishedAt: string | null }>
}

export interface AgendaGroup {
  bucket: AgendaBucket
  pieces: AgendaPiece[]
}

/** Suma días a una clave `YYYY-MM-DD` sin salirse del calendario. */
export function addDays(key: string, days: number): string {
  const [year, month, day] = key.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(
    date.getUTCDate(),
  ).padStart(2, "0")}`
}

/** Una pieza está lista cuando ya salió en todas las redes que tenía elegidas. */
export function isFullyPublished(piece: AgendaPiece): boolean {
  return piece.targets.length > 0 && piece.targets.every((t) => t.publishedAt !== null)
}

export function bucketOf(piece: AgendaPiece, today: string): AgendaBucket {
  const key = dayKeyOf(piece.dueDate)
  if (!key) return "UNSCHEDULED"
  if (key < today) return isFullyPublished(piece) ? "LATER" : "LATE"
  if (key === today) return "TODAY"
  if (key === addDays(today, 1)) return "TOMORROW"
  if (key <= addDays(today, 7)) return "WEEK"
  return "LATER"
}

/** Orden de lectura: primero lo urgente, al final lo que no tiene fecha. */
const BUCKET_ORDER: AgendaBucket[] = ["LATE", "TODAY", "TOMORROW", "WEEK", "LATER", "UNSCHEDULED"]

/**
 * Agrupa y ordena. Dentro de cada grupo manda el día, después la hora, y las
 * piezas sin hora van al final del suyo: si no sabes cuándo sale, no puede
 * competir por el primer lugar con una que sí lo sabe.
 */
export function buildAgenda(pieces: AgendaPiece[], today: string = todayKey()): AgendaGroup[] {
  const byBucket = new Map<AgendaBucket, AgendaPiece[]>()

  for (const piece of pieces) {
    const bucket = bucketOf(piece, today)
    const list = byBucket.get(bucket)
    if (list) list.push(piece)
    else byBucket.set(bucket, [piece])
  }

  const groups: AgendaGroup[] = []
  for (const bucket of BUCKET_ORDER) {
    const list = byBucket.get(bucket)
    if (!list || list.length === 0) continue
    list.sort((a, b) => {
      const dayA = dayKeyOf(a.dueDate)
      const dayB = dayKeyOf(b.dueDate)
      if (dayA !== dayB) {
        // Lo que ya se pasó se lee de lo más viejo a lo más nuevo; el resto al revés.
        return dayA.localeCompare(dayB)
      }
      // Sin hora al final del día, no al principio.
      const timeA = a.publishTime || "99:99"
      const timeB = b.publishTime || "99:99"
      if (timeA !== timeB) return timeA.localeCompare(timeB)
      return a.clientName.localeCompare(b.clientName)
    })
    groups.push({ bucket, pieces: list })
  }

  return groups
}

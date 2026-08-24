import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { SEARCH_MIN_LENGTH, type SearchHit } from "@/lib/search"
import { formatPeriodLabel, periodQueryPatterns } from "@/lib/planning-period"

/**
 * Búsqueda global. Responde "¿en qué mes hicimos ese carrusel de precios?",
 * que hasta ahora no tenía respuesta: había que acordarse del cliente y del mes
 * para llegar a la pieza.
 *
 * Todo se filtra por `userId` —directo o por la relación— igual que el resto de
 * la app: nunca puede devolver algo de otra cuenta.
 */

const LIMITS = { clients: 5, plannings: 8, ideas: 14 } as const

/** Recorta alrededor de la coincidencia para que el fragmento la muestre. */
function excerptAround(text: string, query: string, radius = 60): string {
  if (!text) return ""
  const at = text.toLowerCase().indexOf(query.toLowerCase())
  if (at === -1) return ""
  const start = Math.max(0, at - radius)
  const end = Math.min(text.length, at + query.length + radius)
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`
}

/** El primer campo que realmente contenga la búsqueda, para el fragmento. */
function firstExcerpt(query: string, ...fields: Array<string | null | undefined>): string {
  for (const field of fields) {
    const hit = excerptAround(field ?? "", query)
    if (hit) return hit
  }
  return ""
}

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim()
  if (q.length < SEARCH_MIN_LENGTH) {
    return NextResponse.json({ hits: [], query: q })
  }

  try {
    const userId = session.user.id
    const like = { contains: q, mode: "insensitive" as const }

    // "agosto" no está guardado en ninguna parte: el mes se guarda como
    // `2026-08` y el nombre es sólo formato de pantalla. Se traduce, si no
    // buscar lo que la interfaz muestra no encontraría nada.
    const periodPatterns = periodQueryPatterns(q)

    const [clients, plannings, ideas] = await Promise.all([
      prisma.client.findMany({
        where: {
          userId,
          OR: [{ name: like }, { email: like }, { planName: like }],
        },
        take: LIMITS.clients,
        orderBy: { name: "asc" },
        select: { id: true, name: true, email: true, planName: true, _count: { select: { plannings: true } } },
      }),
      prisma.planning.findMany({
        where: {
          userId,
          OR: [
            { title: like },
            { period: like },
            ...periodPatterns.map((pattern) => ({ period: { contains: pattern } })),
            { description: like },
            { goals: like },
            { notes: like },
            { targetAudience: like },
          ],
        },
        take: LIMITS.plannings,
        orderBy: { period: "desc" },
        select: {
          id: true,
          title: true,
          period: true,
          description: true,
          goals: true,
          notes: true,
          targetAudience: true,
          client: { select: { name: true } },
        },
      }),
      prisma.contentIdea.findMany({
        where: {
          planning: { userId },
          OR: [{ title: like }, { description: like }, { pilar: like }],
        },
        take: LIMITS.ideas,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          description: true,
          pilar: true,
          planningId: true,
          planning: { select: { period: true, title: true, client: { select: { name: true } } } },
        },
      }),
    ])

    const hits: SearchHit[] = [
      ...clients.map((c) => ({
        kind: "client" as const,
        id: c.id,
        title: c.name,
        subtitle: [c.planName, `${c._count.plannings} ${c._count.plannings === 1 ? "mes" : "meses"}`]
          .filter(Boolean)
          .join(" · "),
        excerpt: firstExcerpt(q, c.email, c.planName),
        href: `/clients/${c.id}`,
      })),
      ...plannings.map((p) => ({
        kind: "planning" as const,
        id: p.id,
        title: p.title || formatPeriodLabel(p.period) || "Sin título",
        subtitle: [p.client?.name, formatPeriodLabel(p.period)].filter(Boolean).join(" · "),
        excerpt: firstExcerpt(q, p.description, p.goals, p.notes, p.targetAudience),
        href: `/planning/${p.id}`,
      })),
      ...ideas.map((i) => ({
        kind: "idea" as const,
        id: i.id,
        title: i.title || "Sin título",
        subtitle: [i.planning.client?.name, formatPeriodLabel(i.planning.period) || i.planning.title, i.pilar]
          .filter(Boolean)
          .join(" · "),
        excerpt: firstExcerpt(q, i.description, i.pilar),
        // El deep-link ya existía para pendientes y notificaciones.
        href: `/planning/${i.planningId}?idea=${i.id}`,
      })),
    ]

    return NextResponse.json({ hits, query: q })
  } catch (error) {
    console.error("Error en la búsqueda:", error)
    return NextResponse.json({ error: "Error al buscar" }, { status: 500 })
  }
}

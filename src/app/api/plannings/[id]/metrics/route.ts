import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { refreshPlanningMetrics } from "@/lib/refresh-metrics.server"

/**
 * Los números de lo que ya salió este mes.
 *
 * `GET` devuelve lo guardado, sin llamar a Meta: abrir la pestaña no tiene por
 * qué gastar cuota de la API ni tardar segundos. `POST` es el botón de
 * actualizar, y es el único que sale a preguntar.
 */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { id } = await params
  const targets = await prisma.ideaTarget.findMany({
    where: { idea: { planningId: id, planning: { userId: session.user.id } }, NOT: { publishedAt: null } },
    select: {
      ideaId: true,
      accountId: true,
      publishedAt: true,
      externalPostId: true,
      reach: true,
      likes: true,
      commentCount: true,
      saves: true,
      shares: true,
      views: true,
      metricsAt: true,
      idea: { select: { title: true, postType: true } },
      account: { select: { network: true, handle: true } },
    },
    orderBy: { publishedAt: "asc" },
  })

  return NextResponse.json(targets)
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const { id } = await params
    return NextResponse.json(await refreshPlanningMetrics(id, session.user.id))
  } catch (error) {
    console.error("Error al traer los números:", error)
    return NextResponse.json({ error: "No se pudieron traer los números" }, { status: 502 })
  }
}

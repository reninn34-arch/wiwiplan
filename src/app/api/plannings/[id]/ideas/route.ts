import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { ImageError, normalizeImageDataUrl } from "@/lib/image-processing.server"
import { ideaDetailInclude } from "@/lib/idea-detail.server"

/** Cuántas ideas se aceptan en una sola pegada. Un mes con más de esto ya no
 *  es un mes, es un error de portapapeles. */
const MAX_BULK = 60

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const userId = session.user.id

  try {
    const { id } = await params
    const body = await request.json()

    const planning = await prisma.planning.findFirst({
      where: { id, userId },
      select: { id: true, storyboards: { select: { id: true } } },
    })
    if (!planning) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 })
    }
    // Un storyboard de otro mes (o de otra cuenta) no se puede colgar de acá.
    const ownStoryboards = new Set(planning.storyboards.map((s) => s.id))
    const storyboardIdOf = (value: unknown) =>
      typeof value === "string" && ownStoryboards.has(value) ? value : null

    const count = await prisma.contentIdea.count({ where: { planningId: id } })

    // Varias de una vez: pegar la lista del mes crea una idea por línea, en el
    // orden en que venían y en una sola transacción, así no quedan a medias.
    if (Array.isArray(body.ideas)) {
      const titles = (body.ideas as unknown[])
        .map((item) => {
          const title = typeof item === "string" ? item : (item as { title?: unknown })?.title
          return typeof title === "string" ? title.trim().slice(0, 300) : ""
        })
        .filter(Boolean)
      if (titles.length === 0) {
        return NextResponse.json({ error: "No hay ideas para crear" }, { status: 400 })
      }
      if (titles.length > MAX_BULK) {
        return NextResponse.json({ error: `Máximo ${MAX_BULK} ideas por vez` }, { status: 400 })
      }
      const shared = {
        postType: body.postType ?? "OTHER",
        pilar: typeof body.pilar === "string" ? body.pilar : "",
        priority: body.priority ?? "MEDIUM",
        status: body.status ?? "IDEA",
      }
      const created = await prisma.$transaction(
        titles.map((title, i) =>
          prisma.contentIdea.create({
            data: {
              planningId: id,
              title,
              ...shared,
              order: count + i,
              createdBy: userId,
            },
            include: ideaDetailInclude,
          }),
        ),
      )
      return NextResponse.json({ ideas: created }, { status: 201 })
    }

    const referenceEmbed = await normalizeImageDataUrl(body.referenceEmbed ?? "")

    const idea = await prisma.contentIdea.create({
      data: {
        planningId: id,
        title: body.title ?? "Sin título",
        description: body.description ?? "",
        caption: typeof body.caption === "string" ? body.caption : "",
        postType: body.postType ?? "OTHER",
        platform: body.platform ?? "OTHER",
        referenceUrl: body.referenceUrl ?? "",
        referenceEmbed,
        status: body.status ?? "IDEA",
        pilar: body.pilar ?? "",
        priority: body.priority ?? "MEDIUM",
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        storyboardId: storyboardIdOf(body.storyboardId),
        order: body.order ?? count,
        createdBy: userId,
      },
      include: ideaDetailInclude,
    })
    return NextResponse.json(idea, { status: 201 })
  } catch (error) {
    if (error instanceof ImageError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error("Error creating idea:", error)
    return NextResponse.json({ error: "Error al crear idea" }, { status: 500 })
  }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const { id } = await params
    const planning = await prisma.planning.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true },
    })
    if (!planning) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 })
    }

    const ideas = await prisma.contentIdea.findMany({
      where: { planningId: id },
      orderBy: { order: "asc" },
      include: ideaDetailInclude,
    })
    return NextResponse.json(ideas)
  } catch (error) {
    console.error("Error al obtener ideas:", error)
    return NextResponse.json({ error: "Error al obtener ideas" }, { status: 500 })
  }
}

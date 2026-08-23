import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { ImageError, normalizeImageDataUrl } from "@/lib/image-processing.server"

/** Tocho para una idea: con 30 imágenes alcanza de sobra. */
const MAX_IMAGES_PER_IDEA = 30

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; ideaId: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const { id, ideaId } = await params
    const body = await request.json()
    if (typeof body?.image !== "string" || !body.image.startsWith("data:image/")) {
      return NextResponse.json({ error: "El formato de la imagen no es válido" }, { status: 400 })
    }

    const idea = await prisma.contentIdea.findFirst({
      where: { id: ideaId, planningId: id, planning: { userId: session.user.id } },
      select: { id: true, _count: { select: { images: true } } },
    })
    if (!idea) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 })
    }
    if (idea._count.images >= MAX_IMAGES_PER_IDEA) {
      return NextResponse.json({ error: `Máximo ${MAX_IMAGES_PER_IDEA} imágenes por idea` }, { status: 400 })
    }

    const dataUrl = await normalizeImageDataUrl(body.image)

    const image = await prisma.contentIdeaImage.create({
      data: { ideaId: idea.id, dataUrl, order: idea._count.images },
      select: { id: true, order: true },
    })

    return NextResponse.json(image, { status: 201 })
  } catch (error) {
    console.error("Error al agregar imagen:", error)
    if (error instanceof ImageError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "Error al guardar la imagen" }, { status: 500 })
  }
}

import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { decodeDataUrl, imageNotFound, imageResponse } from "@/lib/image-store"

/**
 * Sirve una imagen adjunta a una idea como archivo, no como base64 dentro del
 * JSON del plan. Accede el dueño del plan o cualquiera con un enlace compartido
 * vigente: es la misma regla que las imágenes de storyboard.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ imageId: string }> },
) {
  try {
    const { imageId } = await params

    const image = await prisma.contentIdeaImage.findUnique({
      where: { id: imageId },
      select: {
        dataUrl: true,
        idea: {
          select: {
            planning: {
              select: {
                userId: true,
                shareLinks: { select: { expiresAt: true } },
              },
            },
          },
        },
      },
    })

    if (!image) return imageNotFound()

    const planning = image.idea.planning
    const session = await auth()
    const isOwner = session?.user?.id === planning.userId
    const hasLiveShareLink = planning.shareLinks.some(
      (link) => !link.expiresAt || link.expiresAt > new Date(),
    )

    if (!isOwner && !hasLiveShareLink) return imageNotFound()

    const decoded = decodeDataUrl(image.dataUrl)
    if (!decoded) return imageNotFound()

    return imageResponse(decoded, request.headers.get("if-none-match"))
  } catch (error) {
    console.error("Error serving idea image:", error)
    return imageNotFound()
  }
}

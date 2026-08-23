import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { decodeDataUrl, imageNotFound, imageResponse } from "@/lib/image-store"

/**
 * Sirve la imagen de una escena como archivo, en vez de mandarla embebida en
 * base64 dentro del JSON del storyboard. Accede el dueño del plan o cualquiera
 * con un enlace compartido vigente.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ panelId: string }> },
) {
  try {
    const { panelId } = await params

    const panel = await prisma.storyboardPanel.findUnique({
      where: { id: panelId },
      select: {
        imageUrl: true,
        storyboard: {
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

    if (!panel) return imageNotFound()

    const planning = panel.storyboard.planning
    const session = await auth()
    const isOwner = session?.user?.id === planning.userId
    const hasLiveShareLink = planning.shareLinks.some(
      (link) => !link.expiresAt || link.expiresAt > new Date(),
    )

    if (!isOwner && !hasLiveShareLink) return imageNotFound()

    const image = decodeDataUrl(panel.imageUrl)
    if (!image) return imageNotFound()

    return imageResponse(image, request.headers.get("if-none-match"))
  } catch (error) {
    console.error("Error serving panel image:", error)
    return imageNotFound()
  }
}

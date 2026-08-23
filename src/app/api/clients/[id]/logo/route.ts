import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { decodeDataUrl, imageNotFound, imageResponse } from "@/lib/image-store"

/**
 * Sirve el logo del cliente como archivo. Lo ve el dueño, o quien tenga un
 * enlace compartido vigente de alguno de los planes de ese cliente.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const client = await prisma.client.findUnique({
      where: { id },
      select: {
        logo: true,
        userId: true,
        plannings: { select: { shareLinks: { select: { expiresAt: true } } } },
      },
    })

    if (!client) return imageNotFound()

    const session = await auth()
    const isOwner = session?.user?.id === client.userId
    const hasLiveShareLink = client.plannings.some((planning) =>
      planning.shareLinks.some((link) => !link.expiresAt || link.expiresAt > new Date()),
    )

    if (!isOwner && !hasLiveShareLink) return imageNotFound()

    const image = decodeDataUrl(client.logo)
    if (!image) return imageNotFound()

    return imageResponse(image, request.headers.get("if-none-match"))
  } catch (error) {
    console.error("Error serving client logo:", error)
    return imageNotFound()
  }
}

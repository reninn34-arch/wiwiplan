import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { decodeDataUrl, imageNotFound, imageResponse } from "@/lib/image-store"

/**
 * Avatar SVG con la inicial: lo que se sirve cuando el cliente no tiene logo.
 * Responde 200 en vez de 404 para no ensuciar la consola del navegador con
 * errores que en realidad son el estado normal.
 */
function initialsSvg(name: string): Response {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const text =
    words.length === 0
      ? "?"
      : words.length === 1
        ? words[0].slice(0, 2).toUpperCase()
        : (words[0][0] + words[1][0]).toUpperCase()
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" fill="#27272a"/><text x="32" y="32" dy=".35em" text-anchor="middle" font-family="system-ui,sans-serif" font-size="24" font-weight="600" fill="#d4d4d8">${text.replace(/[<>&]/g, "")}</text></svg>`
  return new Response(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "private, max-age=3600",
    },
  })
}

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
        name: true,
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
    // Sin logo cargado va la inicial: estado normal, no un error.
    if (!image) return initialsSvg(client.name)

    return imageResponse(image, request.headers.get("if-none-match"))
  } catch (error) {
    console.error("Error serving client logo:", error)
    return imageNotFound()
  }
}

import "server-only"
import { prisma } from "./prisma"

/** Ids de las escenas que sí tienen imagen cargada, sin traer los bytes. */
export async function panelsWithImage(storyboardIds: string[]): Promise<Set<string>> {
  if (storyboardIds.length === 0) return new Set()

  const withImage = await prisma.storyboardPanel.findMany({
    where: { storyboardId: { in: storyboardIds }, NOT: { imageUrl: "" } },
    select: { id: true },
  })

  return new Set(withImage.map((p) => p.id))
}

/** Ids de los clientes que tienen logo, sin traer los bytes. */
export async function clientsWithLogo(clientIds: string[]): Promise<Set<string>> {
  if (clientIds.length === 0) return new Set()

  const withLogo = await prisma.client.findMany({
    where: { id: { in: clientIds }, logo: { not: null } },
    select: { id: true },
  })

  return new Set(withLogo.map((c) => c.id))
}

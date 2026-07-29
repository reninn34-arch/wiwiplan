import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params

    const shareLink = await prisma.shareLink.findUnique({
      where: { token },
      include: {
        planning: {
          include: {
            client: { select: { name: true } },
            contentIdeas: {
              orderBy: { order: "asc" },
              include: {
                storyboard: {
                  include: { panels: { orderBy: { order: "asc" } } },
                },
                contentIdeaTags: {
                  include: { tag: true },
                },
              },
            },
            storyboards: {
              orderBy: { createdAt: "desc" },
              include: { panels: { orderBy: { order: "asc" } } },
            },
          },
        },
      },
    })

    if (!shareLink) {
      return NextResponse.json({ error: "Enlace no válido" }, { status: 404 })
    }

    if (shareLink.expiresAt && new Date() > shareLink.expiresAt) {
      return NextResponse.json({ error: "Enlace expirado" }, { status: 410 })
    }

    return NextResponse.json(shareLink.planning)
  } catch (error) {
    console.error("Error fetching shared planning:", error)
    return NextResponse.json({ error: "Error al obtener la planificación" }, { status: 500 })
  }
}

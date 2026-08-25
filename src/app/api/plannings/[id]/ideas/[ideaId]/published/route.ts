import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

/**
 * Marca (o desmarca) que una pieza ya salió en una red concreta. Es por red y
 * no por pieza porque se publica de a una: puede estar lista en Instagram y
 * seguir pendiente en TikTok.
 */
export async function PUT(
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
    const accountId = typeof body?.accountId === "string" ? body.accountId : ""
    if (!accountId) {
      return NextResponse.json({ error: "Falta la red" }, { status: 400 })
    }

    const updated = await prisma.ideaTarget.updateMany({
      where: {
        ideaId,
        accountId,
        idea: { planningId: id, planning: { userId: session.user.id } },
      },
      data: { publishedAt: body?.published === false ? null : new Date() },
    })
    if (updated.count === 0) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 })
    }

    const targets = await prisma.ideaTarget.findMany({
      where: { ideaId },
      select: { accountId: true, publishedAt: true },
    })
    return NextResponse.json({
      targets: targets.map((t) => ({
        accountId: t.accountId,
        publishedAt: t.publishedAt?.toISOString() ?? null,
      })),
    })
  } catch (error) {
    console.error("Error al marcar la publicación:", error)
    return NextResponse.json({ error: "Error al marcar" }, { status: 500 })
  }
}

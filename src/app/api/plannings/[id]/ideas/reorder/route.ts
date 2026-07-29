import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function PUT(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { ideaIds } = body as { ideaIds: string[] }

    await prisma.$transaction(
      ideaIds.map((id, index) =>
        prisma.contentIdea.update({
          where: { id },
          data: { order: index },
        })
      )
    )
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Error al reordenar" }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const [unread, all] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: session.user.id, read: false },
      orderBy: { createdAt: "desc" },
    }),
    prisma.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ])

  return NextResponse.json({ unread: unread.length, notifications: all })
}

export async function PATCH(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const { ids } = await request.json()

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids requerido" }, { status: 400 })
  }

  await prisma.notification.updateMany({
    where: { id: { in: ids }, userId: session.user.id },
    data: { read: true },
  })

  return NextResponse.json({ success: true })
}

import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { PlanningDetailClient } from "./__components/PlanningDetailClient"

interface Props {
  params: Promise<{ id: string }>
}

export default async function PlanningDetailPage({ params }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { id } = await params

  const planning = await prisma.planning.findFirst({
    where: { id, userId: session.user.id },
    include: {
      client: { select: { id: true, name: true, email: true } },
      contentIdeas: {
        orderBy: { order: "asc" },
        include: {
          contentIdeaTags: { include: { tag: true } },
          comments: { orderBy: { createdAt: "asc" } },
          storyboard: true,
        },
      },
      storyboards: {
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, createdAt: true },
      },
      shareLinks: { orderBy: { createdAt: "desc" } },
      payments: { orderBy: { paidAt: "asc" } },
    },
  })

  if (!planning) notFound()

  const serialized = {
    ...planning,
    createdAt: planning.createdAt.toISOString(),
    updatedAt: planning.updatedAt.toISOString(),
    contentIdeas: planning.contentIdeas.map((i) => ({
      ...i,
      dueDate: i.dueDate?.toISOString() ?? null,
      createdAt: i.createdAt.toISOString(),
      comments: i.comments.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })),
    })),
    shareLinks: planning.shareLinks.map((l) => ({
      ...l,
      expiresAt: l.expiresAt?.toISOString() ?? null,
      createdAt: l.createdAt.toISOString(),
    })),
    payments: planning.payments.map((p) => ({
      ...p,
      paidAt: p.paidAt.toISOString(),
      createdAt: p.createdAt.toISOString(),
    })),
  }

  const clients = await prisma.client.findMany({
    where: { userId: session.user.id },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  })

  return <PlanningDetailClient planning={serialized} clients={clients} />
}

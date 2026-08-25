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
      client: {
        select: {
          id: true,
          name: true,
          email: true,
          accounts: {
            orderBy: { createdAt: "asc" },
            select: { id: true, network: true, handle: true, mode: true },
          },
        },
      },
      contentIdeas: {
        orderBy: { order: "asc" },
        include: {
          contentIdeaTags: { include: { tag: true } },
          comments: { orderBy: { createdAt: "asc" } },
          images: { orderBy: { order: "asc" }, select: { id: true, order: true } },
          targets: { select: { accountId: true, publishedAt: true } },
          media: {
            orderBy: [{ order: "asc" }, { createdAt: "asc" }],
            select: { id: true, url: true, kind: true, contentType: true, sizeBytes: true, order: true },
          },
          storyboard: true,
        },
      },
      installments: {
        orderBy: { dueDate: "asc" },
        select: { id: true, label: true, amountCents: true, dueDate: true },
      },
      items: {
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        select: { id: true, label: true, amountCents: true, order: true },
      },
      costs: {
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        select: { id: true, label: true, amountCents: true, category: true, billable: true, order: true },
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
      targets: i.targets.map((t) => ({
        accountId: t.accountId,
        publishedAt: t.publishedAt?.toISOString() ?? null,
      })),
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
    installments: planning.installments.map((i) => ({
      ...i,
      dueDate: i.dueDate.toISOString(),
    })),
    user: {
      name: session.user.name ?? null,
      email: session.user.email ?? "",
    },
  }

  const clients = await prisma.client.findMany({
    where: { userId: session.user.id },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  })

  return <PlanningDetailClient planning={serialized} clients={clients} />
}

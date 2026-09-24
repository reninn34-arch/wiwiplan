import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { DashboardClient } from "./DashboardClient"

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const [rawPlannings, rawPendingIdeas, clients, doneByPlanning] = await Promise.all([
    prisma.planning.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
      include: {
        client: { select: { id: true, name: true } },
        _count: { select: { contentIdeas: true, storyboards: true } },
        payments: { select: { amountCents: true } },
      },
    }),
    prisma.contentIdea.findMany({
      where: { user: { id: session.user.id }, status: { not: "DONE" } },
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
      include: {
        planning: { select: { id: true, title: true, period: true, status: true, client: { select: { name: true } } } },
        _count: { select: { comments: true } },
      },
    }),
    prisma.client.findMany({
      where: { userId: session.user.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
    // Cuántas piezas de cada mes ya están listas: con el total que ya viene en
    // `_count`, dice de un vistazo qué falta producir sin abrir cada mes.
    prisma.contentIdea.groupBy({
      by: ["planningId"],
      where: { planning: { userId: session.user.id }, status: "DONE" },
      _count: { _all: true },
    }),
  ])
  const done = new Map(doneByPlanning.map((row) => [row.planningId, row._count._all]))

  const plannings = rawPlannings.map((p) => ({
    ...p,
    doneIdeas: done.get(p.id) ?? 0,
    updatedAt: p.updatedAt.toISOString(),
    createdAt: p.createdAt.toISOString(),
  }))

  const pendingIdeas = rawPendingIdeas.map((i) => ({
    ...i,
    dueDate: i.dueDate?.toISOString() ?? null,
    createdAt: i.createdAt.toISOString(),
  }))

  return <DashboardClient plannings={plannings} clients={clients} pendingIdeas={pendingIdeas} user={{ id: session.user.id, name: session.user.name ?? null, email: session.user.email ?? "" }} />
}

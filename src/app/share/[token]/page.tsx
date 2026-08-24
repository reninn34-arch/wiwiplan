import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { SharedPlanningView } from "./SharedPlanningView"
import { panelSelect } from "@/lib/media"
import { panelsWithImage } from "@/lib/media.server"

interface Props {
  params: Promise<{ token: string }>
}

export default async function SharePage({ params }: Props) {
  const { token } = await params

  const shareLink = await prisma.shareLink.findUnique({
    where: { token },
    include: {
      planning: {
        include: {
          client: { select: { id: true, name: true } },
          contentIdeas: {
            orderBy: { order: "asc" },
            include: {
              contentIdeaTags: { include: { tag: true } },
              comments: { orderBy: { createdAt: "asc" } },
              images: { orderBy: { order: "asc" }, select: { id: true, order: true } },
              storyboard: {
                include: { panels: { orderBy: { order: "asc" }, select: panelSelect } },
              },
            },
          },
          storyboards: {
            orderBy: { createdAt: "desc" },
            include: { panels: { orderBy: { order: "asc" }, select: panelSelect } },
          },
          payments: { orderBy: { paidAt: "asc" } },
        },
      },
    },
  })

  if (!shareLink) notFound()

  if (shareLink.expiresAt && new Date() > shareLink.expiresAt) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-zinc-400">Enlace Expirado</h1>
          <p className="mt-2 text-zinc-400">Este enlace ha expirado. Solicita uno nuevo.</p>
        </div>
      </main>
    )
  }

  const storyboardIds = [
    ...shareLink.planning.storyboards.map((s) => s.id),
    ...shareLink.planning.contentIdeas.flatMap((i) => (i.storyboard ? [i.storyboard.id] : [])),
  ]
  const withImage = await panelsWithImage(storyboardIds)

  const serialized = {
    ...shareLink.planning,
    contentIdeas: shareLink.planning.contentIdeas.map((i) => ({
      ...i,
      dueDate: i.dueDate?.toISOString() ?? null,
      createdAt: i.createdAt.toISOString(),
      storyboard: i.storyboard ? {
        ...i.storyboard,
        createdAt: i.storyboard.createdAt.toISOString(),
        panels: i.storyboard.panels.map((p) => ({
          ...p,
          hasImage: withImage.has(p.id),
        })),
      } : null,
      comments: i.comments.map((c) => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
      })),
    })),
    payments: shareLink.planning.payments.map((p) => ({
      id: p.id,
      amountCents: p.amountCents,
      kind: p.kind,
      method: p.method,
      note: p.note,
      paidAt: p.paidAt.toISOString(),
    })),
    storyboards: shareLink.planning.storyboards.map((s) => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
      panels: s.panels.map((p) => ({
        ...p,
        hasImage: withImage.has(p.id),
      })),
    })),
  }

  return <SharedPlanningView planning={serialized} />
}

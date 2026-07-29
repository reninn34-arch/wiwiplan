import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { SharedPlanningView } from "./SharedPlanningView"

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
              storyboard: {
                include: { panels: { orderBy: { order: "asc" } } },
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

  if (!shareLink) notFound()

  if (shareLink.expiresAt && new Date() > shareLink.expiresAt) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-zinc-500">Enlace Expirado</h1>
          <p className="mt-2 text-zinc-500">Este enlace ha expirado. Solicita uno nuevo.</p>
        </div>
      </main>
    )
  }

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
          createdAt: p.createdAt.toISOString(),
        })),
      } : null,
      comments: i.comments.map((c) => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
      })),
    })),
    storyboards: shareLink.planning.storyboards.map((s) => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
      panels: s.panels.map((p) => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
      })),
    })),
  }

  return <SharedPlanningView planning={serialized} />
}

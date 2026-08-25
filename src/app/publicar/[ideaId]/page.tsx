import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { PublishClient } from "./PublishClient"

/**
 * La pantalla del momento de publicar. El aviso lleva acá y no a la pieza
 * dentro del mes: cuando suena, lo único que hace falta es el copy, abrir la
 * red y decir que ya salió. Todo lo demás es ruido en ese instante.
 */
export default async function PublishPage({
  params,
}: {
  params: Promise<{ ideaId: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { ideaId } = await params

  const idea = await prisma.contentIdea.findFirst({
    where: { id: ideaId, planning: { userId: session.user.id } },
    select: {
      id: true,
      title: true,
      description: true,
      caption: true,
      postType: true,
      dueDate: true,
      publishTime: true,
      planningId: true,
      planning: { select: { period: true, client: { select: { name: true } } } },
      images: { orderBy: { order: "asc" }, select: { id: true } },
      targets: {
        select: {
          accountId: true,
          publishedAt: true,
          account: { select: { network: true, handle: true, mode: true } },
        },
      },
    },
  })

  if (!idea) notFound()

  return (
    <PublishClient
      piece={{
        id: idea.id,
        title: idea.title,
        description: idea.description,
        caption: idea.caption,
        postType: idea.postType,
        dueDate: idea.dueDate?.toISOString() ?? null,
        publishTime: idea.publishTime,
        planningId: idea.planningId,
        period: idea.planning.period,
        clientName: idea.planning.client?.name ?? "Sin cliente",
        imageIds: idea.images.map((i) => i.id),
        targets: idea.targets.map((t) => ({
          accountId: t.accountId,
          network: t.account.network,
          handle: t.account.handle,
          mode: t.account.mode,
          publishedAt: t.publishedAt?.toISOString() ?? null,
        })),
      }}
    />
  )
}

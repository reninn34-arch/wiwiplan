import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import type { AgendaPiece } from "@/lib/agenda"
import { AgendaClient } from "./AgendaClient"

/**
 * Qué sale y cuándo, cruzando todos los clientes. El calendario responde "cómo
 * viene el mes de Kibou"; esto responde "¿qué me toca hoy?", que con seis
 * clientes en paralelo no se contesta abriendo seis meses.
 */
export default async function AgendaPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  // Sólo lo que tiene día o redes: una idea suelta sin programar no es agenda,
  // vive en el mes y ahí se queda hasta que alguien la programe.
  const ideas = await prisma.contentIdea.findMany({
    where: {
      planning: { userId: session.user.id },
      OR: [{ NOT: { dueDate: null } }, { targets: { some: {} } }],
    },
    select: {
      id: true,
      title: true,
      planningId: true,
      dueDate: true,
      publishTime: true,
      planning: { select: { client: { select: { name: true } } } },
      targets: {
        select: {
          accountId: true,
          publishedAt: true,
          account: { select: { network: true } },
        },
      },
    },
  })

  const pieces: AgendaPiece[] = ideas.map((idea) => ({
    id: idea.id,
    title: idea.title,
    planningId: idea.planningId,
    clientName: idea.planning.client?.name ?? "Sin cliente",
    dueDate: idea.dueDate?.toISOString() ?? null,
    publishTime: idea.publishTime,
    targets: idea.targets.map((t) => ({
      accountId: t.accountId,
      network: t.account.network,
      publishedAt: t.publishedAt?.toISOString() ?? null,
    })),
  }))

  return <AgendaClient pieces={pieces} />
}

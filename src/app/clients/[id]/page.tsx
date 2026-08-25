import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { summarizeClientAccount } from "@/lib/client-account"
import { ClientDetailClient } from "./ClientDetailClient"

interface Props {
  params: Promise<{ id: string }>
}

export default async function ClientDetailPage({ params }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const { id } = await params

  const client = await prisma.client.findFirst({
    where: { id, userId: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      planName: true,
      rateCents: true,
      accounts: {
        orderBy: { createdAt: "asc" },
        select: { id: true, network: true, handle: true, mode: true },
      },
      plannings: {
        orderBy: { period: "desc" },
        select: {
          id: true,
          title: true,
          period: true,
          status: true,
          priceCents: true,
          costCents: true,
          updatedAt: true,
          _count: { select: { contentIdeas: true } },
          payments: {
            orderBy: { paidAt: "desc" },
            select: { id: true, amountCents: true, kind: true, method: true, note: true, paidAt: true },
          },
        },
      },
    },
  })

  if (!client) notFound()

  // El estado de cuenta se arma en el servidor: la interfaz sólo lo muestra.
  const account = summarizeClientAccount(
    client.plannings.map((p) => ({
      id: p.id,
      period: p.period,
      title: p.title,
      status: p.status,
      priceCents: p.priceCents,
      costCents: p.costCents,
      payments: p.payments,
    })),
  )

  // Últimos movimientos de todos los meses juntos: responde "¿cuándo me pagó
  // por última vez?", que mirando mes por mes no se puede contestar.
  const recentEntries = client.plannings
    .flatMap((p) =>
      p.payments.map((entry) => ({
        ...entry,
        paidAt: entry.paidAt.toISOString(),
        planningId: p.id,
        period: p.period,
      })),
    )
    .sort((a, b) => b.paidAt.localeCompare(a.paidAt))
    .slice(0, 12)

  return (
    <ClientDetailClient
      client={{
        id: client.id,
        name: client.name,
        email: client.email,
        planName: client.planName,
        rateCents: client.rateCents,
      }}
      account={account}
      accounts={client.accounts}
      ideaCounts={Object.fromEntries(client.plannings.map((p) => [p.id, p._count.contentIdeas]))}
      recentEntries={recentEntries}
    />
  )
}

import "server-only"
import { prisma } from "@/lib/prisma"
import { unseal } from "@/lib/secret-box.server"
import { facebookMetrics, instagramMetrics, tieneAlgo } from "@/lib/meta-insights.server"

/**
 * Trae los números de todo lo que ya salió en un mes.
 *
 * Sólo mira publicaciones con `externalPostId`: sin el id de la entrada no hay
 * a quién preguntarle. Eso deja fuera lo marcado a mano como publicado, que es
 * correcto —de esas la app no sabe ni dónde están— y conviene que se note en
 * la pantalla en vez de disimularlo con ceros.
 */

export interface RefreshOutcome {
  /** Publicaciones con números nuevos guardados. */
  actualizadas: number
  /** Se preguntó y la red no devolvió ni un dato. */
  sinDatos: number
  /** Publicadas a mano: no hay id al que preguntarle. */
  sinId: number
  /** La cuenta perdió su conexión. */
  sinConexion: number
}

export async function refreshPlanningMetrics(
  planningId: string,
  userId: string,
): Promise<RefreshOutcome> {
  const outcome: RefreshOutcome = { actualizadas: 0, sinDatos: 0, sinId: 0, sinConexion: 0 }

  const targets = await prisma.ideaTarget.findMany({
    where: {
      idea: { planningId, planning: { userId } },
      NOT: { publishedAt: null },
    },
    select: {
      ideaId: true,
      accountId: true,
      externalPostId: true,
      account: { select: { network: true, accessToken: true } },
    },
  })

  for (const target of targets) {
    if (!target.externalPostId) {
      outcome.sinId += 1
      continue
    }

    const token = unseal(target.account.accessToken)
    if (!token) {
      outcome.sinConexion += 1
      continue
    }

    const metrics =
      target.account.network === "FACEBOOK"
        ? await facebookMetrics(target.externalPostId, token)
        : await instagramMetrics(target.externalPostId, token)

    // Si no vino nada, no se guarda: pisar números buenos de ayer con nulos de
    // hoy sería perder el único dato que teníamos por un fallo pasajero.
    if (!tieneAlgo(metrics)) {
      outcome.sinDatos += 1
      continue
    }

    await prisma.ideaTarget.update({
      where: { ideaId_accountId: { ideaId: target.ideaId, accountId: target.accountId } },
      data: { ...metrics, metricsAt: new Date() },
    })
    outcome.actualizadas += 1
  }

  return outcome
}

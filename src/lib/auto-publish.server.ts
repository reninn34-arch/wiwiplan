import "server-only"
import { prisma } from "@/lib/prisma"
import { unseal } from "@/lib/secret-box.server"
import { advancePublish, MetaPublishError } from "@/lib/meta-publish.server"

/**
 * El carril automático: publicar solo, a la hora, en las cuentas conectadas.
 *
 * La regla que manda sobre todo lo demás: **cuando falla, cae al carril
 * asistido**. Una publicación que no salió y nadie avisó es peor que no haber
 * prometido automatizarla, porque uno se entera cuando el cliente pregunta.
 */

/** Después de esto, insistir sólo repite el mismo error. */
const MAX_ATTEMPTS = 4

export interface AutoPublishOutcome {
  published: number
  /** Contenedores que Meta todavía está procesando; se retoman después. */
  processing: number
  /** Fallaron: quedan para el carril asistido y hay que avisar. */
  failed: number
}

export interface TargetToPublish {
  ideaId: string
  accountId: string
  containerId: string | null
  attempts: number
}

/**
 * Intenta publicar un destino. Nunca lanza: devuelve qué pasó, porque un fallo
 * de una pieza no puede detener el barrido de las demás.
 */
export async function publishTarget(target: TargetToPublish): Promise<"published" | "processing" | "failed"> {
  const row = await prisma.ideaTarget.findUnique({
    where: { ideaId_accountId: { ideaId: target.ideaId, accountId: target.accountId } },
    select: {
      publishedAt: true,
      containerId: true,
      attempts: true,
      account: {
        select: { mode: true, externalId: true, accessToken: true, tokenExpiresAt: true },
      },
      idea: {
        select: {
          caption: true,
          title: true,
          media: { orderBy: [{ order: "asc" }, { createdAt: "asc" }], select: { url: true, kind: true } },
        },
      },
    },
  })

  // Ya salió: no se toca. Es la barrera contra publicar dos veces.
  if (!row || row.publishedAt) return "published"

  const fail = async (message: string, permanent: boolean) => {
    await prisma.ideaTarget.update({
      where: { ideaId_accountId: { ideaId: target.ideaId, accountId: target.accountId } },
      data: {
        attempts: permanent ? MAX_ATTEMPTS : row.attempts + 1,
        attemptedAt: new Date(),
        lastError: message.slice(0, 400),
        // Un contenedor que quedó en error no sirve para reintentar.
        ...(permanent ? { containerId: null } : {}),
      },
    })
    return "failed" as const
  }

  const account = row.account
  if (account.mode !== "AUTOMATIC" || !account.externalId) return "failed"

  const token = unseal(account.accessToken)
  if (!token) {
    return fail("La conexión con Meta caducó. Vuelve a conectar la cuenta.", true)
  }
  if (account.tokenExpiresAt && account.tokenExpiresAt.getTime() < Date.now()) {
    return fail("El permiso de Meta caducó. Vuelve a conectar la cuenta.", true)
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    return "failed"
  }
  if (row.idea.media.length === 0) {
    return fail("La pieza no tiene ningún archivo subido.", true)
  }

  try {
    const progress = await advancePublish(
      {
        instagramId: account.externalId,
        token,
        caption: row.idea.caption || row.idea.title || "",
        mediaUrls: row.idea.media.map((m) => ({ url: m.url, isVideo: m.kind === "VIDEO" })),
      },
      row.containerId,
    )

    if (progress.postId) {
      await prisma.ideaTarget.update({
        where: { ideaId_accountId: { ideaId: target.ideaId, accountId: target.accountId } },
        data: {
          publishedAt: new Date(),
          externalPostId: progress.postId,
          containerId: null,
          lastError: null,
          attemptedAt: new Date(),
        },
      })
      return "published"
    }

    // Sigue procesando: se guarda el contenedor para retomarlo sin volver a
    // crearlo, que es lo que evita publicar la misma pieza dos veces.
    await prisma.ideaTarget.update({
      where: { ideaId_accountId: { ideaId: target.ideaId, accountId: target.accountId } },
      data: { containerId: progress.containerId, attemptedAt: new Date(), lastError: null },
    })
    return "processing"
  } catch (error) {
    const permanent = error instanceof MetaPublishError && error.permanent
    const message = error instanceof Error ? error.message : "Error desconocido al publicar"
    console.error(`[publicar] Falló ${target.ideaId}/${target.accountId}:`, message)
    return fail(message, permanent)
  }
}

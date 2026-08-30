import "server-only"
import { prisma } from "@/lib/prisma"
import { unseal } from "@/lib/secret-box.server"
import {
  advancePublish,
  MetaPublishError,
  type PublishFailureKind,
} from "@/lib/meta-publish.server"

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

  /**
   * Registra el fallo y decide cuánto crédito de reintento se gasta.
   *
   * La distinción importa más de lo que parece. Un error de la **cuenta** —el
   * token muerto por un bloqueo de Facebook, por ejemplo— no dice nada del
   * contenido, y antes quemaba los cuatro intentos de golpe: la pieza quedaba
   * muerta para siempre aunque la cuenta se arreglara diez minutos después.
   * Ahora gasta uno solo, y reconectar la cuenta devuelve el crédito entero.
   */
  const fail = async (message: string, kind: PublishFailureKind) => {
    await prisma.ideaTarget.update({
      where: { ideaId_accountId: { ideaId: target.ideaId, accountId: target.accountId } },
      data: {
        attempts: kind === "contenido" ? MAX_ATTEMPTS : row.attempts + 1,
        attemptedAt: new Date(),
        lastError: message.slice(0, 400),
        // Un contenedor que quedó en error no sirve para reintentar. Con un
        // fallo de cuenta sí se conserva: el archivo ya subido sigue valiendo,
        // y volver a crearlo arriesga publicar dos veces.
        ...(kind === "contenido" ? { containerId: null } : {}),
      },
    })
    return "failed" as const
  }

  const account = row.account
  if (account.mode !== "AUTOMATIC" || !account.externalId) return "failed"

  const token = unseal(account.accessToken)
  if (!token) {
    return fail("La conexión con Meta caducó. Vuelve a conectar la cuenta.", "cuenta")
  }
  if (account.tokenExpiresAt && account.tokenExpiresAt.getTime() < Date.now()) {
    return fail("El permiso de Meta caducó. Vuelve a conectar la cuenta.", "cuenta")
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    return "failed"
  }
  if (row.idea.media.length === 0) {
    return fail("La pieza no tiene ningún archivo subido.", "contenido")
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
    // Sin clasificar se asume temporal: gastar un intento y volver es más
    // barato que dar por muerta una pieza que quizá sólo tropezó.
    const kind = error instanceof MetaPublishError ? error.kind : "temporal"
    const message = error instanceof Error ? error.message : "Error desconocido al publicar"
    console.error(`[publicar] Falló ${target.ideaId}/${target.accountId} (${kind}):`, message)
    return fail(message, kind)
  }
}

/**
 * Devuelve el crédito de reintento a lo que quedó pendiente de una cuenta.
 *
 * Se llama al (re)conectar. La razón: cuando una cuenta se cae —un bloqueo de
 * Facebook, un token caducado—, sus piezas acumulan intentos por algo que no
 * tenía nada que ver con ellas. Arreglar la cuenta y dejar las piezas gastadas
 * sería arreglar a medias: seguirían sin salir y nadie sabría por qué.
 *
 * No se toca `containerId`: un contenedor ya creado en Meta sigue siendo
 * válido, y descartarlo arriesga crear otro y publicar la misma pieza dos
 * veces.
 */
export async function restoreAttempts(accountId: string): Promise<number> {
  const { count } = await prisma.ideaTarget.updateMany({
    where: { accountId, publishedAt: null },
    data: { attempts: 0, lastError: null },
  })
  return count
}

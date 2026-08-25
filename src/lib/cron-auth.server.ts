import "server-only"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"

/**
 * Quién puede disparar un barrido programado: el cron con su secreto, o un
 * usuario logueado para lo suyo —que además es cómo se prueba sin esperar.
 *
 * Existe como pieza aparte por una razón concreta: el proyecto estuvo con
 * `CRON_SECRET` sin configurar y el cron diario respondía 401 todos los días
 * sin que nadie se enterara. Un barrido que no corre no se queja; hay que
 * hacerlo hablar a propósito.
 */

export type CronAuth =
  | { ok: false; reason: string }
  /** `userId` ausente = corre para todos los usuarios (es el cron). */
  | { ok: true; userId?: string }

export async function authorizeCron(request: NextRequest): Promise<CronAuth> {
  const session = await auth()
  if (session?.user?.id) return { ok: true, userId: session.user.id }

  const secret = process.env.CRON_SECRET
  const header = request.headers.get("authorization")

  if (!secret) {
    // El caso que se estuvo perdiendo: sin la variable no hay forma de que un
    // cron se autentique, y sin este aviso el fallo es invisible en los logs.
    console.error(
      "[cron] CRON_SECRET no está configurado: ningún barrido programado va a poder ejecutarse. " +
        "Agrégalo en las variables de entorno del proyecto.",
    )
    return { ok: false, reason: "El servidor no tiene CRON_SECRET configurado" }
  }

  if (header !== `Bearer ${secret}`) {
    console.warn("[cron] Llamada rechazada: el secreto no coincide.")
    return { ok: false, reason: "No autorizado" }
  }

  return { ok: true }
}

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { pushConfigured, pushToUser } from "@/lib/push.server"

/**
 * Aviso de prueba, inmediato. Existe porque "activé los avisos y no me llegó
 * nada" tiene tres causas posibles —permiso, llaves, o que nada haya llegado a
 * su hora— y sin esto no hay forma de saber cuál es.
 */
export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  if (!pushConfigured()) {
    return NextResponse.json(
      { error: "Faltan las llaves VAPID en el servidor" },
      { status: 503 },
    )
  }

  const outcome = await pushToUser(session.user.id, {
    title: "Los avisos funcionan",
    body: "Así se va a ver cuando llegue la hora de publicar una pieza.",
    url: "/agenda",
    tag: "prueba",
  })

  if (outcome.sent === 0) {
    return NextResponse.json(
      { error: "No hay ningún dispositivo conectado a esta cuenta" },
      { status: 404 },
    )
  }

  return NextResponse.json({ success: true, ...outcome })
}

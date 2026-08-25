import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { runPublishReminders } from "@/lib/publish-reminders.server"

/**
 * Barrido de avisos de publicación. Lo disparan el ping externo cada 15
 * minutos, el cron diario de Vercel como red de seguridad, o un usuario
 * logueado desde el botón "Revisar ahora" de la agenda.
 *
 * Va abierto a propósito, y no es un descuido: el push sólo llega a los
 * dispositivos del dueño de cada pieza, y repetir el barrido es idempotente —
 * `notifiedAt` impide dobles avisos—. Pedir un secreto acá obligaba a cargarlo
 * también en el repositorio de GitHub para el ping externo, y sin eso el reloj
 * se caía en silencio. Lo único que un secreto evitaría es que alguien repita
 * una consulta barata; ese costo no justifica la configuración extra.
 */
export async function GET() {
  return sweep()
}

/**
 * QStash entrega sus mensajes con POST: mismo barrido, otro verbo. Sin esto,
 * cada despertar puntual rebotaba con 405 y la cita exacta nunca sonaba.
 */
export async function POST() {
  return sweep()
}

async function sweep() {
  // Con sesión, sólo las piezas propias (es el "Revisar ahora" de la agenda);
  // sin sesión, barrido global: el caso del reloj externo y del cron de Vercel.
  const session = await auth()

  try {
    const outcome = await runPublishReminders(session?.user?.id)
    return NextResponse.json({ success: true, ...outcome })
  } catch (error) {
    console.error("Error ejecutando avisos de publicación:", error)
    return NextResponse.json({ error: "Error al ejecutar" }, { status: 500 })
  }
}

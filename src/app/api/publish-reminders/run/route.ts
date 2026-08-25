import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { runPublishReminders } from "@/lib/publish-reminders.server"

/**
 * Barrido de avisos de publicación. Lo despiertan la cita exacta de QStash
 * —agendada pieza por pieza—, el cron diario de Vercel y el reloj interno del
 * proceso como redes de seguridad, o un usuario logueado desde el botón
 * "Revisar ahora" de la agenda.
 *
 * Va abierto a propósito, y no es un descuido: el push sólo llega a los
 * dispositivos del dueño de cada pieza, y repetir el barrido es idempotente —
 * `notifiedAt` impide dobles avisos—. Lo único que un secreto evitaría es que
 * alguien repita una consulta barata.
 *
 * Si algún día conviene cerrarlo, QStash firma sus entregas y `Receiver` del
 * mismo paquete valida la firma sin tener que repartir secretos por ningún
 * lado: es la puerta que dejó abierta quitar el ping de GitHub.
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

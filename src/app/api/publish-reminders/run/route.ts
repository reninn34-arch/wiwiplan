import { NextRequest, NextResponse } from "next/server"
import { runPublishReminders } from "@/lib/publish-reminders.server"
import { authorizeCron } from "@/lib/cron-auth.server"

/**
 * Barrido de avisos de publicación. Lo dispara el ping externo cada 15 minutos
 * con el secreto, el cron diario de Vercel como red de seguridad, o un usuario
 * logueado desde el botón "Revisar ahora" de la agenda.
 */
export async function GET(request: NextRequest) {
  const access = await authorizeCron(request)
  if (!access.ok) {
    return NextResponse.json({ error: access.reason }, { status: 401 })
  }

  try {
    const outcome = await runPublishReminders(access.userId)
    return NextResponse.json({ success: true, ...outcome })
  } catch (error) {
    console.error("Error ejecutando avisos de publicación:", error)
    return NextResponse.json({ error: "Error al ejecutar" }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { runPublishReminders } from "@/lib/publish-reminders.server"

/**
 * Barrido de avisos de publicación. Lo dispara el cron con el secreto, o un
 * usuario logueado para sus propias piezas —que además es la forma de probarlo
 * sin esperar al cron.
 */
export async function GET(request: NextRequest) {
  const session = await auth()
  const cronSecret = process.env.CRON_SECRET
  const header = request.headers.get("authorization")

  const isCron = Boolean(cronSecret && header === `Bearer ${cronSecret}`)
  if (!session?.user?.id && !isCron) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    // El cron barre todos los usuarios; manual, sólo las propias.
    const outcome = await runPublishReminders(
      isCron && !session?.user?.id ? undefined : session!.user!.id,
    )
    return NextResponse.json({ success: true, ...outcome })
  } catch (error) {
    console.error("Error ejecutando avisos de publicación:", error)
    return NextResponse.json({ error: "Error al ejecutar" }, { status: 500 })
  }
}

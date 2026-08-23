import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { runReminders } from "@/lib/reminders.server"

/**
 * Barrido diario de recordatorios de saldo. Lo dispara el cron de Vercel con
 * el secreto configurado, o un usuario logueado para sus propios planes.
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
    // El cron barre todos los usuarios; manual, sólo los propios.
    const outcome = await runReminders(isCron && !session?.user?.id ? undefined : session!.user!.id)
    return NextResponse.json({ success: true, ...outcome })
  } catch (error) {
    console.error("Error ejecutando recordatorios:", error)
    return NextResponse.json({ error: "Error al ejecutar recordatorios" }, { status: 500 })
  }
}

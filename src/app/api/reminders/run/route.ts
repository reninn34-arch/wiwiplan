import { NextRequest, NextResponse } from "next/server"
import { runReminders } from "@/lib/reminders.server"
import { authorizeCron } from "@/lib/cron-auth.server"

/**
 * Barrido diario de recordatorios de saldo. Lo dispara el cron con el secreto,
 * o un usuario logueado para sus propios planes.
 */
export async function GET(request: NextRequest) {
  const access = await authorizeCron(request)
  if (!access.ok) {
    return NextResponse.json({ error: access.reason }, { status: 401 })
  }

  try {
    // Sin userId es el cron, que barre a todos; con userId, sólo los propios.
    const outcome = await runReminders(access.userId)
    return NextResponse.json({ success: true, ...outcome })
  } catch (error) {
    console.error("Error ejecutando recordatorios:", error)
    return NextResponse.json({ error: "Error al ejecutar recordatorios" }, { status: 500 })
  }
}

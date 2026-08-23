import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getSmtpConfig, isConfigured, maskSecret, saveSmtpSettings } from "@/lib/email.server"

async function maskedState() {
  const config = await getSmtpConfig()
  return {
    host: config.host,
    port: config.port,
    user: config.user,
    hasPass: Boolean(config.pass),
    passPreview: maskSecret(config.pass),
    from: config.from,
    configured: isConfigured(config),
  }
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  try {
    return NextResponse.json(await maskedState())
  } catch (error) {
    console.error("Error leyendo configuración:", error)
    return NextResponse.json({ error: "Error al leer la configuración" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const patch: Parameters<typeof saveSmtpSettings>[0] = {}

    if (typeof body?.smtpHost === "string") patch.smtpHost = body.smtpHost
    if (typeof body?.smtpPort === "string" || typeof body?.smtpPort === "number") {
      const port = Number(body.smtpPort)
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        return NextResponse.json({ error: "El puerto tiene que ser un número entre 1 y 65535" }, { status: 400 })
      }
      patch.smtpPort = String(port)
    }
    if (typeof body?.smtpUser === "string") patch.smtpUser = body.smtpUser
    if (typeof body?.smtpPass === "string") patch.smtpPass = body.smtpPass
    if (typeof body?.receiptFrom === "string") {
      const from = body.receiptFrom.trim()
      if (
        from &&
        !/^[^<]*<[^>]+@[^>]+>$/.test(from) &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from)
      ) {
        return NextResponse.json(
          { error: "Usa un email válido o formato Nombre <email@dominio.com>" },
          { status: 400 },
        )
      }
      patch.receiptFrom = from
    }

    await saveSmtpSettings(patch)
    return NextResponse.json(await maskedState())
  } catch (error) {
    console.error("Error guardando configuración:", error)
    return NextResponse.json({ error: "Error al guardar la configuración" }, { status: 500 })
  }
}

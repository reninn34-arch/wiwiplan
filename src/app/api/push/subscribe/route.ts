import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

/**
 * Alta y baja de un dispositivo para recibir avisos. Una fila por navegador que
 * dio permiso: el mismo usuario en el teléfono y en la computadora son dos.
 */

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const endpoint = typeof body?.endpoint === "string" ? body.endpoint : ""
    const p256dh = typeof body?.keys?.p256dh === "string" ? body.keys.p256dh : ""
    const authKey = typeof body?.keys?.auth === "string" ? body.keys.auth : ""

    if (!endpoint || !p256dh || !authKey) {
      return NextResponse.json({ error: "Suscripción incompleta" }, { status: 400 })
    }

    // El endpoint identifica al dispositivo. Si el navegador renueva la
    // suscripción manteniéndolo, se actualiza en vez de duplicar la fila; y si
    // el dispositivo pasó a otra cuenta, el userId se reasigna.
    const account = await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: {
        userId: session.user.id,
        p256dh,
        auth: authKey,
        ...(typeof body?.label === "string" ? { label: body.label.slice(0, 80) } : {}),
      },
      create: {
        userId: session.user.id,
        endpoint,
        p256dh,
        auth: authKey,
        label: typeof body?.label === "string" ? body.label.slice(0, 80) : "",
      },
      select: { id: true },
    })

    return NextResponse.json({ success: true, id: account.id }, { status: 201 })
  } catch (error) {
    console.error("Error al registrar el dispositivo:", error)
    return NextResponse.json({ error: "Error al registrar" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const endpoint = typeof body?.endpoint === "string" ? body.endpoint : ""
    if (!endpoint) {
      return NextResponse.json({ error: "Falta el dispositivo" }, { status: 400 })
    }

    await prisma.pushSubscription.deleteMany({
      where: { endpoint, userId: session.user.id },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error al dar de baja el dispositivo:", error)
    return NextResponse.json({ error: "Error al dar de baja" }, { status: 500 })
  }
}

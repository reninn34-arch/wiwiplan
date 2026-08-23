import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { sendEmail } from "@/lib/email.server"

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const to = typeof body?.to === "string" ? body.to.trim() : ""
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return NextResponse.json({ error: "Email inválido" }, { status: 400 })
    }

    const result = await sendEmail(
      to,
      "Prueba de configuración — WiwiPlan",
      `<!DOCTYPE html><html lang="es"><body style="margin:0;padding:24px;background:#f4f4f5;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
        <table role="presentation" width="100%"><tr><td align="center">
          <table role="presentation" style="max-width:460px;width:100%;background:#fff;border-radius:12px;border:1px solid #e4e4e7;padding:28px;">
            <tr><td>
              <p style="margin:0 0 8px;font-size:20px;font-weight:700;color:#18181b;">Configuración lista ✅</p>
              <p style="margin:0;font-size:14px;line-height:1.6;color:#3f3f46;">
                Si leés esto, el servidor SMTP está funcionando y los recibos de pago ya pueden salir
                hacia <strong>${to}</strong>.
              </p>
            </td></tr>
          </table>
        </td></tr></table>
      </body></html>`,
    )

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error en email de prueba:", error)
    return NextResponse.json({ error: "Error al enviar la prueba" }, { status: 500 })
  }
}

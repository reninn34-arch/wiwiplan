import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { buildReceiptHtml, receiptNumberFromId } from "@/lib/receipt"
import { buildReceiptPdf } from "@/lib/receipt-pdf"
import { sendEmail } from "@/lib/email.server"
import {
  formatPaymentDate,
  paymentMethodLabels,
  summarizePayments,
} from "@/lib/payments"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const { id } = await params
    const body = await request.json()
    const to = typeof body?.to === "string" ? body.to.trim() : ""
    const detail = typeof body?.detail === "string" ? body.detail : ""
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return NextResponse.json({ error: "Email del destinatario inválido" }, { status: 400 })
    }

    // Los montos del recibo se recalculan acá, nunca se confía en el cliente.
    const planning = await prisma.planning.findFirst({
      where: { id, userId: session.user.id },
      select: {
        period: true,
        title: true,
        priceCents: true,
        client: { select: { name: true } },
        payments: { select: { id: true, amountCents: true, method: true, note: true, paidAt: true } },
      },
    })
    if (!planning) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 })
    }

    const paymentId = typeof body?.paymentId === "string" ? body.paymentId : ""
    const payment = planning.payments.find((p) => p.id === paymentId)
    if (!payment) {
      return NextResponse.json({ error: "Cobro no encontrado" }, { status: 404 })
    }

    const summary = summarizePayments(planning.priceCents, planning.payments)
    const months: Record<string, string> = {
      "01": "Enero", "02": "Febrero", "03": "Marzo", "04": "Abril",
      "05": "Mayo", "06": "Junio", "07": "Julio", "08": "Agosto",
      "09": "Septiembre", "10": "Octubre", "11": "Noviembre", "12": "Diciembre",
    }
    const periodParts = planning.period.split("-")
    const periodLabel =
      periodParts.length === 2
        ? `${months[periodParts[1]] ?? periodParts[1]} ${periodParts[0]}`
        : planning.period

    const html = buildReceiptHtml({
      businessName: session.user.name ?? "Recibos",
      businessEmail: session.user.email ?? null,
      clientName: planning.client?.name ?? "Cliente",
      periodLabel,
      planTitle: planning.title,
      receiptNumber: receiptNumberFromId(payment.id),
      priceCents: summary.priceCents,
      paidCents: summary.paidCents,
      dueCents: summary.dueCents,
      payment: {
        dateLabel: formatPaymentDate(payment.paidAt.toISOString()),
        amountCents: payment.amountCents,
        methodLabel: paymentMethodLabels[payment.method] ?? payment.method,
        note: payment.note,
      },
      detail,
    })

    // El cliente recibe el HTML en el cuerpo y el mismo documento como PDF.
    const pdfBytes = await buildReceiptPdf({
      businessName: session.user.name ?? "Recibos",
      businessEmail: session.user.email ?? null,
      clientName: planning.client?.name ?? "Cliente",
      periodLabel,
      planTitle: planning.title,
      receiptNumber: receiptNumberFromId(payment.id),
      priceCents: summary.priceCents,
      paidCents: summary.paidCents,
      dueCents: summary.dueCents,
      payment: {
        dateLabel: formatPaymentDate(payment.paidAt.toISOString()),
        amountCents: payment.amountCents,
        methodLabel: paymentMethodLabels[payment.method] ?? payment.method,
        note: payment.note,
      },
      detail,
    })

    const result = await sendEmail(to, `Recibo de pago — ${periodLabel}`, html, {
      filename: `recibo-${receiptNumberFromId(payment.id)}.pdf`,
      content: Buffer.from(pdfBytes),
    })
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 })
    }

    console.error(`Recibo enviado a ${to} por ${payment.amountCents / 100} USD`)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error al enviar recibo:", error)
    return NextResponse.json({ error: "Error al enviar el recibo" }, { status: 500 })
  }
}

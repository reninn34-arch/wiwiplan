import "server-only"
import { prisma } from "@/lib/prisma"
import { sendEmail, SMTP_NOT_CONFIGURED } from "@/lib/email.server"
import { formatMoney, summarizePayments, type PaymentLike } from "./payments"
import { formatPeriodLabel } from "./planning-period"

/**
 * Barrido de recordatorios de saldo pendiente. Lo corre el cron diario y
 * también se puede disparar manualmente por usuario. Reglas:
 * - Sólo planes con precio cargado, saldo mayor a cero y cliente con correo.
 * - Sólo si tienen fechas de cobro vencidas (es lo que dispara el aviso).
 * - Anti-spam: máximo un recordatorio cada 72 horas por plan.
 */

const THROTTLE_MS = 72 * 60 * 60 * 1000

export { formatPeriodLabel as periodLabelOf } from "./planning-period"

function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function reminderHtml(params: {
  businessName: string
  clientName: string
  periodLabel: string
  dueCents: number
  settledCents: number
  priceCents: number
  overdue: Array<{ label: string; dueDate: Date; amountCents: number }>
}): string {
  const rows = params.overdue
    .map(
      (i) => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #e4e4e0;font-size:13px;color:#141414;">
          ${esc(i.label || "Cuota")}
          <span style="display:block;font-size:11px;color:#8f8f8c;margin-top:2px;">Vencida el ${esc(i.dueDate.toLocaleDateString("es-EC", { day: "numeric", month: "long" }))}</span>
        </td>
        <td align="right" style="padding:8px 0;border-bottom:1px solid #e4e4e0;font-size:13px;font-weight:600;color:#141414;">${esc(formatMoney(i.amountCents))}</td>
      </tr>`,
    )
    .join("")

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:32px 14px;background:#efefec;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#141414;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e4e4e0;">
  <tr><td colspan="2" style="height:6px;background:#c42c33;font-size:0;line-height:0;">&nbsp;</td></tr>
  <tr>
    <td style="padding:28px 36px 20px;">
      <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:.24em;text-transform:uppercase;color:#c42c33;">Recordatorio de pago</p>
      <p style="margin:8px 0 0;font-size:19px;font-weight:700;color:#141414;">${esc(params.businessName)}</p>
    </td>
  </tr>
  <tr><td style="padding:0 36px;"><div style="border-top:2px solid #141414;"></div></td></tr>
  <tr>
    <td style="padding:22px 36px 6px;">
      <p style="margin:0;font-size:14px;line-height:1.65;color:#3d3c39;">
        Hola <strong>${esc(params.clientName)}</strong>, te escribimos para recordarte que la planificación de
        <strong>${esc(params.periodLabel)}</strong> registra cuotas vencidas con saldo pendiente.
      </p>
    </td>
  </tr>
  <tr>
    <td style="padding:16px 36px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:0 0 7px;border-bottom:1px solid #141414;"><span style="font-size:9.5px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:#8f8f8c;">Cuotas vencidas</span></td>
          <td align="right" style="padding:0 0 7px;border-bottom:1px solid #141414;width:110px;"><span style="font-size:9.5px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:#8f8f8c;">Importe</span></td>
        </tr>
        ${rows}
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:22px 36px 0;">
      <table role="presentation" align="right" cellpadding="0" cellspacing="0" style="width:260px;">
        <tr>
          <td style="padding:5px 0;font-size:12px;color:#63625e;">Valor del mes</td>
          <td align="right" style="padding:5px 0;font-size:12.5px;color:#141414;">${esc(formatMoney(params.priceCents))}</td>
        </tr>
        <tr>
          <td style="padding:5px 0;font-size:12px;color:#63625e;">Cubierto a la fecha</td>
          <td align="right" style="padding:5px 0;font-size:12.5px;color:#141414;">${esc(formatMoney(params.settledCents))}</td>
        </tr>
        <tr>
          <td style="padding:11px 0 3px;border-top:1px solid #141414;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#8a5a00;">Saldo pendiente</td>
          <td align="right" style="padding:11px 0 3px;border-top:1px solid #141414;font-size:18px;font-weight:800;color:#8a5a00;">${esc(formatMoney(params.dueCents))}</td>
        </tr>
      </table>
      <div style="clear:both;height:0;font-size:0;">&nbsp;</div>
    </td>
  </tr>
  <tr>
    <td style="padding:26px 36px 32px;">
      <div style="border-top:1px solid #e4e4e0;"></div>
      <p style="margin:14px 0 0;font-size:11.5px;line-height:1.65;color:#8f8f8c;">
        Si ya realizaste el pago, ignora este mensaje o responde con el comprobante para actualizarlo.
        Este es un recordatorio automático del sistema de planificación.
      </p>
    </td>
  </tr>
</table>
</td></tr></table>
</body>
</html>`
}

export interface ReminderOutcome {
  sent: number
  skipped: number
  errors: number
}

export async function runReminders(userId?: string): Promise<ReminderOutcome> {
  const now = new Date()
  const throttleBefore = new Date(now.getTime() - THROTTLE_MS)

  const plannings = await prisma.planning.findMany({
    where: {
      ...(userId ? { userId } : {}),
      priceCents: { gt: 0 },
      OR: [{ reminderSentAt: null }, { reminderSentAt: { lte: throttleBefore } }],
      client: { is: { email: { not: "" } } },
    },
    select: {
      id: true,
      period: true,
      title: true,
      priceCents: true,
      client: { select: { name: true, email: true } },
      user: { select: { name: true, email: true } },
      payments: { select: { amountCents: true, kind: true } },
      installments: { select: { label: true, amountCents: true, dueDate: true }, orderBy: { dueDate: "asc" } },
    },
  })

  const outcome: ReminderOutcome = { sent: 0, skipped: 0, errors: 0 }

  for (const planning of plannings) {
    const summary = summarizePayments(planning.priceCents, planning.payments as PaymentLike[])
    if (summary.dueCents <= 0) continue

    const overdue = planning.installments.filter((i) => i.dueDate <= now)
    if (overdue.length === 0) continue

    const email = planning.client?.email?.trim()
    if (!email || !planning.client) continue

    const periodLabel = formatPeriodLabel(planning.period)
    const result = await sendEmail(
      email,
      `Recordatorio: saldo pendiente — ${periodLabel}`,
      reminderHtml({
        businessName: planning.user.name ?? planning.user.email.split("@")[0],
        clientName: planning.client.name,        periodLabel,
        priceCents: summary.priceCents,
        // "Cubierto" y no "pagado": puede incluir retenciones y ajustes, que
        // cierran saldo sin haber entrado a la cuenta.
        settledCents: summary.settledCents,
        dueCents: summary.dueCents,
        overdue,
      }),
    )

    if (result.ok) {
      outcome.sent += 1
      await prisma.planning.update({
        where: { id: planning.id },
        data: { reminderSentAt: now },
      })
    } else if (result.error === SMTP_NOT_CONFIGURED) {
      // Sin SMTP configurado no tiene sentido reintentar el resto ahora mismo.
      outcome.skipped += plannings.length - (outcome.sent + outcome.skipped + outcome.errors)
      break
    } else {
      outcome.errors += 1
    }
  }

  return outcome
}

/**
 * Recibo de pago como documento. El mismo HTML se usa para la vista previa en
 * la app y para el cuerpo del email, así lo que ves es lo que llega.
 *
 * Diseño clásico de factura: monocromo, reglas finas, etiquetas en versalitas
 * y totales al estilo contable. Sin cajas de colores ni montos gigantes.
 * Estilos inline: los clientes de correo no respetan hojas externas.
 */
import { formatMoney } from "./payments"

export interface ReceiptPayment {
  dateLabel: string
  amountCents: number
  methodLabel: string
  note: string
}

export interface ReceiptData {
  /** Nombre del creador que emite el recibo. */
  businessName: string
  businessEmail: string | null
  clientName: string
  periodLabel: string
  planTitle: string
  /** Número de comprobante legible (receiptNumberFromId). */
  receiptNumber: string
  /** Precio total acordado del plan. */
  priceCents: number
  /** Total cobrado del plan incluyendo este pago. */
  paidCents: number
  /** Saldo pendiente después de este pago. */
  dueCents: number
  payment: ReceiptPayment
  /** Aclaración libre que escribe el creador (ej.: incluye deuda anterior). */
  detail: string
}

/** Número de comprobante legible derivado del id del cobro. */
export function receiptNumberFromId(id: string): string {
  const clean = id.replace(/[^a-z0-9]/gi, "").toUpperCase()
  return `R-${clean.slice(-6).padStart(6, "0")}`
}

const ISSUE_DATE_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "long",
  year: "numeric",
})

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

const LABEL = "margin:0 0 5px;font-size:9.5px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:#8f8f8c;"
const INK = "#141414"
const MUTED = "#63625e"
const HAIR = "#e4e4e0"

function metaColumn(label: string, lines: Array<[string, boolean]>, extraStyle = ""): string {
  const content = lines
    .map(
      ([text, strong]) =>
        `<p style="margin:${strong ? "3px" : "1px"} 0 0;font-size:${strong ? "13.5px" : "12px"};font-weight:${strong ? "600" : "400"};color:${strong ? INK : MUTED};line-height:1.45;">${esc(text)}</p>`,
    )
    .join("")
  return `<td style="vertical-align:top;padding-right:18px;${extraStyle}">
    <p style="${LABEL}">${esc(label)}</p>
    ${content}
  </td>`
}

export function buildReceiptHtml(data: ReceiptData): string {
  const issuedLabel = ISSUE_DATE_FORMATTER.format(new Date())
  const settled = data.dueCents <= 0 && data.priceCents > 0
  const concept =
    data.payment.note ||
    `Pago recibido (${data.payment.methodLabel})`

  const periodLines: Array<[string, boolean]> = [[data.periodLabel || "—", true]]
  if (data.planTitle) periodLines.push([data.planTitle, false])

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>@page { margin: 16mm; }</style>
</head>
<body style="margin:0;padding:32px 14px;background:#efefec;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:${INK};-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border:1px solid ${HAIR};">

  <!-- Encabezado -->
  <tr>
    <td style="padding:34px 42px 22px;">
      <table role="presentation" width="100%">
        <tr>
          <td style="vertical-align:top;">
            <p style="margin:0;font-size:21px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:${INK};">${esc(data.businessName)}</p>
            ${data.businessEmail ? `<p style="margin:7px 0 0;font-size:12px;color:${MUTED};">${esc(data.businessEmail)}</p>` : ""}
          </td>
          <td style="vertical-align:top;text-align:right;">
            <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:.24em;text-transform:uppercase;color:#8f8f8c;">Recibo</p>
            <p style="margin:6px 0 0;font-size:15px;font-weight:700;color:${INK};">Nº ${esc(data.receiptNumber)}</p>
            <p style="margin:3px 0 0;font-size:12px;color:${MUTED};">${esc(issuedLabel)}</p>
          </td>
        </tr>
      </table>
      <div style="height:0;border-top:2px solid ${INK};margin-top:20px;"></div>
    </td>
  </tr>

  <!-- Datos: cobrado a / período / forma de pago -->
  <tr>
    <td style="padding:6px 42px 26px;">
      <table role="presentation" width="100%">
        <tr>
          ${metaColumn("Cobrado a", [[data.clientName, true]])}
          ${metaColumn("Período", periodLines)}
          ${metaColumn("Forma de pago", [
            [data.payment.methodLabel, true],
            [data.payment.dateLabel, false],
          ], "padding-left:18px;")}
        </tr>
      </table>
    </td>
  </tr>

  <!-- Tabla de detalle -->
  <tr>
    <td style="padding:0 42px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:0 0 8px;border-bottom:1px solid ${INK};"><span style="${LABEL}display:block;">Concepto</span></td>
          <td align="right" style="padding:0 0 8px;border-bottom:1px solid ${INK};width:110px;"><span style="${LABEL}display:block;">Importe</span></td>
        </tr>
        <tr>
          <td style="padding:13px 0;border-bottom:1px solid ${HAIR};vertical-align:top;">
            <p style="margin:0;font-size:13px;font-weight:500;color:${INK};">${esc(concept)}</p>
            <p style="margin:4px 0 0;font-size:11px;color:#8f8f8c;">Pago registrado el ${esc(data.payment.dateLabel)}</p>
          </td>
          <td align="right" style="padding:13px 0;border-bottom:1px solid ${HAIR};vertical-align:top;font-size:13px;font-weight:600;color:${INK};">${esc(formatMoney(data.payment.amountCents))}</td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Detalle redactado por el emisor -->
  ${
    data.detail.trim()
      ? `<tr><td style="padding:18px 42px 0;">
      <p style="${LABEL}">${esc("Detalle")}</p>
      <p style="margin:0;font-size:12.5px;line-height:1.7;color:#3d3c39;white-space:pre-line;">${esc(data.detail.trim())}</p>
    </td></tr>`
      : ""
  }

  <!-- Totales, estilo contable -->
  <tr>
    <td style="padding:30px 42px 0;">
      <table role="presentation" align="right" cellpadding="0" cellspacing="0" style="width:280px;">
        <tr>
          <td style="padding:6px 0;font-size:12px;color:${MUTED};">Precio acordado</td>
          <td align="right" style="padding:6px 0;font-size:12.5px;color:${INK};">${esc(formatMoney(data.priceCents))}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;font-size:12px;color:${MUTED};">Total pagado a la fecha</td>
          <td align="right" style="padding:6px 0;font-size:12.5px;color:${INK};">${esc(formatMoney(data.paidCents))}</td>
        </tr>
        <tr>
          <td style="padding:12px 0 4px;border-top:1px solid ${INK};font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:${INK};${settled ? "" : "color:#8a5a00;"}">
            ${settled ? "Saldado" : "Saldo pendiente"}
          </td>
          <td align="right" style="padding:12px 0 4px;border-top:1px solid ${INK};font-size:19px;font-weight:800;color:${settled ? "#0a7d4b" : "#8a5a00"};">
            ${esc(formatMoney(data.dueCents))}
          </td>
        </tr>
      </table>
      <div style="clear:both;height:0;font-size:0;line-height:0;">&nbsp;</div>
    </td>
  </tr>

  <!-- Pie -->
  <tr>
    <td style="padding:34px 42px 38px;">
      <div style="border-top:1px solid ${HAIR};"></div>
      <p style="margin:16px 0 0;font-size:11.5px;line-height:1.65;color:#8f8f8c;">
        Este documento confirma la recepción del pago detallado arriba. El saldo indicado corresponde
        al período mencionado a la fecha de emisión. Ante cualquier consulta, respondé este mensaje.
      </p>
      <p style="margin:10px 0 0;font-size:11.5px;color:#8f8f8c;">Gracias por tu confianza, ${esc(data.clientName)}.</p>
    </td>
  </tr>
</table>
</td></tr></table>
</body>
</html>`
}

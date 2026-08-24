import "server-only"
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib"
import { formatMoney } from "./payments"
import type { ReceiptData } from "./receipt"

/**
 * El recibo en PDF, para adjuntarlo al email. Replica el diseño del documento
 * HTML: monocromo, reglas finas, etiquetas en versalitas y totales al estilo
 * contable. pdf-lib usa las fuentes estándar embebidas: cero dependencias de
 * archivos externos, seguro para serverless.
 */

const INK = rgb(0.08, 0.08, 0.08)
const MUTED = rgb(0.39, 0.38, 0.37)
const FAINT = rgb(0.56, 0.56, 0.55)
const HAIR = rgb(0.89, 0.89, 0.88)
const AMBER = rgb(0.54, 0.35, 0)
const GREEN = rgb(0.04, 0.49, 0.29)

const PAGE_WIDTH = 595.28 // A4
const MARGIN = 46

/** Corta un texto en líneas que entran en maxWidth según la fuente usada. */
function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = []
  for (const paragraph of text.split("\n")) {
    let current = ""
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = current ? `${current} ${word}` : word
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate
      } else {
        if (current) lines.push(current)
        current = word
      }
    }
    lines.push(current)
  }
  return lines
}

function drawRight(page: PDFPage, text: string, font: PDFFont, size: number, rightX: number, y: number, color = INK) {
  const width = font.widthOfTextAtSize(text, size)
  page.drawText(text, { x: rightX - width, y, size, font, color })
}

export async function buildReceiptPdf(data: ReceiptData): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([PAGE_WIDTH, 841.89])
  const regular = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  const contentWidth = PAGE_WIDTH - MARGIN * 2
  let y = 841.89 - MARGIN

  // Franja superior del rojo WIWI
  page.drawRectangle({
    x: 0,
    y: 841.89 - 6,
    width: PAGE_WIDTH,
    height: 6,
    color: rgb(0.77, 0.17, 0.2), // #c42c33
  })
  y -= 6

  // ── Encabezado: emisor a la izquierda, comprobante a la derecha ──
  page.drawText(data.businessName.toUpperCase(), {
    x: MARGIN,
    y,
    size: 16,
    font: bold,
    color: INK,
  })
  drawRight(page, "RECIBO", bold, 7.5, PAGE_WIDTH - MARGIN, y, FAINT)
  y -= 15
  if (data.businessEmail) {
    page.drawText(data.businessEmail, { x: MARGIN, y, size: 9, font: regular, color: MUTED })
  }
  drawRight(page, `Nº ${data.receiptNumber}`, bold, 10.5, PAGE_WIDTH - MARGIN, y)
  y -= 12
  const issuedLabel = new Intl.DateTimeFormat("es-EC", { day: "numeric", month: "long", year: "numeric" }).format(new Date())
  drawRight(page, issuedLabel, regular, 9, PAGE_WIDTH - MARGIN, y, MUTED)

  // Regla gruesa bajo el encabezado
  y -= 20
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 2,
    color: INK,
  })
  y -= 26

  // ── Datos: cobrado a / período / forma de pago ──
  const colWidth = contentWidth / 3
  const meta: Array<{ label: string; main: string; sub?: string }> = [
    { label: "COBRADO A", main: data.clientName },
    { label: "PERÍODO", main: data.periodLabel || "—", sub: data.planTitle || undefined },
    { label: "FORMA DE PAGO", main: data.payment.methodLabel, sub: data.payment.dateLabel },
  ]
  meta.forEach((column, index) => {
    const x = MARGIN + index * colWidth + (index > 0 ? 12 : 0)
    page.drawText(column.label, { x, y, size: 7, font: bold, color: FAINT })
    page.drawText(column.main.slice(0, 34), {
      x,
      y: y - 13,
      size: 10.5,
      font: bold,
      color: INK,
    })
    if (column.sub) {
      page.drawText(column.sub.slice(0, 40), {
        x,
        y: y - 26,
        size: 9,
        font: regular,
        color: MUTED,
      })
    }
  })
  y -= 44

  // ── Tabla de concepto ──
  page.drawText("CONCEPTO", { x: MARGIN, y, size: 7, font: bold, color: FAINT })
  drawRight(page, "IMPORTE", bold, 7, PAGE_WIDTH - MARGIN, y, FAINT)
  y -= 6
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 1,
    color: INK,
  })
  y -= 18

  const concept = data.payment.note || `Pago recibido (${data.payment.methodLabel})`
  for (const line of wrap(concept, bold, 9.5, contentWidth - 120)) {
    page.drawText(line, { x: MARGIN, y, size: 9.5, font: bold, color: INK })
    y -= 13
  }
  page.drawText(`Pago registrado el ${data.payment.dateLabel}`, {
    x: MARGIN,
    y: y - 1,
    size: 8,
    font: regular,
    color: FAINT,
  })
  drawRight(
    page,
    formatMoney(data.payment.amountCents),
    bold,
    10,
    PAGE_WIDTH - MARGIN,
    y + 1,
  )
  y -= 20
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 0.7,
    color: HAIR,
  })
  y -= 24

  // ── Detalle redactado por el emisor ──
  if (data.detail.trim()) {
    page.drawText("DETALLE", { x: MARGIN, y, size: 7, font: bold, color: FAINT })
    y -= 14
    for (const line of wrap(data.detail.trim(), regular, 9.5, contentWidth)) {
      page.drawText(line, { x: MARGIN, y, size: 9.5, font: regular, color: rgb(0.26, 0.26, 0.25) })
      y -= 13.5
    }
    y -= 10
  }

  // ── Totales, estilo contable, alineados a la derecha ──
  const totalsX = PAGE_WIDTH - MARGIN
  const totalsLeft = totalsX - 250
  const totalRow = (label: string, value: string, gap: number) => {
    page.drawText(label, { x: totalsLeft, y, size: 9, font: regular, color: MUTED })
    drawRight(page, value, regular, 10, totalsX, y, INK)
    y -= gap
  }

  y -= 6
  totalRow("Precio acordado", formatMoney(data.priceCents), 16)
  totalRow("Total pagado a la fecha", formatMoney(data.paidCents), 20)

  const settled = data.dueCents <= 0 && data.priceCents > 0
  page.drawLine({
    start: { x: totalsLeft, y: y + 10 },
    end: { x: totalsX, y: y + 10 },
    thickness: 1.2,
    color: INK,
  })
  page.drawText(settled ? "SALDADO" : "SALDO PENDIENTE", {
    x: totalsLeft,
    y,
    size: 8,
    font: bold,
    color: settled ? INK : AMBER,
  })
  drawRight(
    page,
    formatMoney(data.dueCents),
    bold,
    15,
    totalsX,
    y - 1,
    settled ? GREEN : AMBER,
  )
  y -= 40

  // ── Pie ──
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 0.7,
    color: HAIR,
  })
  y -= 16
  const footer =
    "Este documento confirma la recepción del pago detallado arriba. El saldo indicado corresponde al período mencionado a la fecha de emisión. Ante cualquier consulta, responde este mensaje."
  for (const line of wrap(footer, regular, 8, contentWidth)) {
    page.drawText(line, { x: MARGIN, y, size: 8, font: regular, color: FAINT })
    y -= 11
  }
  y -= 5
  page.drawText(`Gracias por tu confianza, ${data.clientName}.`, {
    x: MARGIN,
    y,
    size: 8,
    font: regular,
    color: FAINT,
  })

  return doc.save()
}

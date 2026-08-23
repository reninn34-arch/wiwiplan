import "server-only"
import nodemailer from "nodemailer"
import { prisma } from "@/lib/prisma"

/**
 * Envío de emails por SMTP. La configuración vive en la base (editable desde
 * el panel de Administración): servidor, puerto, usuario, contraseña y
 * remitente. Puerto 465 usa SSL implícito; 587 STARTTLS.
 */
export interface SmtpConfig {
  host: string
  port: number
  user: string
  pass: string | null
  from: string
}

const KEY_HOST = "smtpHost"
const KEY_PORT = "smtpPort"
const KEY_USER = "smtpUser"
const KEY_PASS = "smtpPass"
const KEY_FROM = "receiptFrom"

const SETTING_KEYS = [KEY_HOST, KEY_PORT, KEY_USER, KEY_PASS, KEY_FROM]

export async function getSmtpConfig(): Promise<SmtpConfig> {
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: SETTING_KEYS } },
  })
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  const port = Number(map[KEY_PORT] || 587)
  return {
    host: map[KEY_HOST] || "",
    port,
    user: map[KEY_USER] || "",
    pass: map[KEY_PASS] || null,
    from: map[KEY_FROM] || "",
  }
}

export function isConfigured(config: SmtpConfig): boolean {
  return Boolean(config.host && config.port && config.from)
}

export async function saveSmtpSettings(patch: {
  smtpHost?: string
  smtpPort?: string
  smtpUser?: string
  smtpPass?: string | null
  receiptFrom?: string
}): Promise<void> {
  const ops: Promise<unknown>[] = []
  const upsert = (key: string, value: string) =>
    prisma.appSetting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    })
  const remove = (key: string) => prisma.appSetting.deleteMany({ where: { key } })

  if (patch.smtpHost !== undefined) {
    const value = patch.smtpHost.trim()
    ops.push(value ? upsert(KEY_HOST, value) : remove(KEY_HOST))
  }
  if (patch.smtpPort !== undefined) {
    const value = patch.smtpPort.trim()
    ops.push(value ? upsert(KEY_PORT, value) : remove(KEY_PORT))
  }
  if (patch.smtpUser !== undefined) {
    const value = patch.smtpUser.trim()
    ops.push(value ? upsert(KEY_USER, value) : remove(KEY_USER))
  }
  if (patch.smtpPass !== undefined) {
    // Sólo cambia si mandan una nueva; string vacío la borra.
    const value = (patch.smtpPass ?? "").trim()
    ops.push(value ? upsert(KEY_PASS, value) : remove(KEY_PASS))
  }
  if (patch.receiptFrom !== undefined) {
    const value = patch.receiptFrom.trim()
    ops.push(value ? upsert(KEY_FROM, value) : remove(KEY_FROM))
  }
  await Promise.all(ops)
}

/** Máscara para mostrar en el panel: sólo los últimos 2 caracteres. */
export function maskSecret(secret: string | null): string {
  if (!secret) return ""
  return secret.length <= 4 ? "••••" : `••••••••${secret.slice(-2)}`
}

export interface EmailAttachment {
  filename: string
  content: Buffer
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  attachment?: EmailAttachment,
): Promise<{ ok: boolean; error?: string }> {
  const config = await getSmtpConfig()
  if (!isConfigured(config)) {
    return { ok: false, error: "Falta configurar el servidor SMTP. Hacelo en Administración." }
  }

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: config.user
        ? { user: config.user, pass: config.pass ?? "" }
        : undefined,
    })

    await transporter.sendMail({
      from: config.from,
      to,
      subject,
      html,
      attachments: attachment
        ? [{ filename: attachment.filename, content: attachment.content }]
        : undefined,
    })
    return { ok: true }
  } catch (error) {
    console.error("Error SMTP al enviar:", error)
    const message = error instanceof Error ? error.message : ""
    if (/auth|login|535|534/i.test(message)) {
      return { ok: false, error: "El servidor rechazó el usuario o la contraseña." }
    }
    if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT/i.test(message)) {
      return { ok: false, error: `No se pudo conectar a ${config.host}:${config.port}.` }
    }
    return { ok: false, error: "No se pudo enviar el email por SMTP." }
  }
}

"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Eye, EyeOff, Mail, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

const fieldClass =
  "h-10 w-full rounded-md border border-white/10 bg-[#18181b] px-3 text-sm text-zinc-200 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500"

/** Proveedores comunes: un clic llena servidor y puerto. */
const SMTP_PRESETS = [
  { label: "Gmail", host: "smtp.gmail.com", port: "587" },
  { label: "Outlook / Microsoft 365", host: "smtp.office365.com", port: "587" },
  { label: "Yahoo", host: "smtp.mail.yahoo.com", port: "465" },
]

interface SettingsState {
  host: string
  port: number
  user: string
  hasPass: boolean
  passPreview: string
  from: string
  configured: boolean
}

export function SettingsClient() {
  const [loading, setLoading] = useState(true)
  const [state, setState] = useState<SettingsState>({
    host: "",
    port: 587,
    user: "",
    hasPass: false,
    passPreview: "",
    from: "",
    configured: false,
  })
  const [draft, setDraft] = useState({ host: "", port: "587", user: "", from: "" })
  const [newPass, setNewPass] = useState("")
  const [showPass, setShowPass] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testTo, setTestTo] = useState("")
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    let active = true
    fetch("/api/settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data) return
        setState(data)
        setDraft({
          host: data.host ?? "",
          port: String(data.port ?? 587),
          user: data.user ?? "",
          from: data.from ?? "",
        })
      })
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  const save = async () => {
    setSaving(true)
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        smtpHost: draft.host,
        smtpPort: draft.port,
        smtpUser: draft.user,
        ...(newPass.trim() ? { smtpPass: newPass.trim() } : {}),
        receiptFrom: draft.from,
      }),
    })
    setSaving(false)
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      toast.error(data?.error ?? "No se pudo guardar la configuración")
      return
    }
    setState(data)
    setNewPass("")
    toast.success("Configuración guardada")
  }

  const sendTest = async () => {
    setTesting(true)
    const res = await fetch("/api/settings/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: testTo.trim() }),
    })
    setTesting(false)
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      toast.error(data?.error ?? "No se pudo enviar la prueba")
      return
    }
    toast.success(`Email de prueba enviado a ${testTo.trim()}`)
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] sm:py-8">
      <header className="mb-6 flex items-center gap-3">
        <Link
          href="/dashboard"
          aria-label="Volver al dashboard"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 text-zinc-400 transition-colors hover:text-zinc-100"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100 sm:text-2xl">Administración</h1>
          <p className="text-sm text-zinc-400">Configuración de envío de recibos por email</p>
        </div>
      </header>

      {loading ? (
        <p className="py-10 text-center text-sm text-zinc-400">Cargando…</p>
      ) : (
        <div className="space-y-4">
          <section className="rounded-xl border border-white/5 bg-[#0c0c0e] p-5">
            <div className="mb-1 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold tracking-tight text-zinc-100">Servidor SMTP</h2>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  state.configured
                    ? "bg-emerald-500/10 text-emerald-300 ring-1 ring-inset ring-emerald-400/25"
                    : "bg-amber-500/10 text-amber-300 ring-1 ring-inset ring-amber-400/25"
                }`}
              >
                {state.configured ? "configurado" : "sin configurar"}
              </span>
            </div>
            <p className="mb-4 text-xs leading-relaxed text-zinc-400">
              Sirve cualquier cuenta SMTP. Tocá tu proveedor y se llena el servidor y el puerto:
            </p>
            <div className="mb-4 flex flex-wrap gap-2">
              {SMTP_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, host: preset.host, port: preset.port }))}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    draft.host === preset.host
                      ? "border-white/25 bg-white/10 text-zinc-100"
                      : "border-white/10 text-zinc-400 hover:border-white/20 hover:text-zinc-200"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400" htmlFor="smtp-host">
                  Servidor
                </label>
                <Input
                  id="smtp-host"
                  value={draft.host}
                  onChange={(e) => setDraft((d) => ({ ...d, host: e.target.value }))}
                  placeholder="smtp.gmail.com"
                  autoComplete="off"
                  className="border-white/10 bg-[#18181b]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400" htmlFor="smtp-port">
                  Puerto
                </label>
                <Input
                  id="smtp-port"
                  value={draft.port}
                  onChange={(e) => setDraft((d) => ({ ...d, port: e.target.value }))}
                  placeholder="587"
                  inputMode="numeric"
                  className="border-white/10 bg-[#18181b]"
                />
              </div>
            </div>
            <p className="mt-1 text-xs text-zinc-500">465 usa SSL; 587 usa STARTTLS.</p>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400" htmlFor="smtp-user">
                  Usuario
                </label>
                <Input
                  id="smtp-user"
                  value={draft.user}
                  onChange={(e) => setDraft((d) => ({ ...d, user: e.target.value }))}
                  placeholder="tucuenta@gmail.com"
                  autoComplete="off"
                  className="border-white/10 bg-[#18181b]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400" htmlFor="smtp-pass">
                  Contraseña{" "}
                  {state.hasPass && (
                    <span className="ml-1 text-emerald-300">· guardada ({state.passPreview})</span>
                  )}
                </label>
                <div className="relative">
                  <Input
                    id="smtp-pass"
                    type={showPass ? "text" : "password"}
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    placeholder={state.hasPass ? "Dejar vacío para mantener" : "••••••••"}
                    autoComplete="new-password"
                    className="border-white/10 bg-[#18181b] pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-zinc-500 hover:text-zinc-200"
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-3">
              <label className="mb-1.5 block text-xs font-medium text-zinc-400" htmlFor="receipt-from">
                Remitente (From)
              </label>
              <Input
                id="receipt-from"
                value={draft.from}
                onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
                placeholder='Tu Nombre <pagos@tudominio.com>'
                autoComplete="off"
                className="border-white/10 bg-[#18181b]"
              />
            </div>

            <p className="mt-3 rounded-lg bg-white/[0.03] px-3 py-2 text-xs leading-relaxed text-zinc-500">
              <span className="font-medium text-zinc-300">Gmail:</span> activá verificación en 2 pasos
              y generá una{" "}
              <a
                href="https://myaccount.google.com/apppasswords"
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-300 underline decoration-white/20 hover:decoration-white"
              >
                contraseña de aplicación
              </a>{" "}
              (la normal no sirve). Usuario: tu email completo.
              <br />
              <span className="font-medium text-zinc-300">Outlook / Microsoft 365:</span> servidor
              smtp.office365.com, puerto 587, usuario tu email completo. Si tenés verificación en dos
              pasos, también contraseña de aplicación. En cuentas de empresa el administrador puede
              tener el SMTP desactivado.
            </p>

            <Button size="sm" className="mt-4 gap-1.5" onClick={save} disabled={saving}>
              <Save className="h-3.5 w-3.5" /> {saving ? "Guardando..." : "Guardar configuración"}
            </Button>
          </section>

          <section className="rounded-xl border border-white/5 bg-[#0c0c0e] p-5">
            <h2 className="mb-1 text-sm font-semibold tracking-tight text-zinc-100">Probar el envío</h2>
            <p className="mb-3 text-xs text-zinc-400">
              Mandate un email de prueba para confirmar que el servidor y el remitente funcionan antes
              de emitir recibos reales.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                placeholder="tu@email.com"
                inputMode="email"
                autoComplete="off"
                className={`${fieldClass} h-10 flex-1`}
              />
              <Button
                variant="outline"
                className="gap-1.5"
                onClick={sendTest}
                disabled={testing || !testTo.trim()}
              >
                <Mail className="h-3.5 w-3.5" /> {testing ? "Enviando..." : "Enviar prueba"}
              </Button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

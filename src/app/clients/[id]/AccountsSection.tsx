"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { useRouter, useSearchParams } from "next/navigation"
import { Bell, Link2, Plus, Trash2, Unlink, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  networkColors,
  networkLabels,
  publishModeHints,
  publishModeLabels,
  socialNetworks,
  type PublishMode,
  type SocialNetwork,
} from "@/lib/social"

export interface ClientAccountRow {
  id: string
  network: string
  handle: string
  mode: string
  /** El usuario que reportó la red al conectar. Vacío = sin conectar. */
  externalName: string | null
  connectedAt: string | null
  tokenExpiresAt: string | null
}

/** Menos de esto y conviene reconectar antes de que se corte sola. */
const DIAS_AVISO_CADUCIDAD = 7

function diasParaCaducar(iso: string | null): number | null {
  if (!iso) return null
  const ms = new Date(iso).getTime() - Date.now()
  return Number.isNaN(ms) ? null : Math.floor(ms / 86_400_000)
}

interface Props {
  clientId: string
  accounts: ClientAccountRow[]
  onChange: (accounts: ClientAccountRow[]) => void
}

export function AccountsSection({ clientId, accounts, onChange }: Props) {
  const router = useRouter()
  const params = useSearchParams()
  const [adding, setAdding] = useState<SocialNetwork | null>(null)
  const [options, setOptions] = useState<Array<{ instagramId: string; username: string; pageName: string }>>([])

  /**
   * Qué cuenta está esperando que elijan, derivado de la URL en vez de copiado
   * a un estado aparte: el dato ya vive ahí, y duplicarlo obligaba a un
   * `setState` dentro del efecto que además dejaba las dos fuentes desfasadas
   * al recargar.
   */
  const choosing = params.get("conexion") === "elegir" ? params.get("cuenta") : null
  const cerrarSelector = () => {
    setOptions([])
    router.replace(`/clients/${clientId}`)
  }
  const [handle, setHandle] = useState("")
  const [saving, setSaving] = useState(false)

  // La vuelta de Meta llega por la URL. Se traduce a una frase y se limpia el
  // rastro, para que recargar no repita el mensaje.
  useEffect(() => {
    const estado = params.get("conexion")
    if (!estado) return

    // "elegir" se queda en la URL: es un estado de pantalla, no un aviso.
    if (estado === "elegir") return

    const detalle = params.get("detalle")
    if (estado === "lista") toast.success("Cuenta conectada. Ya puede publicar sola.")
    else if (estado === "sin-cuentas") {
      toast.error(
        "No apareció ninguna cuenta. Tiene que ser Instagram Business o Creator, vinculada a una página de Facebook que tú administres.",
        { duration: 9000 },
      )
    } else if (estado === "cancelada") toast.error(detalle ?? "Se canceló la conexión")
    else if (estado === "invalida") toast.error("El enlace de conexión venció. Prueba de nuevo.")
    else toast.error(detalle ? `No se pudo conectar: ${detalle}` : "No se pudo conectar")

    router.replace(`/clients/${clientId}`)
  }, [params, router, clientId])

  // Cuando la autorización devolvió varias cuentas, hay que elegir cuál es.
  useEffect(() => {
    if (!choosing) return
    let cancelado = false
    fetch(`/api/meta/accounts?accountId=${choosing}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelado) return
        if (Array.isArray(data)) setOptions(data)
        else toast.error(data?.error ?? "No se pudieron listar las cuentas")
      })
      .catch(() => !cancelado && toast.error("No se pudieron listar las cuentas"))
    return () => {
      cancelado = true
    }
  }, [choosing])

  const elegir = async (instagramId: string) => {
    const res = await fetch("/api/meta/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: choosing, instagramId }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? "No se pudo conectar")
      return
    }
    setOptions([])
    toast.success("Cuenta conectada.")
    router.replace(`/clients/${clientId}`)
    router.refresh()
  }

  const desconectar = async (account: ClientAccountRow) => {
    if (!confirm("¿Desconectar esta cuenta? Deja de poder publicar sola y vuelve a avisarte.")) return
    const res = await fetch(`/api/clients/${clientId}/accounts/${account.id}/disconnect`, {
      method: "POST",
    })
    if (!res.ok) {
      toast.error("No se pudo desconectar")
      return
    }
    onChange(
      accounts.map((a) =>
        a.id === account.id
          ? { ...a, externalName: null, connectedAt: null, tokenExpiresAt: null, mode: "ASSISTED" }
          : a,
      ),
    )
    toast.success("Desconectada. Vuelve a avisarte cuando toque publicar.")
  }

  const used = new Set(accounts.map((a) => a.network))
  const available = socialNetworks.filter((n) => !used.has(n))

  const add = async () => {
    if (!adding) return
    setSaving(true)
    const res = await fetch(`/api/clients/${clientId}/accounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ network: adding, handle }),
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? "No se pudo agregar la red")
      return
    }
    onChange([...accounts, (await res.json()) as ClientAccountRow])
    setAdding(null)
    setHandle("")
  }

  const remove = async (account: ClientAccountRow) => {
    const label = networkLabels[account.network as SocialNetwork] ?? account.network
    if (!confirm(`¿Quitar ${label} de este cliente? Las piezas que iban ahí se quedan sin esa red.`))
      return
    const res = await fetch(`/api/clients/${clientId}/accounts/${account.id}`, { method: "DELETE" })
    if (!res.ok) {
      toast.error("No se pudo quitar la red")
      return
    }
    onChange(accounts.filter((a) => a.id !== account.id))
  }

  return (
    <section className="mb-6 rounded-xl border border-white/5 bg-[#0c0c0e] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight text-zinc-200">Sus redes</h2>
        {accounts.length > 0 && available.length > 0 && !adding && (
          <button
            type="button"
            onClick={() => setAdding(available[0])}
            className="inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-xs text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500"
          >
            <Plus className="h-3.5 w-3.5" /> Agregar red
          </button>
        )}
      </div>

      {accounts.length === 0 && !adding ? (
        <div className="flex flex-col items-start gap-3 py-2">
          <p className="mt-2 max-w-md text-sm text-zinc-400">
            Dinos en qué redes publica este cliente. Después, cada pieza del mes solo elige entre
            estas —sin volver a escribirlas— y sabemos dónde tiene que salir.
          </p>
          <Button size="sm" onClick={() => setAdding(available[0] ?? "INSTAGRAM")}>
            Agregar la primera red
          </Button>
        </div>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {accounts.map((account) => {
            const network = account.network as SocialNetwork
            const mode = (account.mode as PublishMode) ?? "ASSISTED"
            return (
              <li
                key={account.id}
                className="flex items-center gap-3 rounded-lg border border-white/5 bg-[#0a0a0c] px-3 py-2.5"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: networkColors[network] ?? "#71717a" }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-zinc-200">
                    {networkLabels[network] ?? account.network}
                  </span>
                  {(account.externalName || account.handle) && (
                    <span className="block truncate text-xs text-zinc-500">
                      @{account.externalName || account.handle}
                    </span>
                  )}
                  {(() => {
                    // Los tokens de Meta duran ~60 días. Avisar antes evita que
                    // las publicaciones se corten un martes sin explicación.
                    const dias = diasParaCaducar(account.tokenExpiresAt)
                    if (dias === null || !account.connectedAt) return null
                    if (dias <= 0) {
                      return (
                        <span className="block text-xs text-amber-300">
                          La conexión caducó. Vuelve a conectarla.
                        </span>
                      )
                    }
                    if (dias <= DIAS_AVISO_CADUCIDAD) {
                      return (
                        <span className="block text-xs text-amber-300/80">
                          Caduca en {dias} {dias === 1 ? "día" : "días"}.
                        </span>
                      )
                    }
                    return null
                  })()}
                </span>
                {account.connectedAt ? (
                  <span
                    className="flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-300 ring-1 ring-inset ring-emerald-400/25"
                    title={`Conectada${account.externalName ? ` como @${account.externalName}` : ""}`}
                  >
                    <Zap className="h-3 w-3" aria-hidden />
                    Conectada
                  </span>
                ) : (
                  <span
                    className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] text-zinc-300"
                    title={publishModeHints[mode]}
                  >
                    <Bell className="h-3 w-3" aria-hidden />
                    {publishModeLabels[mode]}
                  </span>
                )}

                {/* Sólo Meta por ahora: las demás redes no tienen conexión. */}
                {(network === "INSTAGRAM" || network === "FACEBOOK") &&
                  (account.connectedAt ? (
                    <button
                      type="button"
                      onClick={() => desconectar(account)}
                      aria-label="Desconectar la cuenta"
                      title="Desconectar"
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white/5 hover:text-amber-300"
                    >
                      <Unlink className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <a
                      href={`/api/meta/connect?accountId=${account.id}`}
                      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs text-zinc-300 ring-1 ring-inset ring-white/15 transition-colors hover:text-white"
                    >
                      <Link2 className="h-3.5 w-3.5" /> Conectar
                    </a>
                  ))}
                <button
                  type="button"
                  onClick={() => remove(account)}
                  aria-label={`Quitar ${networkLabels[network] ?? account.network}`}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white/5 hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {adding && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={adding}
            onChange={(e) => setAdding(e.target.value as SocialNetwork)}
            aria-label="Qué red agregar"
            className="h-9 w-36 rounded-md border border-white/10 bg-[#18181b] px-3 text-sm text-zinc-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500"
          >
            {available.map((n) => (
              <option key={n} value={n}>
                {networkLabels[n]}
              </option>
            ))}
          </select>
          <div className="relative min-w-0 flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
              @
            </span>
            <Input
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") add()
                if (e.key === "Escape") setAdding(null)
              }}
              placeholder="usuario"
              autoFocus
              aria-label="Usuario en esa red"
              className="h-9 w-full border-white/10 bg-[#18181b] pl-7 text-zinc-100"
            />
          </div>
          <Button size="sm" onClick={add} disabled={saving}>
            {saving ? "Guardando..." : "Agregar"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-zinc-400 hover:text-zinc-100"
            onClick={() => setAdding(null)}
          >
            Cancelar
          </Button>
        </div>
      )}

      {available.length === 0 && !adding && accounts.length > 0 && (
        <p className="mt-3 text-xs text-zinc-500">Ya están todas las redes cargadas.</p>
      )}

      {choosing && (
        <div className="mt-4 rounded-lg border border-white/10 bg-[#0a0a0c] p-4">
          <p className="text-sm text-zinc-200">¿Cuál de estas es la cuenta de este cliente?</p>
          <p className="mt-1 text-xs text-zinc-500">
            La autorización dio acceso a varias, porque administras más de una página.
          </p>
          <ul className="mt-3 space-y-1.5">
            {options.length === 0 ? (
              <li className="text-xs text-zinc-500">Buscando cuentas…</li>
            ) : (
              options.map((o) => (
                <li key={o.instagramId}>
                  <button
                    type="button"
                    onClick={() => elegir(o.instagramId)}
                    className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-white/5"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-zinc-200">@{o.username}</span>
                      <span className="block truncate text-xs text-zinc-500">{o.pageName}</span>
                    </span>
                    <span className="shrink-0 text-xs text-zinc-400">Elegir</span>
                  </button>
                </li>
              ))
            )}
          </ul>
          <button
            type="button"
            onClick={cerrarSelector}
            className="mt-2 text-xs text-zinc-500 underline underline-offset-2 hover:text-zinc-300"
          >
            Cancelar
          </button>
        </div>
      )}

      {accounts.length > 0 && (
        <p className="mt-3 text-xs text-zinc-500">
          Las cuentas conectadas van a poder publicar solas. Las que no, te avisan a la hora y
          publicas tú de un toque — y eso no se puede evitar en cuentas personales, porque Instagram
          no permite publicar en ellas por ninguna vía.
        </p>
      )}
    </section>
  )
}

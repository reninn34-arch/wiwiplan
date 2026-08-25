"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Bell, Plus, Trash2 } from "lucide-react"
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
}

interface Props {
  clientId: string
  accounts: ClientAccountRow[]
  onChange: (accounts: ClientAccountRow[]) => void
}

export function AccountsSection({ clientId, accounts, onChange }: Props) {
  const [adding, setAdding] = useState<SocialNetwork | null>(null)
  const [handle, setHandle] = useState("")
  const [saving, setSaving] = useState(false)

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
                  {account.handle && (
                    <span className="block truncate text-xs text-zinc-500">@{account.handle}</span>
                  )}
                </span>
                <span
                  className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] text-zinc-300"
                  title={publishModeHints[mode]}
                >
                  <Bell className="h-3 w-3" aria-hidden />
                  {publishModeLabels[mode]}
                </span>
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

      {accounts.length > 0 && (
        <p className="mt-3 text-xs text-zinc-500">
          Por ahora todas avisan y publicas tú de un toque. Cuando el cliente pase su cuenta a
          Business o Creator vamos a poder conectarla para que salga sola.
        </p>
      )}
    </section>
  )
}

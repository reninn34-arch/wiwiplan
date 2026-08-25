"use client"

import { useState } from "react"
import { toast } from "sonner"
import { CalendarDays, Check, Move, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { dayKeyOf } from "@/lib/calendar"
import {
  describeSchedule,
  networkColors,
  networkLabels,
  publishModeLabels,
  type PublishMode,
  type SocialNetwork,
} from "@/lib/social"

export interface ScheduleAccount {
  id: string
  network: string
  handle: string
  mode: string
}

export interface SchedulePiece {
  id: string
  title: string
  dueDate: string | null
  publishTime: string
  targets: Array<{ accountId: string; publishedAt: string | null }>
}

interface Props {
  planningId: string
  piece: SchedulePiece
  accounts: ScheduleAccount[]
  onChange: (updates: { dueDate: string | null; publishTime: string; targets: SchedulePiece["targets"] }) => void
  onMove: () => void
  onClose: () => void
}

/** Horas típicas de publicación, para no pelear con el teclado en el celular. */
const QUICK_TIMES = ["08:00", "12:00", "18:00", "20:00"]

/**
 * Cuándo y dónde sale una pieza. Vive en el calendario porque es ahí donde uno
 * está pensando "esto sale el martes", y no escondido en un formulario aparte.
 */
export function SchedulePanel({ planningId, piece, accounts, onChange, onMove, onClose }: Props) {
  const [saving, setSaving] = useState(false)
  const selected = new Set(piece.targets.map((t) => t.accountId))
  const publishedBy = new Map(piece.targets.map((t) => [t.accountId, t.publishedAt]))

  const save = async (payload: { publishTime?: string; accountIds?: string[] }) => {
    setSaving(true)
    const res = await fetch(`/api/plannings/${planningId}/ideas/${piece.id}/schedule`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? "No se pudo guardar")
      return
    }
    const data = await res.json()
    onChange({ dueDate: data.dueDate, publishTime: data.publishTime, targets: data.targets })
  }

  const toggleAccount = (accountId: string) => {
    const next = new Set(selected)
    if (next.has(accountId)) next.delete(accountId)
    else next.add(accountId)
    save({ accountIds: [...next] })
  }

  const hasDay = Boolean(dayKeyOf(piece.dueDate))

  return (
    <div className="rounded-xl border border-white/10 bg-[#0c0c0e] p-4 shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-zinc-100">{piece.title || "Sin título"}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-400">
            <CalendarDays className="h-3 w-3 shrink-0" aria-hidden />
            {describeSchedule(piece.dueDate, piece.publishTime)}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* ── A qué hora ── */}
      <div className="mt-4">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
          ¿A qué hora?
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {QUICK_TIMES.map((time) => {
            const on = piece.publishTime === time
            return (
              <button
                key={time}
                type="button"
                disabled={saving}
                onClick={() => save({ publishTime: on ? "" : time })}
                className={`rounded-md px-2.5 py-1.5 text-xs transition-colors disabled:opacity-50 ${
                  on
                    ? "bg-brand text-white"
                    : "text-zinc-400 ring-1 ring-inset ring-white/10 hover:text-zinc-200"
                }`}
              >
                {time}
              </button>
            )
          })}
          <input
            type="time"
            value={piece.publishTime}
            onChange={(e) => save({ publishTime: e.target.value })}
            aria-label="Otra hora"
            className="h-9 rounded-md border border-white/10 bg-[#18181b] px-2 text-xs text-zinc-200 [color-scheme:dark] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500"
          />
        </div>
      </div>

      {/* ── En qué redes ── */}
      <div className="mt-4">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
          ¿Dónde sale?
        </p>
        {accounts.length === 0 ? (
          <p className="text-xs text-zinc-500">
            Este cliente todavía no tiene redes cargadas. Se agregan en su ficha, y después aparecen
            acá para elegir.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {accounts.map((account) => {
              const network = account.network as SocialNetwork
              const on = selected.has(account.id)
              const publishedAt = publishedBy.get(account.id)
              return (
                <button
                  key={account.id}
                  type="button"
                  disabled={saving}
                  onClick={() => toggleAccount(account.id)}
                  aria-pressed={on}
                  title={`${networkLabels[network] ?? account.network} — ${
                    publishModeLabels[(account.mode as PublishMode) ?? "ASSISTED"]
                  }`}
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs transition-colors disabled:opacity-50 ${
                    on
                      ? "bg-white/10 text-zinc-100 ring-1 ring-inset ring-white/25"
                      : "text-zinc-500 ring-1 ring-inset ring-white/10 hover:text-zinc-300"
                  }`}
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: on ? networkColors[network] ?? "#71717a" : "#3f3f46" }}
                    aria-hidden
                  />
                  {networkLabels[network] ?? account.network}
                  {publishedAt && <Check className="h-3 w-3 text-emerald-400" aria-hidden />}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {!hasDay && (
        <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-300 ring-1 ring-inset ring-amber-400/25">
          Todavía no tiene día. Arrástrala a uno del calendario, o usa el botón de abajo.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="h-9 text-xs" onClick={onMove}>
          <Move className="h-3.5 w-3.5" /> {hasDay ? "Mover de día" : "Ponerle día"}
        </Button>
      </div>
    </div>
  )
}

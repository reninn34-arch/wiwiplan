"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CalendarDays, Check, CircleCheck, Move, Send, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MediaUploader, type MediaAssetRow } from "@/components/MediaUploader"
import { dayKeyOf } from "@/lib/calendar"
import {
  describePublication,
  networkColors,
  networkLabels,
  joinWithY,
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
  media: MediaAssetRow[]
}

interface Props {
  planningId: string
  piece: SchedulePiece
  accounts: ScheduleAccount[]
  onChange: (updates: {
    dueDate?: string | null
    publishTime?: string
    targets?: SchedulePiece["targets"]
    media?: MediaAssetRow[]
  }) => void
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
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  // Confirmación visible después de guardar: sin esto uno toca, no pasa nada
  // aparente, y queda la duda de si se guardó.
  const [justSaved, setJustSaved] = useState(false)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (savedTimer.current) clearTimeout(savedTimer.current)
  }, [])

  const selected = new Set(piece.targets.map((t) => t.accountId))
  const publishedBy = new Map(piece.targets.map((t) => [t.accountId, t.publishedAt]))

  const accountName = (id: string) => {
    const account = accounts.find((a) => a.id === id)
    if (!account) return ""
    return networkLabels[account.network as SocialNetwork] ?? account.network
  }
  const chosenNetworks = piece.targets.map((t) => accountName(t.accountId)).filter(Boolean)
  const summary = describePublication(piece.dueDate, piece.publishTime, chosenNetworks)

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

    setJustSaved(true)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => setJustSaved(false), 2500)
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
          <p
            className={`mt-1 flex items-start gap-1.5 text-sm ${
              summary.ready ? "text-emerald-300" : "text-zinc-300"
            }`}
            aria-live="polite"
          >
            <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>{summary.sentence}</span>
          </p>
          {summary.missing.length > 0 && (
            <p className="mt-1 text-xs text-amber-300">
              Falta {joinWithY(summary.missing)}.
            </p>
          )}
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

      {/* ── Qué se publica ── */}
      <div className="mt-4">
        <MediaUploader
          ideaId={piece.id}
          media={piece.media}
          onChange={(media) => onChange({ media })}
        />
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

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" className="h-9 text-xs" onClick={onMove}>
          <Move className="h-3.5 w-3.5" /> {hasDay ? "Mover de día" : "Ponerle día"}
        </Button>
        {piece.targets.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="h-9 text-xs"
            onClick={() => router.push(`/publicar/${piece.id}`)}
          >
            <Send className="h-3.5 w-3.5" /> Publicar ahora
          </Button>
        )}
        <span
          className={`flex items-center gap-1.5 text-xs text-emerald-300 transition-opacity ${
            justSaved ? "opacity-100" : "opacity-0"
          }`}
          aria-live="polite"
        >
          <CircleCheck className="h-3.5 w-3.5" aria-hidden />
          Guardado
        </span>
      </div>
    </div>
  )
}

"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, CalendarClock, Check } from "lucide-react"
import { GlobalSearch } from "@/components/GlobalSearch"
import { NotificationBell } from "@/components/NotificationBell"
import { PushToggle } from "@/components/PushToggle"
import { buildAgenda, bucketHints, bucketLabels, isFullyPublished, type AgendaPiece } from "@/lib/agenda"
import { todayKey } from "@/lib/calendar"
import { formatTime, networkColors, networkLabels, type SocialNetwork } from "@/lib/social"

interface Props {
  pieces: AgendaPiece[]
}

const bucketTone: Record<string, string> = {
  LATE: "text-amber-300",
  TODAY: "text-zinc-100",
  TOMORROW: "text-zinc-100",
  WEEK: "text-zinc-300",
  LATER: "text-zinc-400",
  UNSCHEDULED: "text-zinc-400",
}

export function AgendaClient({ pieces }: Props) {
  const router = useRouter()
  const [showDone, setShowDone] = useState(false)

  const today = useMemo(() => todayKey(), [])
  const visible = useMemo(
    () => (showDone ? pieces : pieces.filter((p) => !isFullyPublished(p))),
    [pieces, showDone],
  )
  const groups = useMemo(() => buildAgenda(visible, today), [visible, today])
  const doneCount = pieces.length - pieces.filter((p) => !isFullyPublished(p)).length

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-300">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-white/5 bg-[#09090b]/95 px-3 pt-[env(safe-area-inset-top)] backdrop-blur sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-1 py-2 sm:gap-2">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            aria-label="Volver al workspace"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            <ArrowLeft size={18} />
          </button>
          <span className="truncate text-sm font-medium text-zinc-200">Agenda</span>
        </div>
        <div className="flex shrink-0 items-center gap-1 py-2 sm:gap-2">
          <GlobalSearch />
          <NotificationBell />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-[max(3rem,env(safe-area-inset-bottom))] pt-6 sm:px-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-100">Qué sale y cuándo</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Todas tus piezas programadas, de todos los clientes, en un solo lugar.
            </p>
          </div>
          {doneCount > 0 && (
            <button
              type="button"
              onClick={() => setShowDone((v) => !v)}
              className="rounded-md px-2.5 py-1.5 text-xs text-zinc-400 ring-1 ring-inset ring-white/10 transition-colors hover:text-zinc-200"
            >
              {showDone ? "Ocultar publicadas" : `Ver publicadas (${doneCount})`}
            </button>
          )}
        </div>

        <div className="mb-5">
          <PushToggle />
        </div>

        {groups.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 p-12 text-center">
            <CalendarClock className="mx-auto mb-3 h-6 w-6 text-zinc-600" />
            <p className="text-sm text-zinc-400">
              Todavía no hay nada programado. Entra al mes de un cliente, abre el Calendario y toca
              una pieza para decir cuándo y dónde sale.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <section key={group.bucket}>
                <div className="mb-2 flex flex-wrap items-baseline gap-x-2">
                  <h2 className={`text-sm font-semibold tracking-tight ${bucketTone[group.bucket]}`}>
                    {bucketLabels[group.bucket]}
                  </h2>
                  <span className="text-xs text-zinc-600">{group.pieces.length}</span>
                  {bucketHints[group.bucket] && (
                    <span className="text-xs text-zinc-600">— {bucketHints[group.bucket]}</span>
                  )}
                </div>
                <ul className="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/5 bg-[#0c0c0e]">
                  {group.pieces.map((piece) => {
                    const done = isFullyPublished(piece)
                    return (
                      <li key={piece.id}>
                        <button
                          type="button"
                          onClick={() => router.push(`/planning/${piece.planningId}?idea=${piece.id}`)}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.02]"
                        >
                          <span
                            className={`w-14 shrink-0 text-xs tabular-nums ${
                              piece.publishTime ? "text-zinc-300" : "text-zinc-600"
                            }`}
                          >
                            {piece.publishTime ? formatTime(piece.publishTime) : "sin hora"}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span
                              className={`block truncate text-sm ${
                                done ? "text-zinc-500 line-through" : "text-zinc-100"
                              }`}
                            >
                              {piece.title || "Sin título"}
                            </span>
                            <span className="block truncate text-xs text-zinc-500">
                              {piece.clientName}
                            </span>
                          </span>
                          <span className="flex shrink-0 items-center gap-1">
                            {piece.targets.length === 0 ? (
                              <span className="text-[11px] text-amber-300/80">sin redes</span>
                            ) : (
                              piece.targets.map((target) => (
                                <span
                                  key={target.accountId}
                                  title={`${
                                    networkLabels[target.network as SocialNetwork] ?? target.network
                                  }${target.publishedAt ? " — ya salió" : ""}`}
                                  className="flex h-5 w-5 items-center justify-center rounded-full"
                                  style={{
                                    backgroundColor: target.publishedAt
                                      ? "transparent"
                                      : `${networkColors[target.network as SocialNetwork] ?? "#52525b"}33`,
                                  }}
                                >
                                  {target.publishedAt ? (
                                    <Check className="h-3 w-3 text-emerald-400" aria-hidden />
                                  ) : (
                                    <span
                                      className="h-2 w-2 rounded-full"
                                      style={{
                                        backgroundColor:
                                          networkColors[target.network as SocialNetwork] ?? "#52525b",
                                      }}
                                      aria-hidden
                                    />
                                  )}
                                </span>
                              ))
                            )}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

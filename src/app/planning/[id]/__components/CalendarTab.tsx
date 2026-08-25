"use client"

import { useMemo, useState } from "react"
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  pointerWithin,
  type DragEndEvent,
} from "@dnd-kit/core"
import { toast } from "sonner"
import { CalendarDays, CircleAlert } from "lucide-react"
import {
  WEEKDAY_LABELS,
  buildMonthGrid,
  dayKeyOf,
  groupByDay,
  todayKey,
  type CalendarDay,
} from "@/lib/calendar"
import { formatPeriodLabel } from "@/lib/planning-period"
import { networkColors, type SocialNetwork } from "@/lib/social"
import { SchedulePanel, type ScheduleAccount } from "./SchedulePanel"

export interface CalendarIdea {
  id: string
  title: string
  status: string
  postType: string
  dueDate: string | null
  publishTime: string
  targets: Array<{ accountId: string; publishedAt: string | null }>
}

interface Props {
  planningId: string
  period: string
  ideas: CalendarIdea[]
  accounts: ScheduleAccount[]
  onChange: (ideas: CalendarIdea[]) => void
  onOpenIdea: (ideaId: string) => void
}

const UNSCHEDULED = "sin-fecha"

const statusDot: Record<string, string> = {
  IDEA: "bg-zinc-500",
  SELECTED: "bg-blue-400",
  IN_PRODUCTION: "bg-amber-400",
  DONE: "bg-emerald-400",
}

/** Ficha de una pieza. Se arrastra en escritorio y se toca en el celular. */
function IdeaChip({
  idea,
  networkColorsById,
  open,
  moving,
  onOpen,
}: {
  idea: CalendarIdea
  networkColorsById: Map<string, string>
  open: boolean
  moving: boolean
  onOpen: () => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: idea.id })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onOpen()
        }
      }}
      aria-label={`${idea.title}. Tócalo para ver cuándo y dónde sale.`}
      aria-pressed={open || moving}
      className={`w-full cursor-grab touch-none rounded-md px-1.5 py-1 text-left text-[11px] leading-tight transition-colors active:cursor-grabbing ${
        moving
          ? "bg-brand/30 text-white ring-1 ring-inset ring-brand"
          : open
            ? "bg-white/15 text-white ring-1 ring-inset ring-white/30"
            : "bg-white/[0.06] text-zinc-300 hover:bg-white/[0.1]"
      } ${isDragging ? "opacity-40" : ""}`}
    >
      <span className="flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDot[idea.status] ?? "bg-zinc-600"}`} aria-hidden />
        <span className="truncate">{idea.title || "Sin título"}</span>
      </span>
      {(idea.publishTime || idea.targets.length > 0) && (
        <span className="mt-0.5 flex items-center gap-1 pl-3">
          {idea.publishTime && (
            <span className="shrink-0 text-[10px] tabular-nums text-zinc-500">{idea.publishTime}</span>
          )}
          {idea.targets.map((target) => (
            <span
              key={target.accountId}
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: networkColorsById.get(target.accountId) ?? "#52525b" }}
              aria-hidden
            />
          ))}
        </span>
      )}
    </div>
  )
}

function DayCell({
  day,
  ideas,
  networkColorsById,
  openId,
  movingId,
  onDropDay,
  onOpen,
}: {
  day: CalendarDay
  ideas: CalendarIdea[]
  networkColorsById: Map<string, string>
  openId: string | null
  movingId: string | null
  onDropDay: (dayKey: string) => void
  onOpen: (ideaId: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: day.key })
  const clash = ideas.length > 1

  return (
    <div
      ref={setNodeRef}
      onClick={() => movingId && onDropDay(day.key)}
      className={`min-h-[5.5rem] border-b border-r border-white/5 p-1 transition-colors ${
        day.inPeriod ? "" : "bg-black/20"
      } ${isOver ? "bg-brand/15 ring-1 ring-inset ring-brand" : ""} ${
        movingId ? "cursor-copy hover:bg-white/[0.04]" : ""
      }`}
    >
      <div className="mb-1 flex items-center justify-between px-0.5">
        <span
          className={`text-[11px] tabular-nums ${
            day.isToday
              ? "flex h-5 w-5 items-center justify-center rounded-full bg-brand font-semibold text-white"
              : day.inPeriod
                ? "text-zinc-400"
                : "text-zinc-700"
          }`}
        >
          {day.dayOfMonth}
        </span>
        {clash && (
          <span
            className="flex items-center gap-0.5 text-[10px] text-amber-400"
            title={`${ideas.length} piezas el mismo día`}
          >
            <CircleAlert className="h-3 w-3" />
            {ideas.length}
          </span>
        )}
      </div>
      <div className="space-y-1">
        {ideas.map((idea) => (
          <IdeaChip
            key={idea.id}
            idea={idea}
            networkColorsById={networkColorsById}
            open={openId === idea.id}
            moving={movingId === idea.id}
            onOpen={() => onOpen(idea.id)}
          />
        ))}
      </div>
    </div>
  )
}

export function CalendarTab({ planningId, period, ideas, accounts, onChange, onOpenIdea }: Props) {
  /** La pieza cuyo panel está abierto. */
  const [openId, setOpenId] = useState<string | null>(null)
  /** La pieza esperando que toques un día. Sale del botón "Mover de día". */
  const [movingId, setMovingId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const today = useMemo(() => todayKey(), [])
  const grid = useMemo(() => buildMonthGrid(period, today), [period, today])
  const byDay = useMemo(() => groupByDay(ideas), [ideas])
  const unscheduled = useMemo(() => ideas.filter((i) => !dayKeyOf(i.dueDate)), [ideas])

  /** El color de cada red, buscado por id de cuenta, para pintar los puntitos. */
  const networkColorsById = useMemo(
    () =>
      new Map(
        accounts.map((a) => [a.id, networkColors[a.network as SocialNetwork] ?? "#52525b"]),
      ),
    [accounts],
  )

  const { setNodeRef: setTrayRef, isOver: trayIsOver } = useDroppable({ id: UNSCHEDULED })

  // Huecos: días del mes sin ninguna pieza. Es la mitad del valor de ver el mes.
  const gaps = useMemo(
    () => grid.flat().filter((d) => d.inPeriod && !byDay.has(d.key)).length,
    [grid, byDay],
  )
  const scheduled = ideas.length - unscheduled.length
  const openPiece = ideas.find((i) => i.id === openId) ?? null

  const moveIdea = async (ideaId: string, dayKey: string | null) => {
    const idea = ideas.find((i) => i.id === ideaId)
    if (!idea) return
    setMovingId(null)
    if (dayKeyOf(idea.dueDate) === (dayKey ?? "")) return

    const snapshot = ideas
    const dueDate = dayKey ? `${dayKey}T00:00:00.000Z` : null
    onChange(ideas.map((i) => (i.id === ideaId ? { ...i, dueDate } : i)))

    const res = await fetch(`/api/plannings/${planningId}/ideas/${ideaId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      // El día viaja como fecha pura: la publicación es un día del calendario,
      // no un instante, y así no se corre según la zona horaria.
      body: JSON.stringify({ dueDate: dayKey }),
    })
    if (!res.ok) {
      onChange(snapshot)
      toast.error("No se pudo mover la pieza")
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const over = event.over?.id
    if (!over) return
    moveIdea(String(event.active.id), over === UNSCHEDULED ? null : String(over))
  }

  if (grid.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 p-12 text-center">
        <CalendarDays className="mx-auto mb-3 h-6 w-6 text-zinc-600" />
        <p className="text-sm text-zinc-400">
          Este plan todavía no tiene un mes asignado. Ponle período en Información y el calendario
          aparece solo.
        </p>
      </div>
    )
  }

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragEnd={handleDragEnd}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h2 className="text-sm font-semibold tracking-tight text-zinc-200">
            {formatPeriodLabel(period)}
          </h2>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400">
            <span>{scheduled} con fecha</span>
            {unscheduled.length > 0 && <span>{unscheduled.length} sin fecha</span>}
            {gaps > 0 && (
              <span className="text-zinc-500">
                {gaps === 1 ? "1 día sin nada" : `${gaps} días sin nada`}
              </span>
            )}
          </div>
        </div>

        {movingId && (
          <p className="rounded-lg bg-brand/15 px-3 py-2 text-xs text-zinc-200 ring-1 ring-inset ring-brand/40">
            Toca el día al que la quieres mover, o el cajón de abajo para quitarle la fecha.
          </p>
        )}

        {openPiece && (
          <SchedulePanel
            planningId={planningId}
            piece={openPiece}
            accounts={accounts}
            onChange={(updates) =>
              onChange(ideas.map((i) => (i.id === openPiece.id ? { ...i, ...updates } : i)))
            }
            onMove={() => {
              setMovingId(openPiece.id)
              setOpenId(null)
            }}
            onClose={() => setOpenId(null)}
          />
        )}

        <div className="overflow-hidden rounded-xl border-l border-t border-white/5">
          <div className="grid grid-cols-7">
            {WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className="border-b border-r border-white/5 bg-white/[0.02] px-2 py-1.5 text-center text-[10px] font-medium uppercase tracking-wider text-zinc-500"
              >
                {label}
              </div>
            ))}
          </div>
          {grid.map((week, i) => (
            <div key={i} className="grid grid-cols-7">
              {week.map((day) => (
                <DayCell
                  key={day.key}
                  day={day}
                  ideas={byDay.get(day.key) ?? []}
                  networkColorsById={networkColorsById}
                  openId={openId}
                  movingId={movingId}
                  onDropDay={(dayKey) => movingId && moveIdea(movingId, dayKey)}
                  onOpen={setOpenId}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Cajón de las que todavía no tienen día. Soltar acá quita la fecha. */}
        <div
          ref={setTrayRef}
          onClick={() => movingId && moveIdea(movingId, null)}
          className={`rounded-xl border border-white/5 bg-[#0c0c0e] p-4 transition-colors ${
            trayIsOver ? "bg-brand/10 ring-1 ring-inset ring-brand" : ""
          } ${movingId ? "cursor-copy" : ""}`}
        >
          <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            Sin fecha ({unscheduled.length})
          </h3>
          {unscheduled.length === 0 ? (
            <p className="py-2 text-xs text-zinc-500">
              Todas las piezas del mes tienen día asignado.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {unscheduled.map((idea) => (
                <div key={idea.id} className="max-w-[14rem]">
                  <IdeaChip
                    idea={idea}
                    networkColorsById={networkColorsById}
                    open={openId === idea.id}
                    moving={movingId === idea.id}
                    onOpen={() => setOpenId(idea.id)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-xs text-zinc-500">
          Toca una pieza para decir cuándo y dónde sale. Para cambiarla de día, arrástrala — o usa
          &laquo;Mover de día&raquo; y toca el día nuevo.{" "}
          <button
            type="button"
            onClick={() => openPiece && onOpenIdea(openPiece.id)}
            disabled={!openPiece}
            className="text-zinc-400 underline underline-offset-2 transition-colors hover:text-zinc-200 disabled:cursor-not-allowed disabled:no-underline disabled:opacity-50"
          >
            Abrir en Contenido
          </button>
        </p>
      </div>
    </DndContext>
  )
}

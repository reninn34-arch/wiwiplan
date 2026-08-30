"use client"

import { useMemo, useState } from "react"
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  pointerWithin,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { toast } from "sonner"
import { CalendarDays, CircleAlert, Paperclip } from "lucide-react"
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
import type { MediaAssetRow } from "@/components/MediaUploader"

export interface CalendarIdea {
  id: string
  title: string
  status: string
  postType: string
  dueDate: string | null
  publishTime: string
  targets: Array<{ accountId: string; publishedAt: string | null }>
  media: MediaAssetRow[]
  clientReview: string
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

/** Cuántos puntos caben en una casilla del celular antes de resumir con "+N". */
const MAX_PUNTOS = 3

const statusDot: Record<string, string> = {
  IDEA: "bg-zinc-500",
  SELECTED: "bg-blue-400",
  IN_PRODUCTION: "bg-amber-400",
  DONE: "bg-emerald-400",
}

function estaPublicada(idea: CalendarIdea): boolean {
  return idea.targets.length > 0 && idea.targets.every((t) => t.publishedAt !== null)
}

/** El contenido de una ficha, sin nada de arrastre. Lo comparten la ficha real
 *  y la copia que sigue al dedo mientras se arrastra. */
function ChipInterior({
  idea,
  networkColorsById,
}: {
  idea: CalendarIdea
  networkColorsById: Map<string, string>
}) {
  const published = estaPublicada(idea)
  return (
    <>
      <span className="flex items-center gap-1.5">
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDot[idea.status] ?? "bg-zinc-600"}`}
          aria-hidden
        />
        <span className={`truncate ${published ? "text-zinc-500 line-through" : ""}`}>
          {idea.title || "Sin título"}
        </span>
      </span>
      {(idea.publishTime || idea.targets.length > 0 || idea.media.length > 0) && (
        <span className="mt-0.5 flex items-center gap-1 pl-3">
          {idea.publishTime && (
            <span className="shrink-0 text-[10px] tabular-nums text-zinc-500">
              {idea.publishTime}
            </span>
          )}
          {idea.media.length > 0 && (
            <Paperclip className="h-2.5 w-2.5 shrink-0 text-zinc-500" aria-hidden />
          )}
          {idea.targets.map((target) => (
            <span
              key={target.accountId}
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{
                backgroundColor: target.publishedAt
                  ? "#34d399"
                  : networkColorsById.get(target.accountId) ?? "#52525b",
              }}
              aria-hidden
            />
          ))}
        </span>
      )}
    </>
  )
}

/** Ficha de una pieza. Se arrastra con el ratón, o dejando el dedo apoyado. */
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
      // `touch-manipulation` en el celular y `touch-none` sólo de tablet para
      // arriba: con `touch-none` en todas partes, apoyar el dedo en una ficha
      // impedía desplazar la página, y en un mes lleno casi todo es ficha.
      // El arrastre táctil no lo necesita porque se activa manteniendo pulsado.
      className={`w-full cursor-grab touch-manipulation rounded-md px-1.5 py-1 text-left text-[11px] leading-tight transition-colors active:cursor-grabbing sm:touch-none ${
        moving
          ? "bg-brand/30 text-white ring-1 ring-inset ring-brand"
          : open
            ? "bg-white/15 text-white ring-1 ring-inset ring-white/30"
            : "bg-white/[0.06] text-zinc-300 hover:bg-white/[0.1]"
      } ${isDragging ? "opacity-40" : ""}`}
    >
      <ChipInterior idea={idea} networkColorsById={networkColorsById} />
    </div>
  )
}

function DayCell({
  day,
  ideas,
  networkColorsById,
  openId,
  movingId,
  selected,
  onSelect,
  onDropDay,
  onOpen,
}: {
  day: CalendarDay
  ideas: CalendarIdea[]
  networkColorsById: Map<string, string>
  openId: string | null
  movingId: string | null
  selected: boolean
  onSelect: () => void
  onDropDay: (dayKey: string) => void
  onOpen: (ideaId: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: day.key })
  const clash = ideas.length > 1

  return (
    <div
      ref={setNodeRef}
      onClick={() => (movingId ? onDropDay(day.key) : onSelect())}
      // En el celular la casilla mide 49px de ancho: no cabe texto, así que
      // sólo lleva el número y un punto por pieza, y se toca para ver el día
      // entero debajo. Las fichas con título aparecen de tablet para arriba.
      className={`min-h-[3.5rem] cursor-pointer border-b border-r border-white/5 p-1 transition-colors sm:min-h-[5.5rem] ${
        day.inPeriod ? "" : "bg-black/20"
      } ${isOver ? "bg-brand/15 ring-1 ring-inset ring-brand" : ""} ${
        selected ? "bg-white/[0.07] ring-1 ring-inset ring-white/25" : ""
      } ${movingId ? "cursor-copy ring-1 ring-inset ring-brand/25 hover:bg-white/[0.04]" : ""}`}
    >
      <div className="mb-1 flex items-center justify-between px-0.5">
        <span
          className={`text-xs tabular-nums sm:text-[11px] ${
            day.isToday
              ? "flex h-6 w-6 items-center justify-center rounded-full bg-brand font-semibold text-white sm:h-5 sm:w-5"
              : day.inPeriod
                ? "text-zinc-300 sm:text-zinc-400"
                : "text-zinc-700"
          }`}
        >
          {day.dayOfMonth}
        </span>
        {clash && (
          <span
            className="hidden items-center gap-0.5 text-[10px] text-amber-400 sm:flex"
            title={`${ideas.length} piezas el mismo día`}
          >
            <CircleAlert className="h-3 w-3" />
            {ideas.length}
          </span>
        )}
      </div>

      {/* Celular: un punto por pieza. */}
      <div className="flex flex-wrap items-center gap-1 px-0.5 sm:hidden">
        {ideas.slice(0, MAX_PUNTOS).map((idea) => (
          <span
            key={idea.id}
            className={`h-2 w-2 rounded-full ${
              estaPublicada(idea) ? "bg-emerald-400" : statusDot[idea.status] ?? "bg-zinc-600"
            }`}
            aria-hidden
          />
        ))}
        {ideas.length > MAX_PUNTOS && (
          <span className="text-[9px] leading-none text-zinc-500">
            +{ideas.length - MAX_PUNTOS}
          </span>
        )}
      </div>

      {/* Tablet para arriba: las fichas completas, con título y hora. */}
      <div className="hidden space-y-1 sm:block">
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
  /** El día tocado en el celular, cuyas piezas se listan debajo del mes. */
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  /** La pieza que se está arrastrando, para dibujar la copia que sigue al dedo. */
  const [dragId, setDragId] = useState<string | null>(null)

  // Dos sensores en vez de uno, y no es un detalle: con `PointerSensor` un
  // deslizamiento de 6px con el dedo arrancaba un arrastre en lugar de un
  // toque, así que abrir una pieza en el celular fallaba la mitad de las veces.
  // El ratón sigue arrastrando al instante; el dedo tiene que mantenerse.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
  )

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
  const dragPiece = ideas.find((i) => i.id === dragId) ?? null
  const piezasDelDia = selectedDay ? byDay.get(selectedDay) ?? [] : []

  const moveIdea = async (ideaId: string, dayKey: string | null) => {
    const idea = ideas.find((i) => i.id === ideaId)
    if (!idea) return
    setMovingId(null)
    if (dayKeyOf(idea.dueDate) === (dayKey ?? "")) return

    const snapshot = ideas
    const dueDate = dayKey ? `${dayKey}T00:00:00.000Z` : null
    onChange(ideas.map((i) => (i.id === ideaId ? { ...i, dueDate } : i)))
    // Se sigue a la pieza: tras moverla, el día que se muestra debajo es aquel
    // al que fue. Quedarse en el anterior obligaba a buscarla otra vez.
    if (dayKey) setSelectedDay(dayKey)

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
    setDragId(null)
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
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={(e: DragStartEvent) => setDragId(String(e.active.id))}
      onDragCancel={() => setDragId(null)}
      onDragEnd={handleDragEnd}
    >
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
              // Sólo se pisan las claves que vinieron: guardar la hora no puede
              // borrar los archivos, ni subir un archivo borrar las redes.
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
                className="border-b border-r border-white/5 bg-white/[0.02] px-1 py-1.5 text-center text-[10px] font-medium uppercase tracking-wider text-zinc-500 sm:px-2"
              >
                {/* Dos letras y no una: con la inicial sola, martes y miércoles
                    eran las dos "M" y no había forma de distinguir la columna. */}
                <span className="sm:hidden">{label.slice(0, 2)}</span>
                <span className="hidden sm:inline">{label}</span>
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
                  selected={selectedDay === day.key}
                  onSelect={() => setSelectedDay(day.key === selectedDay ? null : day.key)}
                  onDropDay={(dayKey) => movingId && moveIdea(movingId, dayKey)}
                  onOpen={setOpenId}
                />
              ))}
            </div>
          ))}
        </div>

        {/* El día tocado, a lo ancho. Es lo que hace legible el mes en el
            celular: la casilla sólo puede decir "acá hay algo", y el detalle
            necesita el ancho entero de la pantalla. */}
        {selectedDay && (
          <div className="rounded-xl border border-white/5 bg-[#0c0c0e] p-3 sm:hidden">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-medium text-zinc-300">
                {new Date(`${selectedDay}T12:00:00Z`).toLocaleDateString("es-EC", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedDay(null)}
                className="text-xs text-zinc-500 transition-colors hover:text-zinc-300"
              >
                Cerrar
              </button>
            </div>
            {piezasDelDia.length === 0 ? (
              <p className="py-1 text-xs text-zinc-500">
                Nada este día. Abre una pieza y usa &laquo;Mover de día&raquo; para traerla acá.
              </p>
            ) : (
              <div className="space-y-1.5">
                {piezasDelDia.map((idea) => (
                  <button
                    key={idea.id}
                    type="button"
                    onClick={() => setOpenId(idea.id)}
                    className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors ${
                      openId === idea.id
                        ? "bg-white/15 ring-1 ring-inset ring-white/30"
                        : "bg-white/[0.06] hover:bg-white/[0.1]"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        statusDot[idea.status] ?? "bg-zinc-600"
                      }`}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate text-sm ${
                          estaPublicada(idea) ? "text-zinc-500 line-through" : "text-zinc-200"
                        }`}
                      >
                        {idea.title || "Sin título"}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5">
                        {idea.publishTime && (
                          <span className="text-[11px] tabular-nums text-zinc-500">
                            {idea.publishTime}
                          </span>
                        )}
                        {idea.media.length > 0 && (
                          <Paperclip className="h-3 w-3 text-zinc-500" aria-hidden />
                        )}
                        {idea.targets.map((t) => (
                          <span
                            key={t.accountId}
                            className="h-1.5 w-1.5 rounded-full"
                            style={{
                              backgroundColor: t.publishedAt
                                ? "#34d399"
                                : networkColorsById.get(t.accountId) ?? "#52525b",
                            }}
                            aria-hidden
                          />
                        ))}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Cajón de las que todavía no tienen día. Soltar acá quita la fecha. */}
        <div
          ref={setTrayRef}
          onClick={() => movingId && moveIdea(movingId, null)}
          className={`rounded-xl border border-white/5 bg-[#0c0c0e] p-4 transition-colors ${
            trayIsOver ? "bg-brand/10 ring-1 ring-inset ring-brand" : ""
          } ${movingId ? "cursor-copy ring-1 ring-inset ring-brand/25" : ""}`}
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
                <div key={idea.id} className="w-full sm:max-w-[14rem]">
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
          <span className="sm:hidden">
            Toca un día para ver lo que sale ese día, y una pieza para decir cuándo y dónde. Para
            cambiarla de día, mantén el dedo sobre ella y arrástrala — o usa &laquo;Mover de
            día&raquo; y toca el día nuevo.{" "}
          </span>
          <span className="hidden sm:inline">
            Toca una pieza para decir cuándo y dónde sale. Para cambiarla de día, arrástrala — o usa
            &laquo;Mover de día&raquo; y toca el día nuevo.{" "}
          </span>
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

      {/* La copia que sigue al puntero. Sin esto, en el celular no se veía nada
          moverse: el original se atenuaba y ya, así que el arrastre parecía
          roto aunque estuviera funcionando. */}
      <DragOverlay dropAnimation={null}>
        {dragPiece && (
          <div className="max-w-[14rem] rounded-md bg-brand/80 px-1.5 py-1 text-[11px] leading-tight text-white shadow-lg ring-1 ring-inset ring-white/30">
            <ChipInterior idea={dragPiece} networkColorsById={networkColorsById} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

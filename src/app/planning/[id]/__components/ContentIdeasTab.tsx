"use client"

import {
  useState, useMemo, useRef, useCallback, useEffect, useSyncExternalStore,
  type ComponentProps, type CSSProperties, type MouseEvent, type ReactNode,
} from "react"
import { formatDayLabel, formatDayShort, dayKeyOf } from "@/lib/calendar"
import {
  Plus, Trash2, ExternalLink, GripVertical, X, Search, Table2, MessageSquare,
  ArrowUp, ArrowDown, LayoutGrid, CheckCircle2, Circle, ChevronDown, MoreHorizontal, Pencil,
  MonitorPlay, Smartphone, Hash, SlidersHorizontal, Globe, Camera, ChevronRight, Layout, Images,
  Copy, ListPlus, CornerDownLeft, FilterX,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { detectEmbed, platformLabel, postTypeLabel } from "@/lib/embeds"
import {
  DndContext, DragOverlay, closestCenter, pointerWithin, MouseSensor, TouchSensor, useSensor, useSensors,
  useDraggable, useDroppable,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core"
import {
  SortableContext, verticalListSortingStrategy, useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { toast } from "sonner"
import { IDEA_STATUS_FLOW, foldText, ideaStatusLabels, nextIdeaStatus, splitPastedIdeas } from "@/lib/ideas"
import { SwipeableRow } from "@/components/SwipeableRow"
import { normalizeIdea, type Idea } from "./idea-types"
import {
  IdeaEditorPanel, fieldClass, handleImagePaste, pillarOpts, platformOpts, postTypeOpts, priorityLabels, priorityOpts,
} from "./IdeaEditorPanel"

const statusOpts = [...IDEA_STATUS_FLOW] as string[]

// Los <select> necesitan fondo sólido: con bg-transparent el desplegable nativo
// se pinta blanco y el texto claro queda ilegible.
const filterSelectClass =
  "h-9 shrink-0 rounded-lg border border-dashed border-white/10 bg-[#18181b] px-2.5 text-sm font-medium text-zinc-300 transition-colors hover:border-white/20 focus:outline-none focus:ring-1 focus:ring-zinc-500"
const filterSelectActiveClass =
  "h-9 shrink-0 rounded-lg border border-white/25 bg-white/10 px-2.5 text-sm font-medium text-zinc-100 transition-colors focus:outline-none focus:ring-1 focus:ring-zinc-500"
const toolSelectClass =
  "h-9 shrink-0 rounded-lg border border-white/10 bg-[#18181b] px-2.5 text-sm font-medium text-zinc-300 transition-colors hover:border-white/20 focus:outline-none focus:ring-1 focus:ring-zinc-500"
const toolButtonClass =
  "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-white/10 bg-[#18181b] px-2.5 text-sm font-medium text-zinc-300 transition-colors hover:border-white/20 hover:text-white data-[state=open]:border-white/25"

/**
 * Columnas opcionales de la tabla. Tema, el asa y las acciones van siempre.
 * Antes el menú "Ver" marcaba y desmarcaba casillas sin mover ninguna columna.
 */
const COLUMNS = [
  { key: "status", label: "Estado", width: "152px", sort: "status" },
  { key: "postType", label: "Formato", width: "128px", sort: "postType" },
  { key: "dueDate", label: "Entrega", width: "128px", sort: "dueDate" },
  { key: "reference", label: "Referencia", width: "112px", sort: null },
  { key: "pilar", label: "Pilar", width: "132px", sort: "pilar" },
  { key: "priority", label: "Prioridad", width: "108px", sort: "priority" },
] as const
type ColumnKey = (typeof COLUMNS)[number]["key"]
const DEFAULT_COLS: ColumnKey[] = ["status", "postType", "dueDate", "reference", "pilar", "priority"]
const COLS_KEY = "wiwiplan-columnas"
const VIEW_KEY = "wiwiplan-vista-ideas"

type SortKey = "order" | "title" | "status" | "postType" | "dueDate" | "pilar" | "priority"

/** Cuánto dura el "Deshacer" antes de borrar de verdad. */
const UNDO_MS = 5000

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "IDEA": return <Circle size={14} className="text-zinc-500" strokeWidth={2.5} />
    case "SELECTED": return <Circle size={14} className="text-amber-400 fill-amber-400/20" strokeWidth={2.5} />
    case "IN_PRODUCTION": return <Circle size={14} className="text-blue-400 fill-blue-400/20" strokeWidth={2.5} />
    case "DONE": return <CheckCircle2 size={14} className="text-emerald-500" strokeWidth={2.5} />
    default: return <Circle size={14} className="text-zinc-500" />
  }
}

function PriorityIcon({ priority }: { priority: string }) {
  if (priority === "HIGH") return <ArrowUp size={14} className="text-rose-400" />
  if (priority === "MEDIUM") return <ChevronRight size={14} className="text-amber-400" />
  return <ChevronRight size={14} className="text-zinc-500 rotate-45" />
}

function PlatformIcon({ platform }: { platform: string }) {
  if (platform === "INSTAGRAM") return <Camera size={14} className="text-pink-500" />
  if (platform === "TIKTOK") return <Smartphone size={14} className="text-cyan-400" />
  if (platform === "YOUTUBE") return <MonitorPlay size={14} className="text-red-500" />
  if (platform === "VIMEO") return <MonitorPlay size={14} className="text-blue-400" />
  return <Globe size={14} className="text-zinc-500" />
}

/** Etiqueta legible del encabezado de grupo (los datos guardan IDEA, HIGH, etc.). */
function groupLabel(groupBy: string, key: string) {
  if (groupBy === "status") return ideaStatusLabels[key] ?? key
  if (groupBy === "priority") return priorityLabels[key] ?? key
  if (groupBy === "postType") return postTypeLabel(key)
  return key
}

const statusChipStyles: Record<string, string> = {
  IDEA: "bg-white/5 text-zinc-300 ring-white/10",
  SELECTED: "bg-amber-500/10 text-amber-300 ring-amber-400/25",
  IN_PRODUCTION: "bg-blue-500/10 text-blue-300 ring-blue-400/25",
  DONE: "bg-emerald-500/10 text-emerald-300 ring-emerald-400/25",
}

/** Fondo del gesto "avanzar": el color del estado al que pasa. */
const advanceSwipeStyles: Record<string, string> = {
  SELECTED: "bg-amber-600",
  IN_PRODUCTION: "bg-blue-600",
  DONE: "bg-emerald-600",
}

const priorityChipStyles: Record<string, string> = {
  HIGH: "bg-rose-500/10 text-rose-300 ring-rose-400/25",
  MEDIUM: "bg-amber-500/10 text-amber-300 ring-amber-400/25",
  LOW: "bg-white/5 text-zinc-300 ring-white/10",
}

/**
 * Chip de estado con menú. Reemplaza a los <select> transparentes (ilegibles al
 * desplegarse) y a los mini-botones del kanban, que eran imposibles de tocar en móvil.
 */
function StatusMenu({ status, onChange, className }: {
  status: string
  onChange: (status: string) => void
  className?: string
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          aria-label={`Estado: ${ideaStatusLabels[status] ?? status}. Toca para cambiar`}
          className={`inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-lg px-2 text-xs font-medium ring-1 ring-inset transition-colors hover:brightness-125 ${statusChipStyles[status] ?? statusChipStyles.IDEA} ${className ?? ""}`}
        >
          <StatusIcon status={status} />
          <span className="truncate">{ideaStatusLabels[status] ?? status}</span>
          <ChevronDown size={12} className="shrink-0 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Estado</DropdownMenuLabel>
        {statusOpts.map((s) => (
          <DropdownMenuCheckItem key={s} selected={s === status} onSelect={() => onChange(s)}>
            <StatusIcon status={s} />
            {ideaStatusLabels[s]}
          </DropdownMenuCheckItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function PriorityMenu({ priority, onChange, className }: {
  priority: string
  onChange: (priority: string) => void
  className?: string
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          aria-label={`Prioridad: ${priorityLabels[priority] ?? priority}. Toca para cambiar`}
          className={`inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-lg px-2 text-xs font-medium ring-1 ring-inset transition-colors hover:brightness-125 ${priorityChipStyles[priority] ?? priorityChipStyles.LOW} ${className ?? ""}`}
        >
          <PriorityIcon priority={priority} />
          <span className="truncate">{priorityLabels[priority] ?? priority}</span>
          <ChevronDown size={12} className="shrink-0 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Prioridad</DropdownMenuLabel>
        {priorityOpts.map((p) => (
          <DropdownMenuCheckItem key={p} selected={p === priority} onSelect={() => onChange(p)}>
            <PriorityIcon priority={p} />
            {priorityLabels[p]}
          </DropdownMenuCheckItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * El pilar como chip con menú: los habituales más los que ya se usan este mes.
 * Uno nuevo se escribe en el editor de la pieza.
 */
function PilarMenu({ pilar, options, onChange }: {
  pilar: string
  options: string[]
  onChange: (pilar: string) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          aria-label={`Pilar: ${pilar || "sin pilar"}. Toca para cambiar`}
          className="inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-md border border-white/5 bg-zinc-800/50 px-2 text-xs font-medium text-zinc-400 transition-colors hover:border-white/15 hover:text-zinc-200"
        >
          <Hash size={10} className="shrink-0 text-zinc-500" />
          <span className="truncate">{pilar || "—"}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
        <DropdownMenuLabel>Pilar</DropdownMenuLabel>
        {options.map((p) => (
          <DropdownMenuCheckItem key={p} selected={p === pilar} onSelect={() => onChange(p)}>
            {p}
          </DropdownMenuCheckItem>
        ))}
        {pilar && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onChange("")}>Quitar pilar</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Menú de tres puntos de cada idea. */
function IdeaActionsMenu({ onEdit, onDuplicate, onDelete, className }: {
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
  className?: string
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          aria-label="Más acciones"
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-white/10 hover:text-white data-[state=open]:bg-white/10 data-[state=open]:text-white ${className ?? ""}`}
        >
          <MoreHorizontal size={16} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil size={15} /> Editar
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onDuplicate}>
          <Copy size={15} /> Duplicar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={onDelete}>
          <Trash2 size={15} /> Eliminar idea
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** La referencia de una pieza en una línea: el link, la imagen pegada o su storyboard. */
function ReferenceCell({ idea, storyboards, compact }: {
  idea: Idea
  storyboards: Array<{ id: string; title: string }>
  compact?: boolean
}) {
  const thumb = compact ? "w-4 h-4" : "w-6 h-6"
  if (idea.referenceUrl) {
    return (
      <a
        href={idea.referenceUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="inline-flex max-w-full items-center gap-1 truncate text-[11px] text-zinc-400 hover:text-white"
        title={idea.referenceUrl}
      >
        {idea.referenceEmbed && idea.platform === "IMAGE" ? (
          <img src={idea.referenceEmbed} alt="" className={`${thumb} shrink-0 rounded object-cover`} />
        ) : (
          <ExternalLink size={11} className="shrink-0" />
        )}
        <span className="truncate">
          {idea.referenceEmbed ? platformLabel(idea.platform) : idea.referenceUrl.replace(/^https?:\/\/(www\.)?/, "")}
        </span>
      </a>
    )
  }
  if (idea.referenceEmbed) {
    return (
      <span className="inline-flex max-w-full items-center gap-1 truncate text-[11px] text-zinc-400">
        {idea.platform === "IMAGE" ? (
          <img src={idea.referenceEmbed} alt="" className={`${thumb} shrink-0 rounded object-cover`} />
        ) : (
          <ExternalLink size={11} className="shrink-0" />
        )}
        {platformLabel(idea.platform)}
      </span>
    )
  }
  if (idea.storyboardId) {
    return (
      <span className="inline-flex max-w-full items-center gap-1 truncate text-[11px] text-zinc-400">
        <Layout size={11} className="shrink-0" />
        {storyboards.find((s) => s.id === idea.storyboardId)?.title ?? "Storyboard"}
      </span>
    )
  }
  return <span className="text-[11px] text-zinc-700">—</span>
}

function TagChips({ idea }: { idea: Idea }) {
  if (idea.contentIdeaTags.length === 0) return null
  return (
    <span className="flex flex-wrap gap-1">
      {idea.contentIdeaTags.map((ct) => (
        <span key={ct.tag.id} className="rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none text-white" style={{ backgroundColor: ct.tag.color }}>
          {ct.tag.name}
        </span>
      ))}
    </span>
  )
}

/**
 * ¿El clic ocurrió dentro de la fila en el DOM? Los menús se dibujan en un
 * portal, pero sus eventos igual suben por el árbol de React hasta la fila:
 * sin esto, elegir "Alta" en el menú de prioridad abría además el editor.
 */
function clickedInside(e: MouseEvent<HTMLElement>) {
  return e.currentTarget.contains(e.target as Node)
}

/** Fecha en la tabla: se cambia ahí mismo, sin abrir la pieza. */
function DueDateInput({ idea, onChange }: { idea: Idea; onChange: (day: string) => void }) {
  return (
    <input
      type="date"
      aria-label={`Fecha de entrega de ${idea.title}`}
      value={dayKeyOf(idea.dueDate)}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.value)}
      // Sin fecha se ve sólo el icono del calendario: el "dd/mm/aaaa" vacío en
      // cada fila era ruido. Aparece al pasar por encima o al tocarlo.
      className={`h-8 w-full rounded-md border border-transparent bg-transparent px-1.5 text-xs tabular-nums transition-colors hover:border-white/10 focus:border-white/20 focus:outline-none ${
        idea.dueDate ? "text-zinc-300" : "text-transparent hover:text-zinc-500 focus:text-zinc-300"
      }`}
    />
  )
}

interface RowHandlers {
  onOpen: (idea: Idea, section?: "comments") => void
  onStatus: (idea: Idea, status: string) => void
  onUpdate: (ideaId: string, data: Partial<Idea>) => void
  onDuplicate: (idea: Idea) => void
  onDelete: (idea: Idea) => void
}

/** Una fila de la tabla. El asa de arrastre viene de afuera, cuando se puede reordenar. */
function IdeaRow({ idea, cols, gridTemplate, handle, highlighted, pillars, storyboards, h, rowRef, style, dragging }: {
  idea: Idea
  cols: Set<ColumnKey>
  gridTemplate: string
  handle: Record<string, unknown> | null
  highlighted: boolean
  pillars: string[]
  storyboards: Array<{ id: string; title: string }>
  h: RowHandlers
  rowRef?: (node: HTMLElement | null) => void
  style?: CSSProperties
  dragging?: boolean
}) {
  return (
    <div
      ref={rowRef}
      style={{ ...style, gridTemplateColumns: gridTemplate }}
      data-idea-id={idea.id}
      onClick={(e) => clickedInside(e) && h.onOpen(idea)}
      className={`group grid cursor-pointer items-center gap-3 border-b border-white/5 px-3 py-2.5 transition-colors last:border-0 hover:bg-white/[0.02] ${
        highlighted ? "bg-white/[0.06] ring-1 ring-inset ring-white/25" : ""
      } ${dragging ? "opacity-40" : ""}`}
    >
      {handle ? (
        <div
          className="flex h-8 cursor-grab items-center justify-center text-zinc-500 opacity-0 transition-opacity hover:text-zinc-300 group-hover:opacity-100"
          onClick={(e) => e.stopPropagation()}
          aria-label="Arrastrar para reordenar"
          suppressHydrationWarning
          {...handle}
        >
          <GripVertical size={14} />
        </div>
      ) : (
        <div />
      )}

      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-zinc-100 group-hover:text-white">{idea.title || "Sin título"}</p>
        {idea.description && <p className="mt-0.5 truncate text-xs text-zinc-400">{idea.description}</p>}
        {(idea.contentIdeaTags.length > 0 || idea.images.length > 0 || idea.caption) && (
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <TagChips idea={idea} />
            {idea.images.length > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500">
                <Images size={10} /> {idea.images.length}
              </span>
            )}
            {idea.caption && <span className="text-[10px] text-zinc-500">con copy</span>}
          </div>
        )}
      </div>

      {cols.has("status") && (
        <div className="flex min-w-0 items-center">
          <StatusMenu status={idea.status} onChange={(s) => h.onStatus(idea, s)} />
        </div>
      )}

      {cols.has("postType") && (
        <div className="flex min-w-0 items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-white/5 bg-white/5">
            <PlatformIcon platform={idea.platform} />
          </div>
          <select
            aria-label={`Formato de ${idea.title}`}
            className="min-w-0 flex-1 cursor-pointer rounded border-0 bg-transparent text-xs text-zinc-300 focus:outline-none"
            value={idea.postType}
            onChange={(e) => h.onUpdate(idea.id, { postType: e.target.value })}
          >
            {postTypeOpts.map((t) => <option key={t} value={t}>{postTypeLabel(t)}</option>)}
          </select>
        </div>
      )}

      {cols.has("dueDate") && (
        <div className="min-w-0">
          <DueDateInput
            idea={idea}
            onChange={(day) => h.onUpdate(idea.id, { dueDate: day ? `${day}T00:00:00.000Z` : null })}
          />
        </div>
      )}

      {cols.has("reference") && (
        <div className="min-w-0">
          <ReferenceCell idea={idea} storyboards={storyboards} />
        </div>
      )}

      {cols.has("pilar") && (
        <div className="min-w-0">
          <PilarMenu pilar={idea.pilar} options={pillars} onChange={(p) => h.onUpdate(idea.id, { pilar: p })} />
        </div>
      )}

      {cols.has("priority") && (
        <div className="flex min-w-0 items-center">
          <PriorityMenu priority={idea.priority} onChange={(p) => h.onUpdate(idea.id, { priority: p })} />
        </div>
      )}

      <div className="flex items-center justify-end gap-0.5">
        {idea.comments.length > 0 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); h.onOpen(idea, "comments") }}
            className="flex h-8 items-center gap-1 rounded-md px-1.5 text-xs text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
            title="Ver la conversación con el cliente"
          >
            <MessageSquare size={12} />
            {idea.comments.length}
          </button>
        )}
        <IdeaActionsMenu onEdit={() => h.onOpen(idea)} onDuplicate={() => h.onDuplicate(idea)} onDelete={() => h.onDelete(idea)} />
      </div>
    </div>
  )
}

function SortableIdeaRow(props: Omit<ComponentProps<typeof IdeaRow>, "handle" | "rowRef" | "style" | "dragging"> & { canDrag: boolean }) {
  const { canDrag, ...rest } = props
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.idea.id, disabled: !canDrag })
  return (
    <IdeaRow
      {...rest}
      rowRef={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      dragging={isDragging}
      handle={canDrag ? { ...attributes, ...listeners } : null}
    />
  )
}

/** Tarjeta de idea en el celular. Se desliza: → avanza el estado, ← la borra. */
function MobileIdeaCard({ idea, highlighted, storyboards, h }: {
  idea: Idea
  highlighted: boolean
  storyboards: Array<{ id: string; title: string }>
  h: RowHandlers
}) {
  const next = nextIdeaStatus(idea.status)
  return (
    <SwipeableRow
      onSwipeRight={
        next
          ? {
              label: ideaStatusLabels[next],
              icon: <StatusIcon status={next} />,
              className: advanceSwipeStyles[next] ?? "bg-emerald-600",
              onTrigger: () => h.onStatus(idea, next),
            }
          : null
      }
      onSwipeLeft={{
        label: "Eliminar",
        icon: <Trash2 size={16} />,
        className: "bg-rose-600",
        dismiss: true,
        onTrigger: () => h.onDelete(idea),
      }}
    >
      <div
        data-idea-id={idea.id}
        onClick={(e) => clickedInside(e) && h.onOpen(idea)}
        className={`overflow-hidden rounded-lg border bg-[#0c0c0e] ${highlighted ? "border-white/25 ring-1 ring-inset ring-white/25" : "border-white/5"}`}
      >
        <div className="space-y-2.5 p-3">
          <div className="flex items-start justify-between gap-2">
            <button type="button" className="min-h-9 flex-1 text-left text-sm font-medium text-zinc-100" onClick={(e) => { e.stopPropagation(); h.onOpen(idea) }}>
              {idea.title || "Sin título"}
            </button>
            <div data-no-swipe>
              <IdeaActionsMenu onEdit={() => h.onOpen(idea)} onDuplicate={() => h.onDuplicate(idea)} onDelete={() => h.onDelete(idea)} />
            </div>
          </div>

          {idea.description && <p className="line-clamp-2 text-xs text-zinc-400">{idea.description}</p>}

          {/* Estado y prioridad son editables acá: en el celular no hay tabla donde tocarlos */}
          <div className="flex flex-wrap items-center gap-1.5" data-no-swipe>
            <StatusMenu status={idea.status} onChange={(s) => h.onStatus(idea, s)} />
            <PriorityMenu priority={idea.priority} onChange={(p) => h.onUpdate(idea.id, { priority: p })} />
          </div>

          <div className="flex flex-wrap gap-1.5 text-xs text-zinc-400">
            <span className="inline-flex items-center gap-1 rounded bg-white/5 px-1.5 py-1">
              <PlatformIcon platform={idea.platform} />
              {postTypeLabel(idea.postType)}
            </span>
            {idea.pilar && (
              <span className="inline-flex items-center gap-1 rounded bg-white/5 px-1.5 py-1">
                <Hash size={10} /> {idea.pilar}
              </span>
            )}
            {idea.dueDate && (
              <span className="inline-flex items-center gap-1 rounded bg-white/5 px-1.5 py-1">
                📅 {formatDayLabel(idea.dueDate)}{idea.publishTime && ` · ${idea.publishTime}`}
              </span>
            )}
            {idea.images.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded bg-white/5 px-1.5 py-1">
                <Images size={10} /> {idea.images.length}
              </span>
            )}
            {idea.comments.length > 0 && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); h.onOpen(idea, "comments") }}
                className="inline-flex items-center gap-1 rounded bg-white/5 px-1.5 py-1 text-zinc-300"
              >
                <MessageSquare size={11} /> {idea.comments.length}
              </button>
            )}
          </div>

          {(idea.referenceUrl || idea.referenceEmbed || idea.storyboardId) && (
            <div className="text-xs">
              <ReferenceCell idea={idea} storyboards={storyboards} />
            </div>
          )}

          <TagChips idea={idea} />
        </div>
      </div>
    </SwipeableRow>
  )
}

function KanbanCard({ idea, highlighted, storyboards, h }: {
  idea: Idea
  highlighted: boolean
  storyboards: Array<{ id: string; title: string }>
  h: RowHandlers
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: idea.id })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      data-idea-id={idea.id}
      onClick={(e) => clickedInside(e) && h.onOpen(idea)}
      className={`cursor-grab touch-manipulation rounded-lg border bg-[#0c0c0e] p-3 active:cursor-grabbing sm:touch-none ${
        highlighted ? "border-white/25 ring-1 ring-inset ring-white/25" : "border-white/5 hover:border-white/10"
      } ${isDragging ? "opacity-40" : ""}`}
    >
      <KanbanCardBody idea={idea} storyboards={storyboards} h={h} />
    </div>
  )
}

function KanbanCardBody({ idea, storyboards, h }: {
  idea: Idea
  storyboards: Array<{ id: string; title: string }>
  h?: RowHandlers
}) {
  return (
    <>
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded border border-white/5 bg-white/5">
            <PlatformIcon platform={idea.platform} />
          </div>
          <span className="truncate text-[10px] font-medium text-zinc-400">{postTypeLabel(idea.postType)}</span>
        </div>
        {h && <IdeaActionsMenu onEdit={() => h.onOpen(idea)} onDuplicate={() => h.onDuplicate(idea)} onDelete={() => h.onDelete(idea)} className="h-8 w-8" />}
      </div>
      <p className="mt-1 text-sm font-medium text-zinc-200">{idea.title || "Sin título"}</p>
      {idea.description && <p className="mt-0.5 line-clamp-2 text-[11px] text-zinc-400">{idea.description}</p>}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-zinc-400">
        {idea.dueDate && <span>📅 {formatDayShort(idea.dueDate)}</span>}
        {(idea.referenceUrl || idea.referenceEmbed || idea.storyboardId) && <ReferenceCell idea={idea} storyboards={storyboards} compact />}
        {idea.images.length > 0 && <span className="inline-flex items-center gap-1"><Images size={9} /> {idea.images.length}</span>}
        {idea.comments.length > 0 && <span className="inline-flex items-center gap-1"><MessageSquare size={9} /> {idea.comments.length}</span>}
      </div>
      <div className="mt-1.5"><TagChips idea={idea} /></div>
      {h && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <PriorityMenu priority={idea.priority} onChange={(p) => h.onUpdate(idea.id, { priority: p })} />
        </div>
      )}
    </>
  )
}

function KanbanColumn({ status, count, children }: { status: string; count: number; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `status:${status}` })
  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border p-3 transition-colors ${isOver ? "border-white/25 bg-white/[0.05]" : "border-white/5 bg-white/[0.02]"}`}
    >
      <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        <StatusIcon status={status} /> {ideaStatusLabels[status]} <span className="font-normal">({count})</span>
      </h4>
      <div className="min-h-12 space-y-2">{children}</div>
    </div>
  )
}

const emptySubscribe = () => () => {}

interface Props {
  planningId: string
  ideas: Idea[]
  storyboards: Array<{ id: string; title: string }>
  /** Idea a mostrar al entrar (?idea= desde Pendientes, avisos o el calendario). */
  focusIdeaId?: string | null
  /** "open" abre su editor; "comments" lo abre en la conversación; si no, sólo se resalta. */
  focusMode?: "highlight" | "open" | "comments"
  /** Avisa hacia arriba para que el calendario vea las fechas editadas acá. */
  onIdeasChange?: (ideas: Idea[]) => void
}

export function ContentIdeasTab({ planningId, ideas: initial, storyboards, focusIdeaId, focusMode = "highlight", onIdeasChange }: Props) {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false)

  const [ideas, setIdeas] = useState(() => initial.map(normalizeIdea))

  // Un solo aviso hacia arriba en vez de uno por cada camino que toca `ideas`:
  // así el calendario ve las fechas que se editaron acá, en la tabla.
  const notifyRef = useRef(onIdeasChange)
  useEffect(() => {
    notifyRef.current = onIdeasChange
  }, [onIdeasChange])
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    notifyRef.current?.(ideas)
  }, [ideas])

  // ── Editor ──
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editorOnComments, setEditorOnComments] = useState(false)
  const editingIdea = ideas.find((i) => i.id === editingId) ?? null
  const openEditor = useCallback((idea: Idea, section?: "comments") => {
    setEditorOnComments(section === "comments")
    setEditingId(idea.id)
  }, [])

  // Deep-link: resalta la idea pedida (y abre su editor si así se pidió) y
  // limpia de la dirección sólo lo que era del salto.
  const [highlightedIdeaId, setHighlightedIdeaId] = useState<string | null>(null)
  useEffect(() => {
    if (!focusIdeaId) return
    const timer = setTimeout(() => {
      // La que se ve: la tarjeta del celular y la fila de la tabla llevan la
      // misma marca, y la primera que aparece puede ser la que está oculta.
      const target = [...document.querySelectorAll<HTMLElement>(`[data-idea-id="${focusIdeaId}"]`)].find(
        (el) => el.offsetParent !== null,
      )
      target?.scrollIntoView({ behavior: "smooth", block: "center" })
      setHighlightedIdeaId(focusIdeaId)
      setTimeout(() => setHighlightedIdeaId(null), 2600)
      if (focusMode !== "highlight") {
        setEditorOnComments(focusMode === "comments")
        setEditingId(focusIdeaId)
      }
      const url = new URL(window.location.href)
      url.searchParams.delete("idea")
      url.searchParams.delete("ver")
      window.history.replaceState(null, "", url.pathname + url.search)
    }, 350)
    return () => clearTimeout(timer)
  }, [focusIdeaId, focusMode])

  // ── Formulario de alta ──
  const [showForm, setShowForm] = useState(false)
  const [moreFields, setMoreFields] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [newType, setNewType] = useState("REEL")
  const [newPilar, setNewPilar] = useState("")
  const [newPriority, setNewPriority] = useState("MEDIUM")
  const [newStatus, setNewStatus] = useState("IDEA")
  const [newDueDate, setNewDueDate] = useState("")
  const [newUrl, setNewUrl] = useState("")
  const [newImageDataUrl, setNewImageDataUrl] = useState<string | null>(null)
  const [newPlatform, setNewPlatform] = useState("OTHER")
  const [newStoryboardId, setNewStoryboardId] = useState("")
  /** Líneas pegadas de una lista, esperando que se confirme crearlas todas. */
  const [pasted, setPasted] = useState<string[] | null>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const openForm = useCallback(() => {
    setShowForm(true)
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
      titleRef.current?.focus()
    }, 30)
  }, [])

  // ── Vista, filtros y orden ──
  const [search, setSearch] = useState("")
  const [filterPriority, setFilterPriority] = useState("ALL")
  const [filterStatus, setFilterStatus] = useState("ALL")
  const [filterPlatform, setFilterPlatform] = useState("ALL")
  const [filterType, setFilterType] = useState("ALL")
  const [view, setView] = useState<"table" | "kanban">("table")
  const [sortKey, setSortKey] = useState<SortKey>("order")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const [groupBy, setGroupBy] = useState<string>("none")
  const [visibleCols, setVisibleCols] = useState<Set<ColumnKey>>(new Set(DEFAULT_COLS))

  // Las columnas y la vista elegidas se recuerdan en este navegador. Se leen
  // después de montar para que el HTML del servidor y el primer dibujo coincidan.
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const cols = JSON.parse(localStorage.getItem(COLS_KEY) ?? "null")
        if (Array.isArray(cols)) {
          setVisibleCols(new Set(cols.filter((c): c is ColumnKey => COLUMNS.some((col) => col.key === c))))
        }
        const savedView = localStorage.getItem(VIEW_KEY)
        if (savedView === "table" || savedView === "kanban") setView(savedView)
      } catch {
        // Sin almacenamiento (ventana privada): quedan las de siempre.
      }
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  const toggleCol = (key: ColumnKey) => {
    setVisibleCols((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      try { localStorage.setItem(COLS_KEY, JSON.stringify([...next])) } catch {}
      return next
    })
  }

  const changeView = (next: "table" | "kanban") => {
    setView(next)
    try { localStorage.setItem(VIEW_KEY, next) } catch {}
  }

  const toggleSort = (key: SortKey) => {
    if (sortKey !== key) {
      setSortKey(key)
      setSortDir("asc")
    } else if (sortDir === "asc") {
      setSortDir("desc")
    } else {
      // Tercer clic: vuelve al orden propio del mes, el que se arma arrastrando.
      setSortKey("order")
      setSortDir("asc")
    }
  }

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
  )

  /** Los pilares habituales más los que ya usa este mes, para elegir en un toque. */
  const pillars = useMemo(() => {
    const used = ideas.map((i) => i.pilar).filter(Boolean)
    return [...new Set([...pillarOpts, ...used])]
  }, [ideas])

  const filtersActive =
    !!search.trim() || filterPriority !== "ALL" || filterStatus !== "ALL" || filterPlatform !== "ALL" || filterType !== "ALL"
  const clearFilters = () => {
    setSearch("")
    setFilterPriority("ALL")
    setFilterStatus("ALL")
    setFilterPlatform("ALL")
    setFilterType("ALL")
  }

  const filtered = useMemo(() => {
    let items = ideas
    const q = foldText(search.trim())
    if (q) {
      // Sin tildes y por todo lo que se escribe de la pieza, no sólo el título:
      // "promocion" encuentra "Promoción", y una frase del copy encuentra su pieza.
      items = items.filter((i) =>
        foldText([i.title, i.description, i.caption, i.pilar, ...i.contentIdeaTags.map((t) => t.tag.name)].join(" ")).includes(q),
      )
    }
    if (filterPriority !== "ALL") items = items.filter((i) => i.priority === filterPriority)
    if (filterStatus !== "ALL") items = items.filter((i) => i.status === filterStatus)
    if (filterPlatform !== "ALL") items = items.filter((i) => i.platform === filterPlatform)
    if (filterType !== "ALL") items = items.filter((i) => i.postType === filterType)
    if (sortKey !== "order") {
      const weight = (i: Idea): string | number => {
        switch (sortKey) {
          case "title": return foldText(i.title)
          case "pilar": return i.pilar ? foldText(i.pilar) : "￿"
          case "status": return statusOpts.indexOf(i.status)
          case "priority": return priorityOpts.indexOf(i.priority)
          case "postType": return postTypeLabel(i.postType)
          // Sin fecha va al final en los dos sentidos: no es "la más temprana".
          case "dueDate": return i.dueDate ?? (sortDir === "asc" ? "￿" : "")
          default: return 0
        }
      }
      items = [...items].sort((a, b) => {
        const va = weight(a)
        const vb = weight(b)
        const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb))
        return sortDir === "asc" ? cmp : -cmp
      })
    }
    return items
  }, [ideas, search, filterPriority, filterStatus, filterPlatform, filterType, sortKey, sortDir])

  const grouped = useMemo(() => {
    if (groupBy === "none") return null
    const map = new Map<string, Idea[]>()
    for (const idea of filtered) {
      let key = ""
      switch (groupBy) {
        case "status": key = idea.status; break
        case "priority": key = idea.priority; break
        case "pilar": key = idea.pilar || "(Sin pilar)"; break
        case "postType": key = idea.postType; break
      }
      const arr = map.get(key) ?? []
      arr.push(idea)
      map.set(key, arr)
    }
    const order = groupBy === "status" ? statusOpts : groupBy === "priority" ? priorityOpts : undefined
    if (order) {
      return order.filter((k) => map.has(k)).map((k) => [k, map.get(k)!] as const)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [filtered, groupBy])

  // ── Alta ──
  const resetForNext = () => {
    // Formato, pilar, prioridad, estado y plataforma se quedan: la idea
    // diecisiete suele parecerse a la dieciséis, y reelegirlos es la fricción
    // que se paga veinte veces por mes. Lo propio de cada pieza se limpia.
    setNewTitle("")
    setNewDescription("")
    setNewDueDate("")
    setNewUrl("")
    setNewImageDataUrl(null)
    setNewStoryboardId("")
    setPasted(null)
  }

  const closeForm = () => {
    resetForNext()
    setShowForm(false)
  }

  const addIdea = async () => {
    if (adding) return
    if (!newTitle.trim() && !newImageDataUrl) {
      titleRef.current?.focus()
      return
    }
    const body = {
      title: newTitle.trim(),
      description: newDescription,
      postType: newType,
      pilar: newPilar,
      priority: newPriority,
      status: newStatus,
      dueDate: newDueDate || null,
      storyboardId: newStoryboardId || null,
    }
    const embed = newImageDataUrl ? null : detectEmbed(newUrl)
    const payload = newImageDataUrl
      ? { ...body, title: body.title || "Imagen", postType: body.postType, platform: "IMAGE", referenceUrl: "", referenceEmbed: newImageDataUrl }
      : { ...body, platform: embed?.platform ?? newPlatform, referenceUrl: newUrl.trim(), referenceEmbed: embed?.embedUrl ?? "" }

    setAdding(true)
    const res = await fetch(`/api/plannings/${planningId}/ideas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => null)
    setAdding(false)
    if (!res?.ok) {
      const err = await res?.json().catch(() => null)
      toast.error(err?.error ?? "No se pudo agregar la idea. Revisa tu conexión.")
      return
    }
    const idea = normalizeIdea(await res.json())
    setIdeas((prev) => [...prev, idea])
    resetForNext()
    toast.success(`Agregada: ${idea.title}`, { id: "idea-agregada", duration: 1800 })
    titleRef.current?.focus()
  }

  const createPasted = async () => {
    if (!pasted || adding) return
    setAdding(true)
    const res = await fetch(`/api/plannings/${planningId}/ideas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ideas: pasted, postType: newType, pilar: newPilar, priority: newPriority, status: newStatus }),
    }).catch(() => null)
    setAdding(false)
    if (!res?.ok) {
      const err = await res?.json().catch(() => null)
      toast.error(err?.error ?? "No se pudieron crear las ideas")
      return
    }
    const data = (await res.json()) as { ideas: Idea[] }
    setIdeas((prev) => [...prev, ...data.ideas.map(normalizeIdea)])
    toast.success(`${data.ideas.length} ideas agregadas`)
    resetForNext()
    titleRef.current?.focus()
  }

  // ── Guardado en línea ──
  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const pendingRef = useRef<Record<string, Record<string, unknown>>>({})
  const snapshotRef = useRef<Record<string, Idea[]>>({})

  const updateIdea = useCallback((ideaId: string, data: Partial<Idea>) => {
    setIdeas((p) => {
      if (!snapshotRef.current[ideaId]) snapshotRef.current[ideaId] = p
      return p.map((i) => (i.id === ideaId ? { ...i, ...data } : i))
    })
    pendingRef.current[ideaId] = { ...pendingRef.current[ideaId], ...data }
    if (debounceRef.current[ideaId]) clearTimeout(debounceRef.current[ideaId])
    debounceRef.current[ideaId] = setTimeout(async () => {
      const snapshot = snapshotRef.current[ideaId]
      const body = pendingRef.current[ideaId]
      delete snapshotRef.current[ideaId]
      delete pendingRef.current[ideaId]
      delete debounceRef.current[ideaId]
      const res = await fetch(`/api/plannings/${planningId}/ideas/${ideaId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).catch(() => null)
      if (!res?.ok) {
        if (snapshot) setIdeas(snapshot)
        toast.error("No se pudo guardar el cambio")
      }
    }, 400)
  }, [planningId])

  const setIdeaStatus = useCallback(async (idea: Idea, status: string) => {
    if (idea.status === status) return
    const prevStatus = idea.status
    setIdeas((p) => p.map((i) => (i.id === idea.id ? { ...i, status } : i)))
    const res = await fetch(`/api/plannings/${planningId}/ideas/${idea.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).catch(() => null)
    if (!res?.ok) {
      setIdeas((p) => p.map((i) => (i.id === idea.id ? { ...i, status: prevStatus } : i)))
      toast.error("No se pudo cambiar el estado")
    }
  }, [planningId])

  /** Cambios que el editor ya guardó en el servidor. */
  const patchIdea = useCallback((ideaId: string, patch: Partial<Idea> | ((current: Idea) => Partial<Idea>)) => {
    setIdeas((prev) => prev.map((i) => (i.id === ideaId ? { ...i, ...(typeof patch === "function" ? patch(i) : patch) } : i)))
  }, [])

  // ── Borrar con deshacer ──
  // La idea sale de la lista al instante y se borra de verdad a los pocos
  // segundos, salvo que se toque "Deshacer". Antes se borraba sin preguntar y
  // sin vuelta atrás: un toque de más en el menú y se perdía la pieza entera,
  // con sus comentarios.
  const pendingDeletes = useRef(new Map<string, { timer: ReturnType<typeof setTimeout>; toastId: string | number }>())

  const reallyDelete = useCallback((ideaId: string, keepalive = false) => {
    return fetch(`/api/plannings/${planningId}/ideas/${ideaId}`, { method: "DELETE", keepalive }).catch(() => null)
  }, [planningId])

  useEffect(() => {
    const deletes = pendingDeletes.current
    // Si la pestaña se cierra o se cambia de sección antes de que venza el
    // plazo, el borrado se manda igual: lo pedido no puede reaparecer después.
    const flush = () => {
      for (const [ideaId, { timer, toastId }] of deletes) {
        clearTimeout(timer)
        toast.dismiss(toastId)
        reallyDelete(ideaId, true)
      }
      deletes.clear()
    }
    window.addEventListener("pagehide", flush)
    return () => {
      window.removeEventListener("pagehide", flush)
      flush()
    }
  }, [reallyDelete])

  const deleteIdea = useCallback((idea: Idea) => {
    let index = -1
    setIdeas((prev) => {
      index = prev.findIndex((i) => i.id === idea.id)
      return prev.filter((i) => i.id !== idea.id)
    })
    setEditingId((cur) => (cur === idea.id ? null : cur))

    const restore = () => {
      setIdeas((prev) => {
        if (prev.some((i) => i.id === idea.id)) return prev
        const next = [...prev]
        next.splice(index < 0 ? next.length : Math.min(index, next.length), 0, idea)
        return next
      })
    }

    const toastId = toast("Idea eliminada", {
      description: idea.title,
      duration: UNDO_MS,
      action: {
        label: "Deshacer",
        onClick: () => {
          const pending = pendingDeletes.current.get(idea.id)
          if (!pending) return
          clearTimeout(pending.timer)
          pendingDeletes.current.delete(idea.id)
          restore()
        },
      },
    })
    const timer = setTimeout(async () => {
      pendingDeletes.current.delete(idea.id)
      const res = await reallyDelete(idea.id)
      if (!res?.ok) {
        restore()
        toast.error("No se pudo eliminar la idea")
      }
    }, UNDO_MS)
    pendingDeletes.current.set(idea.id, { timer, toastId })
  }, [reallyDelete])

  const duplicateIdea = useCallback(async (idea: Idea) => {
    const res = await fetch(`/api/plannings/${planningId}/ideas/${idea.id}/duplicate`, { method: "POST" }).catch(() => null)
    if (!res?.ok) {
      toast.error("No se pudo duplicar la idea")
      return
    }
    const copy = normalizeIdea(await res.json())
    setIdeas((prev) => {
      const at = prev.findIndex((i) => i.id === idea.id)
      const next = [...prev]
      next.splice(at < 0 ? next.length : at + 1, 0, copy)
      return next
    })
    // Se abre la copia: lo primero que se hace con ella es cambiarle el tema.
    setEditorOnComments(false)
    setEditingId(copy.id)
    toast.success("Idea duplicada", { description: "Quedó sin fecha, justo debajo de la original." })
  }, [planningId])

  const handlers: RowHandlers = useMemo(() => ({
    onOpen: openEditor,
    onStatus: setIdeaStatus,
    onUpdate: updateIdea,
    onDuplicate: duplicateIdea,
    onDelete: deleteIdea,
  }), [openEditor, setIdeaStatus, updateIdea, duplicateIdea, deleteIdea])

  const handleReorder = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = ideas.findIndex((i) => i.id === active.id)
    const newIndex = ideas.findIndex((i) => i.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const prev = [...ideas]
    const reordered = [...ideas]
    const [moved] = reordered.splice(oldIndex, 1)
    reordered.splice(newIndex, 0, moved)
    setIdeas(reordered)

    const res = await fetch(`/api/plannings/${planningId}/ideas/reorder`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ideaIds: reordered.map((i) => i.id) }),
    }).catch(() => null)
    if (!res?.ok) {
      setIdeas(prev)
      toast.error("Error al reordenar")
    }
  }

  // ── Board: arrastrar una tarjeta a otra columna cambia su estado ──
  const [boardDragId, setBoardDragId] = useState<string | null>(null)
  const boardDragIdea = ideas.find((i) => i.id === boardDragId) ?? null
  const handleBoardDragEnd = (event: DragEndEvent) => {
    setBoardDragId(null)
    const over = event.over?.id
    if (typeof over !== "string" || !over.startsWith("status:")) return
    const idea = ideas.find((i) => i.id === event.active.id)
    if (idea) setIdeaStatus(idea, over.slice("status:".length))
  }

  // ── Atajos de teclado ──
  // N agrega, / busca. Sólo cuando no se está escribiendo en otro lado y no
  // hay nada abierto encima: una letra en un campo es una letra.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return
      if (editingId || document.querySelector('[role="menu"], [role="dialog"]')) return
      if (e.key === "n" || e.key === "N") {
        e.preventDefault()
        openForm()
      } else if (e.key === "/") {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [editingId, openForm])

  const optionalCols = COLUMNS.filter((c) => visibleCols.has(c.key))
  const gridTemplate = ["28px", "minmax(200px,2fr)", ...optionalCols.map((c) => c.width), "76px"].join(" ")
  const canReorder = sortKey === "order" && mounted

  const rowProps = {
    cols: visibleCols,
    gridTemplate,
    pillars,
    storyboards,
    h: handlers,
  }

  return (
    <div className="space-y-3">
      {/* Toolbar: en móvil la búsqueda y la acción principal van arriba,
          y los filtros quedan en una fila que se desliza en horizontal. */}
      <div className="mb-5 space-y-2.5 sm:mb-6">
        <div className="flex items-center gap-2">
          <div className="group relative min-w-0 flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 transition-colors group-focus-within:text-zinc-300" size={16} />
            <input
              ref={searchRef}
              type="search"
              placeholder="Buscar ideas..."
              aria-label="Buscar ideas de este mes"
              className="h-10 w-full rounded-lg border border-white/10 bg-[#18181b] pl-9 pr-9 text-base text-zinc-200 transition-all placeholder:text-zinc-400 focus:border-white/25 focus:outline-none focus:ring-1 focus:ring-white/20 sm:h-9 sm:text-sm [&::-webkit-search-cancel-button]:hidden"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setSearch("")
                  e.currentTarget.blur()
                }
              }}
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Limpiar búsqueda"
                className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded text-zinc-400 hover:text-white"
              >
                <X size={14} />
              </button>
            ) : (
              <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400 sm:block">
                /
              </kbd>
            )}
          </div>

          <button
            type="button"
            onClick={() => (showForm ? closeForm() : openForm())}
            className="flex h-10 shrink-0 items-center gap-2 rounded-lg bg-brand px-3 text-sm font-semibold text-white transition-colors hover:bg-[#d0424a] sm:h-9 sm:px-4"
          >
            <Plus size={16} />
            <span className="whitespace-nowrap">Nueva idea</span>
            <kbd className="hidden rounded bg-white/15 px-1.5 text-[10px] font-medium sm:inline">N</kbd>
          </button>
        </div>

        <div className="-mx-3 flex items-center gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden">
          <select className={filterStatus === "ALL" ? filterSelectClass : filterSelectActiveClass} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} aria-label="Filtrar por estado">
            <option value="ALL">Estado</option>
            {statusOpts.map((s) => <option key={s} value={s}>{ideaStatusLabels[s]}</option>)}
          </select>
          <select className={filterPriority === "ALL" ? filterSelectClass : filterSelectActiveClass} value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} aria-label="Filtrar por prioridad">
            <option value="ALL">Prioridad</option>
            {priorityOpts.map((p) => <option key={p} value={p}>{priorityLabels[p]}</option>)}
          </select>
          <select className={filterType === "ALL" ? filterSelectClass : filterSelectActiveClass} value={filterType} onChange={(e) => setFilterType(e.target.value)} aria-label="Filtrar por formato">
            <option value="ALL">Formato</option>
            {postTypeOpts.map((t) => <option key={t} value={t}>{postTypeLabel(t)}</option>)}
          </select>
          <select className={filterPlatform === "ALL" ? filterSelectClass : filterSelectActiveClass} value={filterPlatform} onChange={(e) => setFilterPlatform(e.target.value)} aria-label="Filtrar por plataforma">
            <option value="ALL">Plataforma</option>
            {platformOpts.map((p) => <option key={p} value={p}>{platformLabel(p)}</option>)}
          </select>
          {filtersActive && (
            <button type="button" onClick={clearFilters} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm text-zinc-400 transition-colors hover:bg-white/5 hover:text-white">
              <FilterX size={14} /> Limpiar
            </button>
          )}

          <div className="mx-1 hidden h-5 w-px shrink-0 bg-white/10 sm:block" />

          {view === "table" && (
            <select className={toolSelectClass} value={groupBy} onChange={(e) => setGroupBy(e.target.value)} aria-label="Agrupar por">
              <option value="none">Sin agrupar</option>
              <option value="status">Por estado</option>
              <option value="priority">Por prioridad</option>
              <option value="pilar">Por pilar</option>
              <option value="postType">Por formato</option>
            </select>
          )}

          {view === "table" && (
            <div className="hidden sm:block">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className={toolButtonClass}>
                    <SlidersHorizontal size={14} /> Columnas
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>Columnas visibles</DropdownMenuLabel>
                  {COLUMNS.map((c) => (
                    <DropdownMenuCheckItem
                      key={c.key}
                      selected={visibleCols.has(c.key)}
                      // Queda abierto: se suelen tocar varias seguidas.
                      onSelect={(e) => { e.preventDefault(); toggleCol(c.key) }}
                    >
                      {c.label}
                    </DropdownMenuCheckItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          <button
            type="button"
            onClick={() => changeView(view === "table" ? "kanban" : "table")}
            className={toolButtonClass}
          >
            {view === "table" ? <LayoutGrid size={14} /> : <Table2 size={14} />}
            {view === "table" ? "Board" : "Tabla"}
          </button>
        </div>
      </div>

      {showForm && (
        <div
          ref={formRef}
          className="space-y-3 rounded-lg border border-white/10 bg-[#0c0c0e] p-4"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault()
              closeForm()
            }
          }}
        >
          <div className="space-y-1">
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor="new-title" className="text-xs font-medium text-zinc-400">Tema</label>
              <span className="hidden text-[11px] text-zinc-500 sm:inline">
                Enter agrega y deja listo para la siguiente · pega una lista para crear varias
              </span>
            </div>
            <input
              id="new-title"
              ref={titleRef}
              className={fieldClass}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  if (pasted) createPasted()
                  else addIdea()
                }
              }}
              onPaste={(e) => {
                const text = e.clipboardData.getData("text")
                const lines = splitPastedIdeas(text)
                if (lines.length >= 2) {
                  // Una lista del mes: se ofrece crear una idea por línea.
                  e.preventDefault()
                  setPasted(lines)
                  return
                }
                // Un link pegado en el tema es una referencia, no un título.
                if (/^https?:\/\/\S+$/.test(text.trim()) && !newUrl) {
                  e.preventDefault()
                  setNewUrl(text.trim())
                  setMoreFields(true)
                  return
                }
                handleImagePaste(e, (url) => {
                  setNewImageDataUrl(url)
                  setMoreFields(true)
                })
              }}
              placeholder="Ej: Reel detrás de la barra"
              autoComplete="off"
              enterKeyHint="done"
            />
          </div>

          {pasted && (
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <p className="text-sm font-medium text-zinc-200">
                Pegaste una lista de {pasted.length} ideas
              </p>
              <ol className="mt-1.5 max-h-32 list-inside list-decimal space-y-0.5 overflow-y-auto text-xs text-zinc-400">
                {pasted.map((line, i) => <li key={i} className="truncate">{line}</li>)}
              </ol>
              <p className="mt-2 text-[11px] text-zinc-500">
                Se crean con el formato, pilar, prioridad y estado de abajo. El resto se completa después.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={createPasted}
                  disabled={adding}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-semibold text-white hover:bg-[#d0424a] disabled:opacity-60"
                >
                  <ListPlus size={15} /> {adding ? "Creando…" : `Crear ${pasted.length} ideas`}
                </button>
                <button
                  type="button"
                  onClick={() => { setNewTitle(pasted.join(" ")); setPasted(null); titleRef.current?.focus() }}
                  className="min-h-9 rounded-lg px-3 text-sm text-zinc-300 hover:bg-white/5"
                >
                  Pegar como una sola
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="space-y-1">
              <label htmlFor="new-type" className="text-xs font-medium text-zinc-400">Formato</label>
              <select id="new-type" className={fieldClass} value={newType} onChange={(e) => setNewType(e.target.value)}>
                {postTypeOpts.map((t) => <option key={t} value={t}>{postTypeLabel(t)}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="new-pilar" className="text-xs font-medium text-zinc-400">Pilar</label>
              <input id="new-pilar" className={fieldClass} value={newPilar} onChange={(e) => setNewPilar(e.target.value)} placeholder="Pilar..." list="new-pillar-list" />
              <datalist id="new-pillar-list">
                {pillars.map((p) => <option key={p} value={p} />)}
              </datalist>
            </div>
            <div className="space-y-1">
              <label htmlFor="new-due" className="text-xs font-medium text-zinc-400">Entrega</label>
              <input id="new-due" type="date" className={fieldClass} value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label htmlFor="new-priority" className="text-xs font-medium text-zinc-400">Prioridad</label>
              <select id="new-priority" className={fieldClass} value={newPriority} onChange={(e) => setNewPriority(e.target.value)}>
                {priorityOpts.map((p) => <option key={p} value={p}>{priorityLabels[p]}</option>)}
              </select>
            </div>
          </div>

          {moreFields ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1 sm:col-span-3">
                <label htmlFor="new-description" className="text-xs font-medium text-zinc-400">Objetivo</label>
                <input id="new-description" className={fieldClass} value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Detalle del objetivo..." />
              </div>
              <div className="space-y-1">
                <label htmlFor="new-status" className="text-xs font-medium text-zinc-400">Estado</label>
                <select id="new-status" className={fieldClass} value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                  {statusOpts.map((s) => <option key={s} value={s}>{ideaStatusLabels[s]}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label htmlFor="new-platform" className="text-xs font-medium text-zinc-400">Plataforma</label>
                <select id="new-platform" className={fieldClass} value={newPlatform} onChange={(e) => setNewPlatform(e.target.value)}>
                  {platformOpts.map((p) => <option key={p} value={p}>{platformLabel(p)}</option>)}
                </select>
              </div>
              {storyboards.length > 0 && (
                <div className="space-y-1">
                  <label htmlFor="new-storyboard" className="text-xs font-medium text-zinc-400">Storyboard</label>
                  <select id="new-storyboard" className={fieldClass} value={newStoryboardId} onChange={(e) => setNewStoryboardId(e.target.value)}>
                    <option value="">Sin storyboard</option>
                    {storyboards.map((sb) => <option key={sb.id} value={sb.id}>{sb.title}</option>)}
                  </select>
                </div>
              )}
              <div className="space-y-1 sm:col-span-3">
                <label htmlFor="new-reference" className="text-xs font-medium text-zinc-400">Referencia</label>
                {newImageDataUrl ? (
                  <div className="flex items-center gap-2">
                    <img src={newImageDataUrl} alt="" className="h-12 w-12 rounded bg-zinc-800 object-cover" />
                    <button type="button" onClick={() => setNewImageDataUrl(null)} className="min-h-9 rounded-md px-2 text-xs text-zinc-400 hover:bg-white/5 hover:text-white">Quitar</button>
                  </div>
                ) : (
                  <input id="new-reference" className={fieldClass} value={newUrl} onChange={(e) => setNewUrl(e.target.value)} onPaste={(e) => handleImagePaste(e, setNewImageDataUrl)} placeholder="Pegar URL o imagen (Ctrl+V)..." />
                )}
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setMoreFields(true)} className="text-xs text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline">
              + Objetivo, estado, plataforma, referencia…
            </button>
          )}

          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={closeForm} className="min-h-10 rounded-lg px-4 text-sm text-zinc-300 hover:bg-white/5 hover:text-white">Cerrar</button>
            <button
              type="button"
              onClick={pasted ? createPasted : addIdea}
              disabled={adding}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand px-5 text-sm font-semibold text-white hover:bg-[#d0424a] disabled:opacity-60"
            >
              {adding ? "Agregando…" : pasted ? `Crear ${pasted.length}` : "Agregar"}
              <CornerDownLeft size={14} className="hidden opacity-70 sm:block" />
            </button>
          </div>
        </div>
      )}

      {ideas.length === 0 ? (
        !showForm && (
          <div className="rounded-xl border border-dashed border-white/10 px-6 py-12 text-center">
            <p className="text-sm text-zinc-300">Todavía no hay ideas para este mes.</p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-zinc-500">
              Escribe una y presiona Enter para la siguiente, o pega la lista entera —una idea por línea— y se crean todas de una vez.
            </p>
            <button
              type="button"
              onClick={openForm}
              className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-[#d0424a]"
            >
              <Plus size={16} /> Agregar la primera
            </button>
          </div>
        )
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 px-6 py-10 text-center">
          <p className="text-sm text-zinc-400">Ninguna idea coincide con la búsqueda o los filtros.</p>
          <button type="button" onClick={clearFilters} className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-zinc-300 hover:bg-white/5">
            <FilterX size={14} /> Limpiar filtros
          </button>
        </div>
      ) : view === "table" ? (
        <>
        {/* Móvil: tarjetas que se deslizan */}
        <div className="space-y-3 pb-16 sm:hidden">
          {filtered.map((idea) => (
            <MobileIdeaCard key={idea.id} idea={idea} highlighted={highlightedIdeaId === idea.id} storyboards={storyboards} h={handlers} />
          ))}
        </div>

        {/* Escritorio: tabla */}
        <div className="hidden overflow-x-auto sm:block">
          <div className="min-w-[760px] overflow-hidden rounded-xl border border-white/5 bg-[#0c0c0e]">
            <div className="grid items-center gap-3 border-b border-white/5 bg-white/[0.01] px-3 py-2" style={{ gridTemplateColumns: gridTemplate }}>
              <div />
              <SortHeader label="Tema" active={sortKey === "title"} dir={sortDir} onClick={() => toggleSort("title")} />
              {optionalCols.map((c) =>
                c.sort ? (
                  <SortHeader key={c.key} label={c.label} active={sortKey === c.sort} dir={sortDir} onClick={() => toggleSort(c.sort as SortKey)} />
                ) : (
                  <div key={c.key} className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">{c.label}</div>
                ),
              )}
              <div />
            </div>

            {!mounted ? (
              <div className="flex flex-col">
                {filtered.map((idea) => (
                  <IdeaRow key={idea.id} idea={idea} handle={null} highlighted={false} {...rowProps} />
                ))}
              </div>
            ) : grouped ? (
              <DndContext id="ideas-tabla" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleReorder}>
                <div className="flex flex-col">
                  {grouped.map(([key, items]) => (
                    <div key={key}>
                      <div className="border-b border-white/5 bg-white/[0.02] px-4 py-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{groupLabel(groupBy, key)} <span className="text-[10px] font-normal">({items.length})</span></span>
                      </div>
                      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                        {items.map((idea) => (
                          <SortableIdeaRow key={idea.id} idea={idea} canDrag={canReorder} highlighted={highlightedIdeaId === idea.id} {...rowProps} />
                        ))}
                      </SortableContext>
                    </div>
                  ))}
                </div>
              </DndContext>
            ) : (
              <DndContext id="ideas-tabla" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleReorder}>
                <SortableContext items={filtered.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                  <div className="flex flex-col">
                    {filtered.map((idea) => (
                      <SortableIdeaRow key={idea.id} idea={idea} canDrag={canReorder} highlighted={highlightedIdeaId === idea.id} {...rowProps} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>
        </>
      ) : (
        <DndContext
          id="ideas-board"
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={(e: DragStartEvent) => setBoardDragId(String(e.active.id))}
          onDragCancel={() => setBoardDragId(null)}
          onDragEnd={handleBoardDragEnd}
        >
          <div className="grid grid-cols-1 gap-3 pb-16 sm:grid-cols-2 sm:pb-0 lg:grid-cols-4">
            {statusOpts.map((status) => {
              const items = filtered.filter((i) => i.status === status)
              return (
                <KanbanColumn key={status} status={status} count={items.length}>
                  {items.map((idea) => (
                    <KanbanCard key={idea.id} idea={idea} highlighted={highlightedIdeaId === idea.id} storyboards={storyboards} h={handlers} />
                  ))}
                  {items.length === 0 && <p className="py-4 text-center text-[11px] text-zinc-500">Suelta una idea acá</p>}
                </KanbanColumn>
              )
            })}
          </div>
          <DragOverlay dropAnimation={null}>
            {boardDragIdea && (
              <div className="w-64 max-w-[80vw] rotate-1 rounded-lg border border-white/20 bg-[#18181b] p-3 shadow-2xl shadow-black/60">
                <KanbanCardBody idea={boardDragIdea} storyboards={storyboards} />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* Pie: cuántas se ven y los atajos, que no sirven si nadie sabe que existen */}
      {ideas.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
          <p>
            {filtered.length === ideas.length ? `${ideas.length} ideas` : `Mostrando ${filtered.length} de ${ideas.length} ideas`}
            {sortKey !== "order" && view === "table" && (
              <button type="button" onClick={() => { setSortKey("order"); setSortDir("asc") }} className="ml-2 text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline">
                volver al orden del mes
              </button>
            )}
          </p>
          <p className="hidden sm:block">
            <kbd className="rounded border border-white/10 px-1">N</kbd> nueva ·{" "}
            <kbd className="rounded border border-white/10 px-1">/</kbd> buscar ·{" "}
            {view === "table" ? "arrastra del asa para reordenar" : "arrastra una tarjeta para cambiarle el estado"}
          </p>
          <p className="sm:hidden">
            {view === "table"
              ? "Desliza una idea → para avanzarla, ← para borrarla"
              : "Mantén apretada una tarjeta y arrástrala a otra columna"}
          </p>
        </div>
      )}

      {/* En el celular, "Nueva idea" queda a mano aunque la lista sea larga. */}
      {!showForm && !editingIdea && ideas.length > 0 && (
        <button
          type="button"
          onClick={() => {
            window.scrollTo({ top: 0, behavior: "smooth" })
            openForm()
          }}
          aria-label="Nueva idea"
          className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-lg shadow-black/50 transition-transform active:scale-95 sm:hidden"
        >
          <Plus size={24} />
        </button>
      )}

      {editingIdea && (
        <IdeaEditorPanel
          key={editingIdea.id}
          planningId={planningId}
          idea={editingIdea}
          storyboards={storyboards}
          focusComments={editorOnComments}
          onClose={() => setEditingId(null)}
          onPatch={patchIdea}
          onDuplicate={duplicateIdea}
          onDelete={deleteIdea}
        />
      )}
    </div>
  )
}

function SortHeader({ label, active, dir, onClick }: { label: string; active: boolean; dir: "asc" | "desc"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Ordenar por ${label.toLowerCase()}`}
      className={`-mx-1 inline-flex items-center gap-1 rounded px-1 text-left text-[11px] font-semibold uppercase tracking-widest transition-colors hover:text-zinc-200 ${active ? "text-zinc-200" : "text-zinc-400"}`}
    >
      {label}
      {active && (dir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
    </button>
  )
}

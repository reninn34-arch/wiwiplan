"use client"

import { useState, useMemo, useRef, useCallback, useEffect, useSyncExternalStore, type ClipboardEvent } from "react"
import {
  Plus, Trash2, ExternalLink, GripVertical, X, Play, Search, Table2, MessageSquare,
  ArrowUp, LayoutGrid, CheckCircle2, Circle, ChevronDown, MoreHorizontal, Pencil,
  MonitorPlay, Smartphone, Hash, SlidersHorizontal, Command, Globe, Camera, ChevronRight, Layout, Images,
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
import { compressImage } from "@/lib/compress-image"
import { ideaImageUrl } from "@/lib/media"
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext, verticalListSortingStrategy, useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { toast } from "sonner"

const postTypeOpts = ["CARROUSEL", "REEL", "VIDEO", "IMAGE", "STORY", "STATIC", "OTHER"]
const statusOpts = ["IDEA", "SELECTED", "IN_PRODUCTION", "DONE"]
const priorityOpts = ["HIGH", "MEDIUM", "LOW"]

const ideaStatusLabels: Record<string, string> = {
  IDEA: "Idea", SELECTED: "Seleccionada", IN_PRODUCTION: "En Producción", DONE: "Lista",
}
const priorityLabels: Record<string, string> = {
  HIGH: "Alta", MEDIUM: "Media", LOW: "Baja",
}
const pillarOpts = ["Educación", "Entretenimiento", "Inspiración", "Promoción", "Conversación", "Utilidad", "Detrás de escena", "Noticia", "Otro"]
const platformOpts = ["YOUTUBE", "VIMEO", "INSTAGRAM", "TIKTOK", "LINKEDIN", "FACEBOOK", "IMAGE", "OTHER"]

// Los <select> necesitan fondo sólido: con bg-transparent el desplegable nativo
// se pinta blanco y el texto claro queda ilegible.
const filterSelectClass =
  "h-9 shrink-0 rounded-lg border border-dashed border-white/10 bg-[#18181b] px-2.5 text-sm font-medium text-zinc-300 transition-colors hover:border-white/20 focus:outline-none focus:ring-1 focus:ring-zinc-500"
const toolSelectClass =
  "h-9 shrink-0 rounded-lg border border-white/10 bg-[#18181b] px-2.5 text-sm font-medium text-zinc-300 transition-colors hover:border-white/20 focus:outline-none focus:ring-1 focus:ring-zinc-500"
const toolButtonClass =
  "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-white/10 bg-[#18181b] px-2.5 text-sm font-medium text-zinc-300 transition-colors hover:border-white/20 hover:text-white"

const COLUMNS = [
  { key: "postType", label: "Formato", w: "w-[90px]", always: true } as const,
  { key: "title", label: "Tema", w: "min-w-[160px]", always: true } as const,
  { key: "description", label: "Objetivo", w: "min-w-[180px]" } as const,
  { key: "reference", label: "Referencia", w: "min-w-[220px]" } as const,
  { key: "pilar", label: "Pilar", w: "w-[130px]" } as const,
  { key: "tags", label: "Tags", w: "w-[140px]" } as const,
  { key: "status", label: "Estado", w: "w-24" } as const,
  { key: "priority", label: "Prioridad", w: "w-20" } as const,
  { key: "dueDate", label: "Entrega", w: "w-[105px]" } as const,
  { key: "comments", label: "💬", w: "w-10", center: true } as const,
]

type SortKey = (typeof COLUMNS)[number]["key"] | "order" | null

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

function formatDate(d: string | null) {
  if (!d) return ""
  return new Date(d).toLocaleDateString("es-EC", { day: "2-digit", month: "2-digit" })
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

/** Menú de tres puntos de cada idea: editar y eliminar. */
function IdeaActionsMenu({ onEdit, onDelete, className }: {
  onEdit: () => void
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
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={onDelete}>
          <Trash2 size={15} /> Eliminar idea
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function handleImagePaste(e: ClipboardEvent<HTMLInputElement>, onDataUrl: (url: string) => void) {
  const direct = e.clipboardData.files?.[0]
  if (direct && direct.type.startsWith("image/")) {
    e.preventDefault()
    compressImage(direct).then(onDataUrl)
    return
  }
  for (const item of e.clipboardData.items) {
    if (item.type.startsWith("image/")) {
      const file = item.getAsFile()
      if (!file) return
      e.preventDefault()
      compressImage(file).then(onDataUrl)
      return
    }
  }
}

interface TagItem {
  id: string
  name: string
  color: string
}

interface Idea {
  id: string
  title: string
  description: string
  pilar: string
  postType: string
  platform: string
  referenceUrl: string
  referenceEmbed: string
  status: string
  priority: string
  order: number
  dueDate: string | null
  storyboardId: string | null
  storyboard: { id: string; title: string } | null
  contentIdeaTags: { tag: TagItem }[]
  comments: { id: string; authorName: string; text: string; createdAt: string }[]
  /** Meta de la galería: los bytes se sirven por URL (/api/idea-images/[id]). */
  images: Array<{ id: string; order: number }>
}

interface Props {
  planningId: string
  ideas: Idea[]
  storyboards: Array<{ id: string; title: string }>
  /** Idea a resaltar al entrar (?idea= desde Pendientes o notificaciones). */
  focusIdeaId?: string | null
}

function SortableRow({ idea, updateIdea, deleteIdea, onStatusChange, search, storyboards, onEdit, cols, highlighted }: {
  idea: Idea
  updateIdea: (id: string, data: Record<string, unknown>) => void
  deleteIdea: (id: string) => void
  onStatusChange: (id: string, status: string, prevStatus: string) => void
  search: string
  storyboards: Array<{ id: string; title: string }>
  onEdit: (idea: Idea) => void
  cols: Set<string>
  highlighted?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: idea.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const [showComments, setShowComments] = useState(false)

  if (search && !idea.title.toLowerCase().includes(search) && !idea.description.toLowerCase().includes(search)) {
    return null
  }

  return (
    <>
    <div ref={setNodeRef} style={style} data-idea-id={idea.id} className={`grid grid-cols-[32px_minmax(250px,2fr)_minmax(120px,1fr)_120px_120px_100px_100px_56px] items-center gap-4 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors group cursor-pointer ${highlighted ? "bg-white/[0.06] ring-1 ring-inset ring-white/25" : ""}`}>
      <div className="flex items-center justify-center text-zinc-400 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity cursor-grab hover:text-zinc-300" suppressHydrationWarning {...attributes} {...listeners}>
        <GripVertical size={14} />
      </div>

      <div className="min-w-0 pr-4" onClick={() => onEdit(idea)}>
        <input
          className="w-full bg-transparent text-sm font-medium text-zinc-100 focus:outline-none truncate group-hover:text-white transition-colors cursor-pointer"
          value={idea.title}
          onClick={(e) => { e.stopPropagation(); onEdit(idea) }}
          onChange={(e) => updateIdea(idea.id, { title: e.target.value })}
          placeholder="Tema..."
        />
        {cols.has("description") ? (
          <input
            className="w-full bg-transparent text-xs text-zinc-400 focus:outline-none truncate mt-0.5"
            value={idea.description}
            onChange={(e) => updateIdea(idea.id, { description: e.target.value })}
            placeholder="Objetivo / detalle..."
          />
        ) : (
          <p className="text-xs text-zinc-400 truncate mt-0.5">{idea.description}</p>
        )}
        {(idea.images?.length ?? 0) > 0 && (
          <span className="mt-1 inline-flex items-center gap-1 text-[10px] text-zinc-500">
            <Images size={10} /> {idea.images.length}
          </span>
        )}
      </div>

      <div className="flex min-w-0 items-center gap-2">
        <StatusMenu status={idea.status} onChange={(s) => onStatusChange(idea.id, s, idea.status)} />
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center w-6 h-6 rounded bg-white/5 border border-white/5">
          <PlatformIcon platform={idea.platform} />
        </div>
        <select
          className="rounded border-0 bg-transparent text-xs text-zinc-300 focus:outline-none"
          value={idea.postType}
          onChange={(e) => updateIdea(idea.id, { postType: e.target.value })}
        >
          {postTypeOpts.map((t) => <option key={t} value={t}>{postTypeLabel(t)}</option>)}
        </select>
      </div>

      <div className="min-w-0">
        {idea.referenceUrl && (
          <a href={idea.referenceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-zinc-400 hover:text-white truncate max-w-full group/link" title={idea.referenceUrl}>
            {idea.referenceEmbed && idea.platform === "IMAGE" ? (
              <img src={idea.referenceEmbed} alt="" className="w-6 h-6 rounded object-cover shrink-0" />
            ) : (
              <ExternalLink size={10} className="shrink-0" />
            )}
            {idea.referenceEmbed ? platformLabel(idea.platform) : idea.referenceUrl.length > 20 ? idea.referenceUrl.slice(0, 20) + "…" : idea.referenceUrl}
          </a>
        )}
        {!idea.referenceUrl && idea.referenceEmbed && (
          <span className="inline-flex items-center gap-1 text-[10px] text-zinc-400 truncate">
            {idea.platform === "IMAGE" ? (
              <img src={idea.referenceEmbed} alt="" className="w-6 h-6 rounded object-cover shrink-0" />
            ) : (
              <ExternalLink size={10} className="shrink-0" />
            )}
            {platformLabel(idea.platform)}
          </span>
        )}
        {!idea.referenceUrl && !idea.referenceEmbed && idea.storyboardId ? (
          <button type="button" onClick={() => onEdit(idea)} className="inline-flex items-center gap-1 text-[10px] text-zinc-400 hover:text-white truncate">
            <Layout size={10} className="shrink-0" />
            {storyboards.find((s) => s.id === idea.storyboardId)?.title ?? "Storyboard"}
          </button>
        ) : null}
        {!idea.referenceUrl && !idea.referenceEmbed && !idea.storyboardId && (
          <span className="text-[10px] text-zinc-700">—</span>
        )}
      </div>

      <div>
        {cols.has("pilar") ? (
          <input
            className="w-full bg-transparent text-xs text-zinc-400 focus:outline-none"
            value={idea.pilar}
            onChange={(e) => updateIdea(idea.id, { pilar: e.target.value })}
            placeholder="Pilar..."
            list={`pillar-list-${idea.id}`}
          />
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-800/50 text-zinc-400 text-xs font-medium border border-white/5">
            <Hash size={10} className="text-zinc-500" />
            {idea.pilar || "—"}
          </span>
        )}
        <datalist id={`pillar-list-${idea.id}`}>
          {pillarOpts.map((p) => <option key={p} value={p} />)}
        </datalist>
      </div>

      <div className="flex min-w-0 items-center gap-1.5">
        <PriorityMenu priority={idea.priority} onChange={(p) => updateIdea(idea.id, { priority: p })} />
      </div>

      <div className="flex items-center justify-end gap-1">
        {idea.comments?.length > 0 && (
          <button type="button" onClick={() => setShowComments((p) => !p)} className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-300" title="Comentarios del cliente">
            <MessageSquare size={12} />
            {idea.comments.length}
          </button>
        )}
        <IdeaActionsMenu onEdit={() => onEdit(idea)} onDelete={() => deleteIdea(idea.id)} />
      </div>
    </div>
    {showComments && (
      <div className="border-b border-white/5 bg-white/[0.01] px-12 py-3">
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {(idea.comments?.length ?? 0) === 0 && <p className="text-xs text-zinc-400">Sin comentarios del cliente.</p>}
          {idea.comments?.map((c) => (
            <div key={c.id} className="rounded-lg border border-white/5 bg-[#0c0c0e] px-3 py-2">
              <p className="text-xs font-medium text-zinc-300">{c.authorName}</p>
              <p className="text-sm text-zinc-400">{c.text}</p>
              <p className="text-[10px] text-zinc-400">{new Date(c.createdAt).toLocaleString("es-EC")}</p>
            </div>
          ))}
        </div>
      </div>
    )}
    </>
  )
}

const emptySubscribe = () => () => {}

export function ContentIdeasTab({ planningId, ideas: initial, storyboards, focusIdeaId }: Props) {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false)

  // Deep-link: resalta temporalmente la idea pedida y limpia el query param.
  const [highlightedIdeaId, setHighlightedIdeaId] = useState<string | null>(null)
  useEffect(() => {
    if (!focusIdeaId) return
    const timer = setTimeout(() => {
      document.querySelector(`[data-idea-id="${focusIdeaId}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" })
      setHighlightedIdeaId(focusIdeaId)
      setTimeout(() => setHighlightedIdeaId(null), 2600)
      window.history.replaceState(null, "", window.location.pathname)
    }, 350)
    return () => clearTimeout(timer)
  }, [focusIdeaId])

  const [ideas, setIdeas] = useState(initial)
  const [showForm, setShowForm] = useState(false)
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
const [previewImage, setPreviewImage] = useState<string | null>(null)
// Galería de imágenes adjuntas: soltar varias a la vez, verlas y quitarlas.
const [uploadingImages, setUploadingImages] = useState(0)
const [galleryDragOver, setGalleryDragOver] = useState(false)
const galleryInputRef = useRef<HTMLInputElement>(null)
const [editingIdea, setEditingIdea] = useState<Idea | null>(null)
const [editTitle, setEditTitle] = useState("")
const [editDescription, setEditDescription] = useState("")
const [editType, setEditType] = useState("REEL")
const [editPilar, setEditPilar] = useState("")
const [editPriority, setEditPriority] = useState("MEDIUM")
const [editStatus, setEditStatus] = useState("IDEA")
const [editDueDate, setEditDueDate] = useState("")
const [editUrl, setEditUrl] = useState("")
const [editImageDataUrl, setEditImageDataUrl] = useState<string | null>(null)
const [editPlatform, setEditPlatform] = useState("OTHER")
const [editStoryboardId, setEditStoryboardId] = useState("")
  const [search, setSearch] = useState("")
  const [filterPriority, setFilterPriority] = useState("ALL")
  const [filterStatus, setFilterStatus] = useState("ALL")
  const [filterPlatform, setFilterPlatform] = useState("ALL")
  const [filterType, setFilterType] = useState("ALL")
  const [view, setView] = useState<"table" | "kanban">("table")
  const [sortKey] = useState<SortKey>("order")
  const [sortDir] = useState<"asc" | "desc">("asc")
  const [groupBy, setGroupBy] = useState<string>("none")
  const [showColumnSettings, setShowColumnSettings] = useState(false)
  const [visibleCols, setVisibleCols] = useState<Set<string>>(new Set(COLUMNS.map((c) => c.key)))

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const toggleCol = (key: string) => {
    const next = new Set(visibleCols)
    if (next.has(key)) next.delete(key); else next.add(key)
    setVisibleCols(next)
  }

  const filtered = useMemo(() => {
    let items = ideas
    if (search.trim()) {
      const q = search.toLowerCase()
      items = items.filter((i) => i.title?.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q))
    }
    if (filterPriority !== "ALL") items = items.filter((i) => i.priority === filterPriority)
    if (filterStatus !== "ALL") items = items.filter((i) => i.status === filterStatus)
    if (filterPlatform !== "ALL") items = items.filter((i) => i.platform === filterPlatform)
    if (filterType !== "ALL") items = items.filter((i) => i.postType === filterType)
    if (sortKey && sortKey !== "order") {
      items = [...items].sort((a, b) => {
        let va: string | number | null = ""
        let vb: string | number | null = ""
        switch (sortKey) {
          case "title": va = a.title.toLowerCase(); vb = b.title.toLowerCase(); break
          case "description": va = a.description.toLowerCase(); vb = b.description.toLowerCase(); break
          case "pilar": va = a.pilar.toLowerCase(); vb = b.pilar.toLowerCase(); break
          case "status": va = a.status; vb = b.status; break
          case "priority": { const w: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 }; va = w[a.priority] ?? 0; vb = w[b.priority] ?? 0; break }
          case "dueDate": va = a.dueDate ?? ""; vb = b.dueDate ?? ""; break
          case "postType": va = a.postType; vb = b.postType; break
          default: va = 0; vb = 0
        }
        if (va < vb) return sortDir === "asc" ? -1 : 1
        if (va > vb) return sortDir === "asc" ? 1 : -1
        return 0
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

  const addIdea = async () => {
    if (!newTitle.trim() && !newImageDataUrl) return
    const body = {
      title: newTitle,
      description: newDescription,
      postType: newType,
      pilar: newPilar,
      priority: newPriority,
      status: newStatus,
      dueDate: newDueDate || null,
      storyboardId: newStoryboardId || null,
    }
    if (newImageDataUrl) {
      const res = await fetch(`/api/plannings/${planningId}/ideas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, title: newTitle || "Imagen", postType: "IMAGE", platform: "IMAGE", referenceUrl: "", referenceEmbed: newImageDataUrl }),
      })
      if (res.ok) {
        const idea = await res.json()
        setIdeas((prev) => [...prev, idea])
        resetForm()
      }
      return
    }
    const embed = detectEmbed(newUrl)
    const res = await fetch(`/api/plannings/${planningId}/ideas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, platform: embed?.platform ?? newPlatform, referenceUrl: newUrl, referenceEmbed: embed?.embedUrl ?? "" }),
    })
    if (res.ok) {
      const idea = await res.json()
      setIdeas((prev) => [...prev, idea])
      resetForm()
    }
  }

  const resetForm = () => {
    setNewTitle(""); setNewDescription(""); setNewPilar(""); setNewPriority("MEDIUM"); setNewStatus("IDEA"); setNewDueDate(""); setNewStoryboardId(""); setNewUrl(""); setNewImageDataUrl(null); setNewPlatform("OTHER"); setShowForm(false)
  }

  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const pendingRef = useRef<Record<string, Record<string, unknown>>>({})
  const snapshotRef = useRef<Record<string, Idea[]>>({})

  const updateIdea = (ideaId: string, data: Record<string, unknown>) => {
    if (!snapshotRef.current[ideaId]) snapshotRef.current[ideaId] = [...ideas]
    setIdeas((p) => p.map((i) => (i.id === ideaId ? { ...i, ...data } : i)))
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
      })
      if (!res.ok) {
        setIdeas(snapshot)
        toast.error("Error al guardar")
      }
    }, 400)
  }

  const deleteIdea = async (ideaId: string) => {
    await fetch(`/api/plannings/${planningId}/ideas/${ideaId}`, { method: "DELETE" })
    setIdeas((prev) => prev.filter((i) => i.id !== ideaId))
  }

  /** La galería vive en la lista global y en la copia abierta en el editor. */
  const patchIdeaImages = (
    ideaId: string,
    updater: (imgs: Array<{ id: string; order: number }>) => Array<{ id: string; order: number }>,
  ) => {
    setIdeas((prev) => prev.map((i) => (i.id === ideaId ? { ...i, images: updater(i.images ?? []) } : i)))
    setEditingIdea((cur) => (cur && cur.id === ideaId ? { ...cur, images: updater(cur.images ?? []) } : cur))
  }

  const addIdeaImages = async (files: FileList | File[]) => {
    const targetId = editingIdea?.id
    if (!targetId) return
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"))
    if (list.length === 0) return
    setUploadingImages((n) => n + list.length)
    try {
      for (const file of list) {
        try {
          const dataUrl = await compressImage(file)
          const res = await fetch(`/api/plannings/${planningId}/ideas/${targetId}/images`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: dataUrl }),
          })
          if (!res.ok) {
            const err = await res.json().catch(() => null)
            toast.error(err?.error ?? "No se pudo subir una imagen")
            continue
          }
          const image = await res.json()
          patchIdeaImages(targetId, (imgs) => [...imgs, image])
        } catch {
          toast.error("No se pudo leer una de las imágenes")
        }
      }
    } finally {
      setUploadingImages((n) => Math.max(0, n - list.length))
    }
  }

  const removeIdeaImage = async (imageId: string) => {
    const targetId = editingIdea?.id
    if (!targetId) return
    patchIdeaImages(targetId, (imgs) => imgs.filter((img) => img.id !== imageId))
    const res = await fetch(`/api/plannings/${planningId}/ideas/${targetId}/images/${imageId}`, {
      method: "DELETE",
    })
    if (!res.ok) {
      toast.error("No se pudo quitar la imagen")
      patchIdeaImages(targetId, (imgs) => [...imgs, { id: imageId, order: imgs.length }])
    }
  }

  const setIdeaStatus = useCallback(async (ideaId: string, status: string, prevStatus: string) => {
    setIdeas((p) => p.map((i) => (i.id === ideaId ? { ...i, status } : i)))
    const res = await fetch(`/api/plannings/${planningId}/ideas/${ideaId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) {
      setIdeas((p) => p.map((i) => (i.id === ideaId ? { ...i, status: prevStatus } : i)))
      toast.error("Error al guardar")
    }
  }, [planningId])

  const openEditDialog = (idea: Idea) => {
    setEditTitle(idea.title)
    setEditDescription(idea.description)
    setEditType(idea.postType)
    setEditPilar(idea.pilar)
    setEditPriority(idea.priority)
    setEditStatus(idea.status)
    setEditDueDate(idea.dueDate ? idea.dueDate.slice(0, 10) : "")
    setEditUrl(idea.referenceUrl)
    setEditImageDataUrl(idea.referenceEmbed?.startsWith("data:") ? idea.referenceEmbed : null)
    setEditPlatform(idea.platform)
    setEditStoryboardId(idea.storyboardId ?? "")
    setEditingIdea(idea)
  }

  const closeEditDialog = () => {
    setEditingIdea(null)
    setEditImageDataUrl(null)
  }

  const saveEdit = async () => {
    if (!editingIdea) return
    const body: Record<string, unknown> = {
      title: editTitle,
      description: editDescription,
      postType: editType,
      pilar: editPilar,
      priority: editPriority,
      status: editStatus,
      dueDate: editDueDate || null,
      storyboardId: editStoryboardId || null,
    }
    if (editImageDataUrl && editImageDataUrl !== editingIdea.referenceEmbed) {
      body.referenceEmbed = editImageDataUrl
      body.referenceUrl = ""
      body.platform = "IMAGE"
    } else if (!editImageDataUrl && editingIdea.referenceEmbed?.startsWith("data:")) {
      body.referenceEmbed = ""
      body.referenceUrl = ""
      body.platform = "OTHER"
    } else if (editUrl !== editingIdea.referenceUrl) {
      if (editUrl) {
        const embed = detectEmbed(editUrl)
        body.referenceUrl = editUrl
        body.referenceEmbed = embed?.embedUrl ?? ""
        body.platform = embed?.platform ?? editPlatform
      } else {
        body.referenceUrl = ""
        body.referenceEmbed = ""
        body.platform = editPlatform
      }
    } else {
      body.platform = editPlatform
    }
    const res = await fetch(`/api/plannings/${planningId}/ideas/${editingIdea.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      setIdeas((prev) => prev.map((i) => (i.id === editingIdea.id ? { ...i, ...body, contentIdeaTags: i.contentIdeaTags } : i)))
      closeEditDialog()
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
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
    })
    if (!res.ok) {
      setIdeas(prev)
      toast.error("Error al reordenar")
    }
  }

  const renderKanban = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {statusOpts.map((status) => {
        const items = filtered.filter((i) => i.status === status)
        return (
          <div key={status} className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">{ideaStatusLabels[status]} ({items.length})</h4>
            <div className="space-y-2">
              {items.map((idea) => (
                <div key={idea.id} data-idea-id={idea.id} className={`rounded-lg border bg-[#0c0c0e] p-3 ${highlightedIdeaId === idea.id ? "border-white/25 ring-1 ring-inset ring-white/25" : "border-white/5"}`}>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex items-center justify-center w-5 h-5 rounded bg-white/5 border border-white/5">
                        <PlatformIcon platform={idea.platform} />
                      </div>
                      <span className="truncate text-[10px] font-medium text-zinc-400">{postTypeLabel(idea.postType)}</span>
                    </div>
                    <IdeaActionsMenu onEdit={() => openEditDialog(idea)} onDelete={() => deleteIdea(idea.id)} className="h-8 w-8" />
                  </div>
                  <button type="button" className="mt-1 w-full text-left text-sm font-medium text-zinc-200 hover:text-white" onClick={() => openEditDialog(idea)}>{idea.title}</button>
                  {idea.description && <p className="mt-0.5 text-[10px] text-zinc-400 line-clamp-2">{idea.description}</p>}
                  <div className="mt-1 flex items-center gap-1 text-[9px] text-zinc-400">
                    {idea.referenceUrl ? (
                      <a href={idea.referenceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-white truncate" title={idea.referenceUrl}>
                        {idea.referenceEmbed && idea.platform === "IMAGE" ? (
                          <img src={idea.referenceEmbed} alt="" className="w-4 h-4 rounded object-cover" />
                        ) : (
                          <ExternalLink size={9} className="shrink-0" />
                        )}
                        <span className="truncate max-w-[100px]">{idea.referenceEmbed ? platformLabel(idea.platform) : idea.referenceUrl}</span>
                      </a>
                    ) : idea.referenceEmbed ? (
                      <span className="inline-flex items-center gap-1">
                        {idea.platform === "IMAGE" ? (
                          <img src={idea.referenceEmbed} alt="" className="w-4 h-4 rounded object-cover" />
                        ) : (
                          <ExternalLink size={9} />
                        )}
                        <span>{platformLabel(idea.platform)}</span>
                      </span>
                    ) : idea.storyboardId ? (
                      <span className="inline-flex items-center gap-1"><Layout size={9} /> {storyboards.find((s) => s.id === idea.storyboardId)?.title ?? "Storyboard"}</span>
                    ) : null}
                  </div>
                  {idea.dueDate && <p className="mt-1 text-[10px] text-zinc-400">📅 {formatDate(idea.dueDate)}</p>}
                  {(idea.images?.length ?? 0) > 0 && (
                    <span className="mt-1 inline-flex items-center gap-1 text-[9px] text-zinc-400">
                      <Images size={9} /> {idea.images.length} img
                    </span>
                  )}
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {idea.contentIdeaTags?.map((ct) => (
                      <span key={ct.tag.id} className="rounded-full px-1.5 py-0.5 text-[9px] font-medium text-white" style={{ backgroundColor: ct.tag.color }}>{ct.tag.name}</span>
                    ))}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <StatusMenu status={idea.status} onChange={(s) => setIdeaStatus(idea.id, s, idea.status)} />
                    <PriorityMenu priority={idea.priority} onChange={(p) => updateIdea(idea.id, { priority: p })} />
                  </div>
                </div>
              ))}
              {items.length === 0 && <p className="py-4 text-center text-[10px] text-zinc-400">Vacío</p>}
            </div>
          </div>
        )
      })}
    </div>
  )

  return (
    <div className="space-y-3">
      {/* Toolbar: en móvil la búsqueda y la acción principal van arriba,
          y los filtros quedan en una fila que se desliza en horizontal. */}
      <div className="mb-5 space-y-2.5 sm:mb-6">
        <div className="flex items-center gap-2">
          <div className="group relative min-w-0 flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 transition-colors group-focus-within:text-indigo-400" size={16} />
            <input
              type="text"
              placeholder="Buscar ideas..."
              className="h-10 w-full rounded-lg border border-white/10 bg-[#18181b] pl-9 pr-9 text-base text-zinc-200 transition-all placeholder:text-zinc-400 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 sm:h-9 sm:text-sm sm:pr-12"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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
              <div className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400 sm:flex">
                <Command size={10} /> K
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="flex h-10 shrink-0 items-center gap-2 rounded-lg bg-brand px-3 text-sm font-semibold text-white transition-colors hover:bg-[#d0424a] sm:h-9 sm:px-4"
          >
            <Plus size={16} />
            <span className="whitespace-nowrap">Nueva idea</span>
          </button>
        </div>

        <div className="-mx-3 flex items-center gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden">
          <select className={filterSelectClass} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} aria-label="Filtrar por estado">
            <option value="ALL">Estado</option>
            {statusOpts.map((s) => <option key={s} value={s}>{ideaStatusLabels[s]}</option>)}
          </select>
          <select className={filterSelectClass} value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} aria-label="Filtrar por prioridad">
            <option value="ALL">Prioridad</option>
            {priorityOpts.map((p) => <option key={p} value={p}>{priorityLabels[p]}</option>)}
          </select>
          <select className={filterSelectClass} value={filterType} onChange={(e) => setFilterType(e.target.value)} aria-label="Filtrar por formato">
            <option value="ALL">Formato</option>
            {postTypeOpts.map((t) => <option key={t} value={t}>{postTypeLabel(t)}</option>)}
          </select>
          <select className={filterSelectClass} value={filterPlatform} onChange={(e) => setFilterPlatform(e.target.value)} aria-label="Filtrar por plataforma">
            <option value="ALL">Plataforma</option>
            {platformOpts.map((p) => <option key={p} value={p}>{platformLabel(p)}</option>)}
          </select>

          <div className="mx-1 hidden h-5 w-px shrink-0 bg-white/10 sm:block" />

          <select className={toolSelectClass} value={groupBy} onChange={(e) => setGroupBy(e.target.value)} aria-label="Agrupar por">
            <option value="none">Sin agrupar</option>
            <option value="status">Estado</option>
            <option value="priority">Prioridad</option>
            <option value="pilar">Pilar</option>
            <option value="postType">Formato</option>
          </select>

          <div className="relative hidden sm:block">
            <button type="button" onClick={() => setShowColumnSettings(!showColumnSettings)} className={toolButtonClass}>
              <SlidersHorizontal size={14} /> Ver
            </button>
            {showColumnSettings && (
              <div className="absolute right-0 top-full z-40 mt-1 w-44 rounded-lg border border-white/10 bg-[#18181b] p-2 shadow-lg">
                <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Columnas</p>
                {COLUMNS.map((c) => (
                  <label key={c.key} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1.5 text-xs text-zinc-300 hover:bg-white/5">
                    <input type="checkbox" checked={visibleCols.has(c.key)} onChange={() => toggleCol(c.key)} className="rounded border-white/20 bg-zinc-800" />
                    {c.label}
                  </label>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => { setShowColumnSettings(false); setView(view === "table" ? "kanban" : "table") }}
            className={toolButtonClass}
          >
            {view === "table" ? <LayoutGrid size={14} /> : <Table2 size={14} />}
            {view === "table" ? "Board" : "Tabla"}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="rounded-lg border border-white/10 bg-[#0c0c0e] p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-400">Formato</label>
              <select className="w-full rounded-lg border border-white/10 bg-[#18181b] px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/50" value={newType} onChange={(e) => setNewType(e.target.value)}>
                {postTypeOpts.map((t) => <option key={t} value={t}>{postTypeLabel(t)}</option>)}
              </select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-medium text-zinc-400">Tema</label>
              <input className="w-full rounded-lg border border-white/10 bg-[#18181b] px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 placeholder:text-zinc-400" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Ej: Nueva imagen voz en off..." />
            </div>
            <div className="space-y-1 sm:col-span-3">
              <label className="text-xs font-medium text-zinc-400">Objetivo</label>
              <input className="w-full rounded-lg border border-white/10 bg-[#18181b] px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 placeholder:text-zinc-400" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Detalle del objetivo..." />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-400">Pilar</label>
              <input className="w-full rounded-lg border border-white/10 bg-[#18181b] px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 placeholder:text-zinc-400" value={newPilar} onChange={(e) => setNewPilar(e.target.value)} placeholder="Pilar..." list="new-pillar-list" />
              <datalist id="new-pillar-list">
                {pillarOpts.map((p) => <option key={p} value={p} />)}
              </datalist>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-400">Prioridad</label>
              <select className="w-full rounded-lg border border-white/10 bg-[#18181b] px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/50" value={newPriority} onChange={(e) => setNewPriority(e.target.value)}>
                {priorityOpts.map((p) => <option key={p} value={p}>{priorityLabels[p]}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-400">Estado</label>
              <select className="w-full rounded-lg border border-white/10 bg-[#18181b] px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/50" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                {statusOpts.map((s) => <option key={s} value={s}>{ideaStatusLabels[s]}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-400">Plataforma</label>
              <select className="w-full rounded-lg border border-white/10 bg-[#18181b] px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/50" value={newPlatform} onChange={(e) => setNewPlatform(e.target.value)}>
                {platformOpts.map((p) => <option key={p} value={p}>{platformLabel(p)}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-400">Entrega</label>
              <input type="date" className="w-full rounded-lg border border-white/10 bg-[#18181b] px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/50" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-medium text-zinc-400">Referencia</label>
              {newImageDataUrl ? (
                <div className="flex items-center gap-2">
                  <img src={newImageDataUrl} alt="" className="h-12 w-12 rounded object-cover bg-zinc-800" />
                  <button type="button" onClick={() => setNewImageDataUrl(null)} className="text-xs text-zinc-400 hover:text-white">Quitar</button>
                </div>
              ) : (
                <input className="w-full rounded-lg border border-white/10 bg-[#18181b] px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 placeholder:text-zinc-400" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} onPaste={(e) => handleImagePaste(e, setNewImageDataUrl)} placeholder="Pegar URL o imagen (Ctrl+V)..." />
              )}
            </div>
            {storyboards.length > 0 && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-400">Storyboard</label>
              <select className="w-full rounded-lg border border-white/10 bg-[#18181b] px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/50" value={newStoryboardId} onChange={(e) => setNewStoryboardId(e.target.value)}>
                <option value="">Sin storyboard</option>
                {storyboards.map((sb) => <option key={sb.id} value={sb.id}>{sb.title}</option>)}
              </select>
            </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="min-h-10 rounded-lg px-4 text-sm text-zinc-300 hover:bg-white/5 hover:text-white">Cancelar</button>
            <button type="button" onClick={addIdea} className="min-h-10 rounded-lg bg-brand px-5 text-sm font-semibold text-white hover:bg-[#d0424a]">Agregar</button>
          </div>
        </div>
      )}

      {ideas.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-zinc-400">No hay contenido. Agrega la primera fila.</p>
        </div>
      ) : view === "table" ? (
        <>
        {/* Mobile cards */}
        <div className="space-y-3 sm:hidden">
          {filtered.map((idea) => (
            <div key={idea.id} data-idea-id={idea.id} className={`rounded-lg border bg-[#0c0c0e] overflow-hidden ${highlightedIdeaId === idea.id ? "border-white/25 ring-1 ring-inset ring-white/25" : "border-white/5"}`}>
              <div className="space-y-2.5 p-3">
                <div className="flex items-start justify-between gap-2">
                  <button type="button" className="min-h-9 flex-1 text-left text-sm font-medium text-zinc-100 hover:text-white" onClick={() => openEditDialog(idea)}>{idea.title}</button>
                  <IdeaActionsMenu onEdit={() => openEditDialog(idea)} onDelete={() => deleteIdea(idea.id)} />
                </div>

                {idea.description && <p className="text-xs text-zinc-400">{idea.description}</p>}

                {/* Estado y prioridad son editables acá: en el celular no hay tabla donde tocarlos */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <StatusMenu status={idea.status} onChange={(s) => setIdeaStatus(idea.id, s, idea.status)} />
                  <PriorityMenu priority={idea.priority} onChange={(p) => updateIdea(idea.id, { priority: p })} />
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
                  {(idea.images?.length ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-1 rounded bg-white/5 px-1.5 py-1">
                      <Images size={10} /> {idea.images.length}
                    </span>
                  )}
                  {idea.dueDate && (
                    <span className="inline-flex items-center gap-1 rounded bg-white/5 px-1.5 py-1 text-zinc-400">
                      📅 {new Date(idea.dueDate).toLocaleDateString("es-EC")}
                    </span>
                  )}
                </div>

                <div className="text-xs">
                  {idea.referenceUrl ? (
                    <a href={idea.referenceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-white/70 hover:text-white">
                      <ExternalLink size={10} />
                      {idea.referenceEmbed ? platformLabel(idea.platform) : idea.referenceUrl.length > 30 ? idea.referenceUrl.slice(0, 30) + "…" : idea.referenceUrl}
                    </a>
                  ) : idea.referenceEmbed && idea.platform === "IMAGE" ? (
                    <img src={idea.referenceEmbed} alt="" className="h-12 w-12 rounded object-cover bg-white/[0.03]" />
                  ) : idea.storyboardId ? (
                    <span className="inline-flex items-center gap-1 text-zinc-400">
                      <Layout size={10} /> {storyboards.find((s) => s.id === idea.storyboardId)?.title ?? "Storyboard"}
                    </span>
                  ) : null}
                </div>

                {idea.contentIdeaTags && idea.contentIdeaTags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {idea.contentIdeaTags.map((ct) => (
                      <span key={ct.tag.id} className="rounded-full px-1.5 py-0.5 text-[9px] font-medium text-white" style={{ backgroundColor: ct.tag.color }}>{ct.tag.name}</span>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-white/5 pt-2">
                  <button type="button" onClick={() => openEditDialog(idea)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs text-zinc-300 hover:bg-white/5 hover:text-white">
                    <Pencil size={12} /> Editar
                  </button>
                  {idea.comments?.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs text-zinc-400"><MessageSquare size={12} /> {idea.comments.length}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto">
        <div className="min-w-[750px] border border-white/5 rounded-xl overflow-hidden bg-[#0c0c0e]">
          {/* Table Header */}
          <div className="grid grid-cols-[32px_minmax(250px,2fr)_minmax(120px,1fr)_120px_120px_100px_100px_56px] gap-4 px-4 py-3 border-b border-white/5 bg-white/[0.01]">
            <div />
            <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">Tema</div>
            <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">Estado</div>
            <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">Formato</div>
            <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">Referencia</div>
            <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">Pilar</div>
            <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">Prioridad</div>
            <div />
          </div>

          {!mounted ? (
            <div className="flex flex-col">
              {filtered.map((idea) => (
                <div key={idea.id} className="grid grid-cols-[32px_minmax(250px,2fr)_minmax(120px,1fr)_120px_120px_100px_100px_56px] items-center gap-4 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors group">
                  <div />
                  <div className="min-w-0 pr-4">
                    <h3 className="text-sm font-medium text-zinc-100 truncate">{idea.title}</h3>
                    <p className="text-xs text-zinc-400 truncate mt-0.5">{idea.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusIcon status={idea.status} />
                    <span className="text-sm text-zinc-400">{ideaStatusLabels[idea.status]}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-6 h-6 rounded bg-white/5 border border-white/5">
                      <PlatformIcon platform={idea.platform} />
                    </div>
                    <span className="text-sm text-zinc-300">{postTypeLabel(idea.postType)}</span>
                  </div>
                  <div className="min-w-0">
                    {idea.referenceUrl && (
                      <a href={idea.referenceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-zinc-400 hover:text-white truncate max-w-full" title={idea.referenceUrl}>
                        {idea.referenceEmbed && idea.platform === "IMAGE" ? (
                          <img src={idea.referenceEmbed} alt="" className="w-6 h-6 rounded object-cover shrink-0" />
                        ) : (
                          <ExternalLink size={10} className="shrink-0" />
                        )}
                        {idea.referenceEmbed ? platformLabel(idea.platform) : idea.referenceUrl.length > 20 ? idea.referenceUrl.slice(0, 20) + "…" : idea.referenceUrl}
                      </a>
                    )}
                    {!idea.referenceUrl && idea.referenceEmbed && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-zinc-400 truncate">
                        {idea.platform === "IMAGE" ? (
                          <img src={idea.referenceEmbed} alt="" className="w-6 h-6 rounded object-cover shrink-0" />
                        ) : (
                          <ExternalLink size={10} className="shrink-0" />
                        )}
                        {platformLabel(idea.platform)}
                      </span>
                    )}
                    {!idea.referenceUrl && !idea.referenceEmbed && idea.storyboardId && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-zinc-400">
                        <Layout size={10} />
                        {storyboards.find((s) => s.id === idea.storyboardId)?.title ?? "Storyboard"}
                      </span>
                    )}
                    {!idea.referenceUrl && !idea.referenceEmbed && !idea.storyboardId && (
                      <span className="text-[10px] text-zinc-700">—</span>
                    )}
                  </div>
                  <div>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-800/50 text-zinc-400 text-xs font-medium border border-white/5">
                      <Hash size={10} className="text-zinc-500" />
                      {idea.pilar || "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <PriorityIcon priority={idea.priority} />
                    <span className={`text-sm ${idea.priority === "HIGH" ? "text-zinc-300" : "text-zinc-400"}`}>{priorityLabels[idea.priority]}</span>
                  </div>
                  <div />
                </div>
              ))}
            </div>
          ) : groupBy !== "none" && grouped ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <div className="flex flex-col">
                {grouped.map(([key, items]) => (
                  <div key={key}>
                    <div className="px-4 py-2 bg-white/[0.02] border-b border-white/5">
                      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{groupLabel(groupBy, key)} <span className="font-normal text-[10px]">({items.length})</span></span>
                    </div>
                    <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                      {items.map((idea) => (
                        <SortableRow key={idea.id} idea={idea} updateIdea={updateIdea} deleteIdea={deleteIdea} onStatusChange={setIdeaStatus} search={search} storyboards={storyboards} onEdit={openEditDialog} cols={visibleCols} highlighted={highlightedIdeaId === idea.id} />
                      ))}
                    </SortableContext>
                  </div>
                ))}
              </div>
            </DndContext>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={filtered.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col">
                  {filtered.map((idea) => (
                    <SortableRow key={idea.id} idea={idea} updateIdea={updateIdea} deleteIdea={deleteIdea} onStatusChange={setIdeaStatus} search={search} storyboards={storyboards} onEdit={openEditDialog} cols={visibleCols} highlighted={highlightedIdeaId === idea.id} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
        </div>
        </>
      ) : (
        renderKanban()
      )}

      {editingIdea && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60" onClick={closeEditDialog} />
          <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-white/10 bg-[#0c0c0e] shadow-xl">
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4 sm:px-5 sm:pt-4">
              <h3 className="text-lg font-semibold text-zinc-100">Editar contenido</h3>
              <button type="button" onClick={closeEditDialog} className="rounded-md p-1 hover:bg-white/5 text-zinc-400"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-400">Formato</label>
                  <select className="w-full rounded-lg border border-white/10 bg-[#18181b] px-3 py-2 text-sm text-zinc-200 focus:outline-none" value={editType} onChange={(e) => setEditType(e.target.value)}>
                    {postTypeOpts.map((t) => <option key={t} value={t}>{postTypeLabel(t)}</option>)}
                  </select>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-medium text-zinc-400">Tema</label>
                  <input className="w-full rounded-lg border border-white/10 bg-[#18181b] px-3 py-2 text-sm text-zinc-200 focus:outline-none placeholder:text-zinc-400" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                </div>
                <div className="space-y-1 sm:col-span-3">
                  <label className="text-xs font-medium text-zinc-400">Objetivo</label>
                  <input className="w-full rounded-lg border border-white/10 bg-[#18181b] px-3 py-2 text-sm text-zinc-200 focus:outline-none placeholder:text-zinc-400" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-400">Pilar</label>
                  <input className="w-full rounded-lg border border-white/10 bg-[#18181b] px-3 py-2 text-sm text-zinc-200 focus:outline-none placeholder:text-zinc-400" value={editPilar} onChange={(e) => setEditPilar(e.target.value)} list="edit-pillar-list" />
                  <datalist id="edit-pillar-list">{pillarOpts.map((p) => <option key={p} value={p} />)}</datalist>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-400">Prioridad</label>
                  <select className="w-full rounded-lg border border-white/10 bg-[#18181b] px-3 py-2 text-sm text-zinc-200 focus:outline-none" value={editPriority} onChange={(e) => setEditPriority(e.target.value)}>
                    {priorityOpts.map((p) => <option key={p} value={p}>{priorityLabels[p]}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-400">Estado</label>
                  <select className="w-full rounded-lg border border-white/10 bg-[#18181b] px-3 py-2 text-sm text-zinc-200 focus:outline-none" value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                    {statusOpts.map((s) => <option key={s} value={s}>{ideaStatusLabels[s]}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-400">Plataforma</label>
                  <select className="w-full rounded-lg border border-white/10 bg-[#18181b] px-3 py-2 text-sm text-zinc-200 focus:outline-none" value={editPlatform} onChange={(e) => setEditPlatform(e.target.value)}>
                    {platformOpts.map((p) => <option key={p} value={p}>{platformLabel(p)}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-400">Entrega</label>
                  <input type="date" className="w-full rounded-lg border border-white/10 bg-[#18181b] px-3 py-2 text-sm text-zinc-200 focus:outline-none" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-medium text-zinc-400">Referencia</label>
                  {editImageDataUrl ? (
                    <div className="flex items-center gap-2">
                      <img src={editImageDataUrl} alt="" className="h-12 w-12 rounded object-cover bg-zinc-800" />
                      <button type="button" onClick={() => { setEditImageDataUrl(null); setEditUrl("") }} className="text-xs text-zinc-400 hover:text-white">Quitar</button>
                    </div>
                  ) : (
                    <input className="w-full rounded-lg border border-white/10 bg-[#18181b] px-3 py-2 text-sm text-zinc-200 focus:outline-none placeholder:text-zinc-400" value={editUrl} onChange={(e) => setEditUrl(e.target.value)} onPaste={(e) => handleImagePaste(e, setEditImageDataUrl)} />
                  )}
                </div>
                {storyboards.length > 0 && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-400">Storyboard</label>
                  <select className="w-full rounded-lg border border-white/10 bg-[#18181b] px-3 py-2 text-sm text-zinc-200 focus:outline-none" value={editStoryboardId} onChange={(e) => setEditStoryboardId(e.target.value)}>
                    <option value="">Sin storyboard</option>
                    {storyboards.map((sb) => <option key={sb.id} value={sb.id}>{sb.title}</option>)}
                  </select>
                </div>
                )}
              </div>

              {/* Galería: soltar varias imágenes a la vez, verlas y quitarlas una por una */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-400">Imágenes</label>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => galleryInputRef.current?.click()}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") galleryInputRef.current?.click() }}
                  onDragOver={(e) => { e.preventDefault(); setGalleryDragOver(true) }}
                  onDragLeave={() => setGalleryDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setGalleryDragOver(false); addIdeaImages(e.dataTransfer.files) }}
                  className={`flex min-h-16 cursor-pointer items-center justify-center rounded-lg border border-dashed px-4 py-4 text-center transition-colors ${
                    galleryDragOver ? "border-white/40 bg-white/[0.06]" : "border-white/10 hover:border-white/20"
                  }`}
                >
                  <div>
                    <p className="text-xs text-zinc-400">
                      {uploadingImages > 0 ? `Subiendo… (${uploadingImages})` : "Arrastra imágenes acá o haz clic para elegir"}
                    </p>
                    {!galleryDragOver && uploadingImages === 0 && (
                      <p className="mt-0.5 text-[10px] text-zinc-500">Puedes soltar varias a la vez</p>
                    )}
                  </div>
                </div>
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  aria-label="Agregar imágenes"
                  onChange={(e) => {
                    const files = e.target.files
                    e.target.value = ""
                    if (files && editingIdea) addIdeaImages(files)
                  }}
                />
                {(editingIdea?.images?.length ?? 0) > 0 && (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {(editingIdea?.images ?? []).map((img) => (
                      <div key={img.id} className="group relative overflow-hidden rounded-lg border border-white/10 bg-zinc-900">
                        <img
                          src={ideaImageUrl(img.id)}
                          alt=""
                          loading="lazy"
                          className="h-20 w-full cursor-pointer object-cover transition-opacity hover:opacity-80"
                          onClick={() => setPreviewImage(ideaImageUrl(img.id))}
                        />
                        <button
                          type="button"
                          aria-label="Quitar imagen"
                          onClick={() => removeIdeaImage(img.id)}
                          className="absolute right-1 top-1 rounded-md bg-black/70 p-1 text-zinc-100 transition-colors hover:bg-black hover:text-white sm:opacity-0 sm:group-hover:opacity-100"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-t border-white/10 bg-[#0c0c0e] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-5">
              <button type="button" onClick={closeEditDialog} className="min-h-10 rounded-lg px-4 text-sm text-zinc-300 hover:bg-white/5 hover:text-white">Cancelar</button>
              <button type="button" onClick={saveEdit} className="min-h-10 rounded-lg bg-brand px-5 text-sm font-semibold text-white hover:bg-[#d0424a]">Guardar</button>
            </div>
          </div>
        </>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 flex-wrap text-xs text-zinc-400">
        <p>Mostrando {filtered.length} de {ideas.length} ideas.</p>
        <div className="flex gap-3 sm:gap-4">
          <button type="button" onClick={() => setShowColumnSettings(true)} className="hidden items-center gap-1 transition-colors hover:text-zinc-200 sm:flex"><SlidersHorizontal size={12} /> Gestionar columnas</button>
          <span className="hidden sm:flex items-center gap-1"><Play className="h-3 w-3" /> YouTube/Vimeo</span>
          <span className="hidden sm:flex items-center gap-1"><ExternalLink className="h-3 w-3" /> TikTok/IG/FB</span>
        </div>
      </div>

      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setPreviewImage(null)}>
          <img src={previewImage} alt="Vista previa" className="max-h-[90vh] max-w-[90vw] rounded object-contain" />
        </div>
      )}
    </div>
  )
}

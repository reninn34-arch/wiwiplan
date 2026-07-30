"use client"

import { useState, useMemo, useEffect, useRef, type ClipboardEvent } from "react"
import {
  Plus, Trash2, ExternalLink, GripVertical, X, Play, Search, Columns3, Table2, MessageSquare, Send,
  ArrowUp, LayoutGrid, Bell, CheckCircle2, Circle,
  MonitorPlay, Smartphone, Hash, SlidersHorizontal, Command, Globe, Camera, ChevronRight, Layout,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { detectEmbed, platformLabel, postTypeLabel } from "@/lib/embeds"
import { TagInput } from "./TagInput"
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

function priorityColor(p: string) {
  switch (p) {
    case "HIGH": return "text-red-600 dark:text-red-400"
    case "MEDIUM": return "text-amber-600 dark:text-amber-400"
    case "LOW": return "text-green-600 dark:text-green-400"
    default: return "text-muted-foreground"
  }
}

function statusColor(s: string) {
  const map: Record<string, string> = {
    IDEA: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    SELECTED: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200",
    IN_PRODUCTION: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200",
    DONE: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200",
  }
  return map[s] ?? "bg-gray-100 text-gray-700"
}

function formatDate(d: string | null) {
  if (!d) return ""
  return new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })
}

function handleImagePaste(e: ClipboardEvent<HTMLInputElement>, onDataUrl: (url: string) => void) {
  const file = e.clipboardData.files?.[0]
  if (file && file.type.startsWith("image/")) {
    e.preventDefault()
    const reader = new FileReader()
    reader.onload = () => { if (typeof reader.result === "string") onDataUrl(reader.result) }
    reader.readAsDataURL(file)
    return
  }
  for (const item of e.clipboardData.items) {
    if (item.type.startsWith("image/")) {
      e.preventDefault()
      const file2 = item.getAsFile()
      if (!file2) return
      const reader = new FileReader()
      reader.onload = () => { if (typeof reader.result === "string") onDataUrl(reader.result) }
      reader.readAsDataURL(file2)
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
}

interface Props {
  planningId: string
  ideas: Idea[]
  storyboards: Array<{ id: string; title: string }>
}

function SortableRow({ idea, updateIdea, deleteIdea, setPreviewImage, search, onUpdateTags, storyboards, onEdit, cols }: {
  idea: Idea
  updateIdea: (id: string, data: Record<string, unknown>) => void
  deleteIdea: (id: string) => void
  setPreviewImage: (url: string | null) => void
  search: string
  onUpdateTags: (ideaId: string, tagIds: string[]) => void
  storyboards: Array<{ id: string; title: string }>
  onEdit: (idea: Idea) => void
  cols: Set<string>
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: idea.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const [showComments, setShowComments] = useState(false)
  const tagIds = idea.contentIdeaTags?.map((ct) => ct.tag.id) ?? []

  if (search && !idea.title.toLowerCase().includes(search) && !idea.description.toLowerCase().includes(search)) {
    return null
  }

  return (
    <>
    <div ref={setNodeRef} style={style} className="grid grid-cols-[32px_minmax(250px,2fr)_minmax(120px,1fr)_120px_120px_100px_100px_48px] items-center gap-4 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors group cursor-pointer">
      <div className="flex items-center justify-center text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab hover:text-zinc-300" suppressHydrationWarning {...attributes} {...listeners}>
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
            className="w-full bg-transparent text-xs text-zinc-500 focus:outline-none truncate mt-0.5"
            value={idea.description}
            onChange={(e) => updateIdea(idea.id, { description: e.target.value })}
            placeholder="Objetivo / detalle..."
          />
        ) : (
          <p className="text-xs text-zinc-500 truncate mt-0.5">{idea.description}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        {cols.has("status") ? (
          <select
            className="rounded border-0 bg-transparent text-[11px] font-medium text-zinc-400 focus:outline-none"
            value={idea.status}
            onChange={(e) => updateIdea(idea.id, { status: e.target.value })}
          >
            {statusOpts.map((s) => <option key={s} value={s}>{ideaStatusLabels[s]}</option>)}
          </select>
        ) : (
          <>
            <StatusIcon status={idea.status} />
            <span className="text-sm text-zinc-400">{ideaStatusLabels[idea.status]}</span>
          </>
        )}
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
          <a href={idea.referenceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-zinc-500 hover:text-white truncate max-w-full group/link" title={idea.referenceUrl}>
            {idea.referenceEmbed && idea.platform === "IMAGE" ? (
              <img src={idea.referenceEmbed} alt="" className="w-6 h-6 rounded object-cover shrink-0" />
            ) : (
              <ExternalLink size={10} className="shrink-0" />
            )}
            {idea.referenceEmbed ? platformLabel(idea.platform) : idea.referenceUrl.length > 20 ? idea.referenceUrl.slice(0, 20) + "…" : idea.referenceUrl}
          </a>
        )}
        {!idea.referenceUrl && idea.referenceEmbed && (
          <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500 truncate">
            {idea.platform === "IMAGE" ? (
              <img src={idea.referenceEmbed} alt="" className="w-6 h-6 rounded object-cover shrink-0" />
            ) : (
              <ExternalLink size={10} className="shrink-0" />
            )}
            {platformLabel(idea.platform)}
          </span>
        )}
        {!idea.referenceUrl && !idea.referenceEmbed && idea.storyboardId ? (
          <button type="button" onClick={() => onEdit(idea)} className="inline-flex items-center gap-1 text-[10px] text-zinc-500 hover:text-white truncate">
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

      <div className="flex items-center gap-1.5">
        {cols.has("priority") ? (
          <select
            className={`rounded border-0 bg-transparent text-[10px] font-semibold focus:outline-none ${priorityColor(idea.priority)}`}
            value={idea.priority}
            onChange={(e) => updateIdea(idea.id, { priority: e.target.value })}
          >
            {priorityOpts.map((p) => <option key={p} value={p}>{priorityLabels[p]}</option>)}
          </select>
        ) : (
          <>
            <PriorityIcon priority={idea.priority} />
            <span className={`text-sm ${idea.priority === "HIGH" ? "text-zinc-300" : "text-zinc-500"}`}>{priorityLabels[idea.priority]}</span>
          </>
        )}
      </div>

      <div className="flex items-center justify-end gap-2">
        {idea.comments?.length > 0 && (
          <button type="button" onClick={() => setShowComments((p) => !p)} className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300" title="Comentarios del cliente">
            <MessageSquare size={12} />
            {idea.comments.length}
          </button>
        )}
        <button type="button" onClick={() => onEdit(idea)} className="p-1.5 rounded hover:bg-white/10 text-zinc-500 hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-all">
          <ExternalLink size={14} />
        </button>
        <button type="button" onClick={() => deleteIdea(idea.id)} className="p-1.5 rounded hover:bg-white/10 text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
    {showComments && (
      <div className="border-b border-white/5 bg-white/[0.01] px-12 py-3">
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {(idea.comments?.length ?? 0) === 0 && <p className="text-xs text-zinc-500">Sin comentarios del cliente.</p>}
          {idea.comments?.map((c) => (
            <div key={c.id} className="rounded-lg border border-white/5 bg-[#0c0c0e] px-3 py-2">
              <p className="text-xs font-medium text-zinc-300">{c.authorName}</p>
              <p className="text-sm text-zinc-400">{c.text}</p>
              <p className="text-[10px] text-zinc-600">{new Date(c.createdAt).toLocaleString("es-AR")}</p>
            </div>
          ))}
        </div>
      </div>
    )}
    </>
  )
}

export function ContentIdeasTab({ planningId, ideas: initial, storyboards }: Props) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

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
  const [sortKey, setSortKey] = useState<SortKey>("order")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
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

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      if (sortDir === "asc") { setSortDir("desc"); setSortKey(key) }
      else { setSortDir("asc"); setSortKey(null) }
    } else {
      setSortKey(key); setSortDir("asc")
    }
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
      const updated = await res.json()
      setIdeas((prev) => prev.map((i) => (i.id === editingIdea.id ? { ...i, ...body, contentIdeaTags: i.contentIdeaTags } : i)))
      closeEditDialog()
    }
  }

  const updateTagsGlobally = (ideaId: string, tagIds: string[]) => {
    fetch(`/api/ideas/${ideaId}/tags`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagIds }),
    })
    setIdeas((prev) => prev.map((i) => i.id === ideaId ? { ...i, contentIdeaTags: tagIds.map((tid) => ({ tag: { id: tid, name: tid, color: "#6366f1" } })) } : i))
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
                <div key={idea.id} className="rounded-lg border border-white/5 bg-[#0c0c0e] p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center w-5 h-5 rounded bg-white/5 border border-white/5">
                        <PlatformIcon platform={idea.platform} />
                      </div>
                      <span className="text-[10px] font-medium text-zinc-500">{postTypeLabel(idea.postType)}</span>
                    </div>
                    <button type="button" onClick={() => deleteIdea(idea.id)} className="text-zinc-600 hover:text-red-400"><Trash2 size={12} /></button>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <StatusIcon status={idea.status} />
                    <p className="cursor-pointer text-xs font-medium text-zinc-200 hover:text-white" onClick={() => openEditDialog(idea)}>{idea.title}</p>
                  </div>
                  {idea.description && <p className="mt-0.5 text-[10px] text-zinc-500 line-clamp-2">{idea.description}</p>}
                  <div className="mt-1 flex items-center gap-1 text-[9px] text-zinc-600">
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
                  {idea.dueDate && <p className="mt-1 text-[10px] text-zinc-600">📅 {formatDate(idea.dueDate)}</p>}
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {idea.contentIdeaTags?.map((ct) => (
                      <span key={ct.tag.id} className="rounded-full px-1.5 py-0.5 text-[9px] font-medium text-white" style={{ backgroundColor: ct.tag.color }}>{ct.tag.name}</span>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-1">
                    {statusOpts.filter((s) => s !== status).map((s) => (
                      <button key={s} type="button" onClick={() => updateIdea(idea.id, { status: s })} className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] text-zinc-400 hover:bg-white/10 hover:text-zinc-200">{ideaStatusLabels[s]}</button>
                    ))}
                  </div>
                </div>
              ))}
              {items.length === 0 && <p className="py-4 text-center text-[10px] text-zinc-600">Vacío</p>}
            </div>
          </div>
        )
      })}
    </div>
  )

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6">

        <div className="flex items-center gap-2 flex-1">
          {/* Command-style Search */}
          <div className="relative group w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-indigo-400 transition-colors" size={16} />
            <input
              type="text"
              placeholder="Buscar ideas..."
              className="w-full bg-[#18181b] border border-white/10 rounded-lg pl-9 pr-12 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all placeholder:text-zinc-600 text-zinc-200"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-[10px] text-zinc-500 font-medium">
              <Command size={10} /> K
            </div>
          </div>

          <div className="h-4 w-px bg-white/10 mx-2" />

          <select className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-transparent hover:bg-white/5 text-sm font-medium text-zinc-400 transition-colors border border-dashed border-white/10 hover:border-white/20 focus:outline-none" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="ALL">Estado</option>
            {statusOpts.map((s) => <option key={s} value={s}>{ideaStatusLabels[s]}</option>)}
          </select>
          <select className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-transparent hover:bg-white/5 text-sm font-medium text-zinc-400 transition-colors border border-dashed border-white/10 hover:border-white/20 focus:outline-none" value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
            <option value="ALL">Prioridad</option>
            {priorityOpts.map((p) => <option key={p} value={p}>{priorityLabels[p]}</option>)}
          </select>
          <select className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-transparent hover:bg-white/5 text-sm font-medium text-zinc-400 transition-colors border border-dashed border-white/10 hover:border-white/20 focus:outline-none" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="ALL">Formato</option>
            {postTypeOpts.map((t) => <option key={t} value={t}>{postTypeLabel(t)}</option>)}
          </select>
          <select className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-transparent hover:bg-white/5 text-sm font-medium text-zinc-400 transition-colors border border-dashed border-white/10 hover:border-white/20 focus:outline-none" value={filterPlatform} onChange={(e) => setFilterPlatform(e.target.value)}>
            <option value="ALL">Plataforma</option>
            {platformOpts.map((p) => <option key={p} value={p}>{platformLabel(p)}</option>)}
          </select>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          <select className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/5 text-sm font-medium text-zinc-400 transition-colors focus:outline-none" value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
            <option value="none">Sin agrupar</option>
            <option value="status">Estado</option>
            <option value="priority">Prioridad</option>
            <option value="pilar">Pilar</option>
            <option value="postType">Formato</option>
          </select>
          <div className="relative">
            <button type="button" onClick={() => setShowColumnSettings(!showColumnSettings)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/5 text-sm font-medium text-zinc-400 transition-colors">
              <SlidersHorizontal size={14} /> Ver
            </button>
            {showColumnSettings && (
              <div className="absolute right-0 top-full z-40 mt-1 w-44 rounded-lg border border-white/10 bg-[#18181b] p-2 shadow-lg">
                <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Columnas</p>
                {COLUMNS.map((c) => (
                  <label key={c.key} className="flex items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-white/5 cursor-pointer text-zinc-400">
                    <input type="checkbox" checked={visibleCols.has(c.key)} onChange={() => toggleCol(c.key)} className="rounded border-white/20 bg-zinc-800" />
                    {c.label}
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="h-4 w-px bg-white/10 mx-1" />
          <button
            type="button"
            onClick={() => { setShowColumnSettings(false); setView(view === "table" ? "kanban" : "table") }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/5 text-sm font-medium text-zinc-400 transition-colors"
          >
            {view === "table" ? <LayoutGrid size={14} /> : <Table2 size={14} />}
            {view === "table" ? "Board" : "Tabla"}
          </button>
          <button type="button" onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-white text-black px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-zinc-200 transition-colors shadow-[0_0_15px_rgba(255,255,255,0.1)]">
            <Plus size={16} /> Nueva Idea
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
              <input className="w-full rounded-lg border border-white/10 bg-[#18181b] px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 placeholder:text-zinc-600" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Ej: Nueva imagen voz en off..." />
            </div>
            <div className="space-y-1 sm:col-span-3">
              <label className="text-xs font-medium text-zinc-400">Objetivo</label>
              <input className="w-full rounded-lg border border-white/10 bg-[#18181b] px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 placeholder:text-zinc-600" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Detalle del objetivo..." />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-400">Pilar</label>
              <input className="w-full rounded-lg border border-white/10 bg-[#18181b] px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 placeholder:text-zinc-600" value={newPilar} onChange={(e) => setNewPilar(e.target.value)} placeholder="Pilar..." list="new-pillar-list" />
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
                <input className="w-full rounded-lg border border-white/10 bg-[#18181b] px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 placeholder:text-zinc-600" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} onPaste={(e) => handleImagePaste(e, setNewImageDataUrl)} placeholder="Pegar URL o imagen (Ctrl+V)..." />
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
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-white/5">Cancelar</button>
            <button type="button" onClick={addIdea} className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-white text-black hover:bg-zinc-200">Agregar</button>
          </div>
        </div>
      )}

      {ideas.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-zinc-500">No hay contenido. Agregá la primera fila.</p>
        </div>
      ) : view === "table" ? (
        <div className="overflow-x-auto">
        <div className="min-w-[750px] border border-white/5 rounded-xl overflow-hidden bg-[#0c0c0e]">
          {/* Table Header */}
          <div className="grid grid-cols-[32px_minmax(250px,2fr)_minmax(120px,1fr)_120px_120px_100px_100px_48px] gap-4 px-4 py-3 border-b border-white/5 bg-white/[0.01]">
            <div />
            <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">Tema</div>
            <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">Estado</div>
            <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">Formato</div>
            <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">Referencia</div>
            <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">Pilar</div>
            <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">Prioridad</div>
            <div />
          </div>

          {!mounted ? (
            <div className="flex flex-col">
              {filtered.map((idea) => (
                <div key={idea.id} className="grid grid-cols-[32px_minmax(250px,2fr)_minmax(120px,1fr)_120px_120px_100px_100px_48px] items-center gap-4 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors group">
                  <div />
                  <div className="min-w-0 pr-4">
                    <h3 className="text-sm font-medium text-zinc-100 truncate">{idea.title}</h3>
                    <p className="text-xs text-zinc-500 truncate mt-0.5">{idea.description}</p>
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
                      <a href={idea.referenceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-zinc-500 hover:text-white truncate max-w-full" title={idea.referenceUrl}>
                        {idea.referenceEmbed && idea.platform === "IMAGE" ? (
                          <img src={idea.referenceEmbed} alt="" className="w-6 h-6 rounded object-cover shrink-0" />
                        ) : (
                          <ExternalLink size={10} className="shrink-0" />
                        )}
                        {idea.referenceEmbed ? platformLabel(idea.platform) : idea.referenceUrl.length > 20 ? idea.referenceUrl.slice(0, 20) + "…" : idea.referenceUrl}
                      </a>
                    )}
                    {!idea.referenceUrl && idea.referenceEmbed && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500 truncate">
                        {idea.platform === "IMAGE" ? (
                          <img src={idea.referenceEmbed} alt="" className="w-6 h-6 rounded object-cover shrink-0" />
                        ) : (
                          <ExternalLink size={10} className="shrink-0" />
                        )}
                        {platformLabel(idea.platform)}
                      </span>
                    )}
                    {!idea.referenceUrl && !idea.referenceEmbed && idea.storyboardId && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-zinc-600">
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
                    <span className={`text-sm ${idea.priority === "HIGH" ? "text-zinc-300" : "text-zinc-500"}`}>{priorityLabels[idea.priority]}</span>
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
                      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{key} <span className="font-normal text-[10px]">({items.length})</span></span>
                    </div>
                    <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                      {items.map((idea) => (
                        <SortableRow key={idea.id} idea={idea} updateIdea={updateIdea} deleteIdea={deleteIdea} setPreviewImage={setPreviewImage} search={search} onUpdateTags={updateTagsGlobally} storyboards={storyboards} onEdit={openEditDialog} cols={visibleCols} />
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
                    <SortableRow key={idea.id} idea={idea} updateIdea={updateIdea} deleteIdea={deleteIdea} setPreviewImage={setPreviewImage} search={search} onUpdateTags={updateTagsGlobally} storyboards={storyboards} onEdit={openEditDialog} cols={visibleCols} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
        </div>
      ) : (
        renderKanban()
      )}

      {editingIdea && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60" onClick={closeEditDialog} />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg border-l border-white/10 bg-[#0c0c0e] shadow-xl overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <h3 className="text-lg font-semibold text-zinc-100">Editar contenido</h3>
              <button type="button" onClick={closeEditDialog} className="rounded-md p-1 hover:bg-white/5 text-zinc-400"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4 p-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-400">Formato</label>
                  <select className="w-full rounded-lg border border-white/10 bg-[#18181b] px-3 py-2 text-sm text-zinc-200 focus:outline-none" value={editType} onChange={(e) => setEditType(e.target.value)}>
                    {postTypeOpts.map((t) => <option key={t} value={t}>{postTypeLabel(t)}</option>)}
                  </select>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-medium text-zinc-400">Tema</label>
                  <input className="w-full rounded-lg border border-white/10 bg-[#18181b] px-3 py-2 text-sm text-zinc-200 focus:outline-none placeholder:text-zinc-600" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                </div>
                <div className="space-y-1 sm:col-span-3">
                  <label className="text-xs font-medium text-zinc-400">Objetivo</label>
                  <input className="w-full rounded-lg border border-white/10 bg-[#18181b] px-3 py-2 text-sm text-zinc-200 focus:outline-none placeholder:text-zinc-600" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-400">Pilar</label>
                  <input className="w-full rounded-lg border border-white/10 bg-[#18181b] px-3 py-2 text-sm text-zinc-200 focus:outline-none placeholder:text-zinc-600" value={editPilar} onChange={(e) => setEditPilar(e.target.value)} list="edit-pillar-list" />
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
                    <input className="w-full rounded-lg border border-white/10 bg-[#18181b] px-3 py-2 text-sm text-zinc-200 focus:outline-none placeholder:text-zinc-600" value={editUrl} onChange={(e) => setEditUrl(e.target.value)} onPaste={(e) => handleImagePaste(e, setEditImageDataUrl)} />
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
            </div>
            <div className="sticky bottom-0 border-t border-white/10 bg-[#0c0c0e] px-5 py-4 flex justify-end gap-2">
              <button type="button" onClick={closeEditDialog} className="px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-white/5">Cancelar</button>
              <button type="button" onClick={saveEdit} className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-white text-black hover:bg-zinc-200">Guardar</button>
            </div>
          </div>
        </>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-zinc-600">
        <p>Mostrando {filtered.length} de {ideas.length} ideas.</p>
        <div className="flex gap-4">
          <span className="flex items-center gap-1 hover:text-zinc-400 cursor-pointer transition-colors"><Command size={12} /> Gestionar columnas</span>
          <span className="flex items-center gap-1"><Play className="h-3 w-3" /> YouTube/Vimeo</span>
          <span className="flex items-center gap-1"><ExternalLink className="h-3 w-3" /> TikTok/IG/FB</span>
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

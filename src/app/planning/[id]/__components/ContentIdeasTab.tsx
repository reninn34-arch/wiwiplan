"use client"

import { useState, useMemo, useEffect, useRef, type ClipboardEvent } from "react"
import {
  Plus, Trash2, ExternalLink, GripVertical, X, Play, Search, Columns3, Table2, MessageSquare, Send,
  ArrowUpDown, ArrowUp, ArrowDown, Settings, LayoutGrid,
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
    <tr ref={setNodeRef} style={style} className="border-b last:border-0 hover:bg-muted/30">
      <td className="w-8 px-2 py-2">
        <button type="button" className="cursor-grab active:cursor-grabbing p-0.5" suppressHydrationWarning {...attributes} {...listeners}>
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </td>
      {cols.has("postType") && (
        <td className="px-2 py-2">
          <select
            className="rounded bg-muted px-1 py-0.5 text-[9px] font-medium text-muted-foreground focus:outline-none"
            value={idea.postType}
            onChange={(e) => updateIdea(idea.id, { postType: e.target.value })}
          >
            {postTypeOpts.map((t) => <option key={t} value={t}>{postTypeLabel(t)}</option>)}
          </select>
        </td>
      )}
      {cols.has("title") && (
        <td className="px-2 py-2">
          <input
            className="min-w-0 w-full bg-transparent text-sm font-medium focus:outline-none cursor-pointer"
            value={idea.title}
            onClick={() => onEdit(idea)}
            onChange={(e) => updateIdea(idea.id, { title: e.target.value })}
            placeholder="Tema..."
          />
        </td>
      )}
      {cols.has("description") && (
        <td className="px-2 py-2">
          <input
            className="w-full bg-transparent text-xs text-muted-foreground focus:outline-none"
            value={idea.description}
            onChange={(e) => updateIdea(idea.id, { description: e.target.value })}
            placeholder="Objetivo / detalle..."
          />
        </td>
      )}
      {cols.has("reference") && (
        <td className="px-2 py-2">
          <div className="flex items-center gap-1">
            {idea.referenceEmbed && (idea.platform === "YOUTUBE" || idea.platform === "VIMEO") ? (
              <div className="aspect-video w-14 shrink-0 rounded overflow-hidden bg-muted">
                <iframe src={idea.referenceEmbed} className="h-full w-full" allowFullScreen title={idea.title} />
              </div>
            ) : idea.referenceEmbed && idea.platform === "IMAGE" ? (
              <button type="button" onClick={() => setPreviewImage(idea.referenceEmbed)} className="shrink-0">
                <img src={idea.referenceEmbed} alt={idea.title} className="h-7 w-7 shrink-0 rounded object-cover bg-muted cursor-pointer hover:opacity-80 transition-opacity" />
              </button>
            ) : null}
            <div className="min-w-0 flex-1 flex items-center gap-1">
              <span className="shrink-0 rounded bg-muted px-1 py-0.5 text-[9px] font-medium text-muted-foreground">{platformLabel(idea.platform)}</span>
              <input
                className="min-w-0 flex-1 bg-transparent text-xs focus:outline-none"
                value={idea.referenceUrl}
                onChange={(e) => { const val = e.target.value; updateIdea(idea.id, { referenceUrl: val }); const embed = detectEmbed(val); if (embed) setTimeout(() => updateIdea(idea.id, { referenceEmbed: embed.embedUrl, platform: embed.platform }), 100) }}
                onPaste={(e) => handleImagePaste(e, (dataUrl) => updateIdea(idea.id, { referenceEmbed: dataUrl, referenceUrl: "", platform: "IMAGE" }))}
                placeholder="URL..."
              />
              {idea.referenceUrl ? (
                <button type="button" onClick={() => updateIdea(idea.id, { referenceUrl: "", referenceEmbed: "" })} className="shrink-0"><X className="h-3 w-3 text-destructive" /></button>
              ) : idea.referenceEmbed ? (
                <button type="button" onClick={() => updateIdea(idea.id, { referenceEmbed: "", platform: "OTHER" })} className="shrink-0"><X className="h-3 w-3 text-destructive" /></button>
              ) : null}
            </div>
            {storyboards.length > 0 && (
            <div className="flex items-center gap-1 mt-1">
              <span className="shrink-0 rounded bg-muted px-1 py-0.5 text-[9px] font-medium text-muted-foreground">SB</span>
              <select
                className="min-w-0 flex-1 bg-transparent text-[10px] focus:outline-none"
                value={idea.storyboardId ?? ""}
                onChange={(e) => updateIdea(idea.id, { storyboardId: e.target.value || null, storyboard: e.target.value ? storyboards.find((s) => s.id === e.target.value) : null })}
              >
                <option value="">Sin storyboard</option>
                {storyboards.map((sb) => <option key={sb.id} value={sb.id}>{sb.title}</option>)}
              </select>
            </div>
            )}
          </div>
        </td>
      )}
      {cols.has("pilar") && (
        <td className="px-2 py-2">
          <div className="flex items-center gap-1">
            <input
              className="min-w-0 w-full bg-transparent text-xs focus:outline-none"
              value={idea.pilar}
              onChange={(e) => updateIdea(idea.id, { pilar: e.target.value })}
              placeholder="Pilar..."
              list={`pillar-list-${idea.id}`}
            />
            <datalist id={`pillar-list-${idea.id}`}>
              {pillarOpts.map((p) => <option key={p} value={p} />)}
            </datalist>
          </div>
        </td>
      )}
      {cols.has("tags") && (
        <td className="px-2 py-2">
          <TagInput
            selectedIds={tagIds}
            onChange={(newIds) => onUpdateTags(idea.id, newIds)}
          />
        </td>
      )}
      {cols.has("status") && (
        <td className="px-2 py-2">
          <select
            className={`rounded border-0 bg-transparent text-[11px] font-medium focus:outline-none ${statusColor(idea.status)}`}
            value={idea.status}
            onChange={(e) => updateIdea(idea.id, { status: e.target.value })}
          >
            {statusOpts.map((s) => <option key={s} value={s}>{ideaStatusLabels[s]}</option>)}
          </select>
        </td>
      )}
      {cols.has("priority") && (
        <td className="px-2 py-2">
          <select
            className={`rounded border-0 bg-transparent text-[10px] font-semibold focus:outline-none ${priorityColor(idea.priority)}`}
            value={idea.priority}
            onChange={(e) => updateIdea(idea.id, { priority: e.target.value })}
          >
            {priorityOpts.map((p) => <option key={p} value={p}>{priorityLabels[p]}</option>)}
          </select>
        </td>
      )}
      {cols.has("dueDate") && (
        <td className="px-2 py-2">
          <input
            type="date"
            className="w-full rounded border-0 bg-transparent text-xs focus:outline-none"
            value={idea.dueDate ? idea.dueDate.slice(0, 10) : ""}
            onChange={(e) => updateIdea(idea.id, { dueDate: e.target.value || null })}
          />
        </td>
      )}
      {cols.has("comments") && (
        <td className="px-2 py-2 text-center">
          <button type="button" onClick={() => setShowComments((p) => !p)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" title="Comentarios del cliente">
            <MessageSquare className="h-3 w-3" />
            <span className="text-[10px]">{idea.comments?.length ?? 0}</span>
          </button>
        </td>
      )}
      <td className="w-10 px-2 py-2 text-center">
        <button type="button" onClick={() => deleteIdea(idea.id)} title="Eliminar">
          <Trash2 className="h-3.5 w-3.5 text-destructive hover:text-destructive/80" />
        </button>
      </td>
    </tr>
    {showComments && (
      <tr>
        <td colSpan={cols.size + 2} className="bg-muted/20 px-6 py-3">
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {(idea.comments?.length ?? 0) === 0 && <p className="text-xs text-muted-foreground">Sin comentarios del cliente.</p>}
            {idea.comments?.map((c) => (
              <div key={c.id} className="rounded-lg border bg-card px-3 py-2">
                <p className="text-xs font-medium">{c.authorName}</p>
                <p className="text-sm">{c.text}</p>
                <p className="text-[10px] text-muted-foreground">{new Date(c.createdAt).toLocaleString("es-AR")}</p>
              </div>
            ))}
          </div>
        </td>
      </tr>
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
      body: JSON.stringify({ ...body, platform: embed?.platform ?? "OTHER", referenceUrl: newUrl, referenceEmbed: embed?.embedUrl ?? "" }),
    })
    if (res.ok) {
      const idea = await res.json()
      setIdeas((prev) => [...prev, idea])
      resetForm()
    }
  }

  const resetForm = () => {
    setNewTitle(""); setNewDescription(""); setNewPilar(""); setNewPriority("MEDIUM"); setNewStatus("IDEA"); setNewDueDate(""); setNewStoryboardId(""); setNewUrl(""); setNewImageDataUrl(null); setShowForm(false)
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
        body.platform = embed?.platform ?? "OTHER"
      } else {
        body.referenceUrl = ""
        body.referenceEmbed = ""
        body.platform = "OTHER"
      }
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

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ArrowUpDown className="ml-1 h-2.5 w-2.5 opacity-30" />
    return sortDir === "asc" ? <ArrowUp className="ml-1 h-2.5 w-2.5" /> : <ArrowDown className="ml-1 h-2.5 w-2.5" />
  }

  const Th = ({ k, label, w, center }: { k: (typeof COLUMNS)[number]["key"]; label: string; w?: string; center?: boolean }) => {
    if (!visibleCols.has(k)) return null
    return (
      <th className={`${w ?? ""} px-2 py-2 ${center ? "text-center" : "text-left"} font-medium text-xs uppercase tracking-wide text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors`} onClick={() => handleSort(k)}>
        <span className="inline-flex items-center">{label}<SortIcon k={k} /></span>
      </th>
    )
  }

  const renderTable = () => {
    const colsArray = COLUMNS.filter((c) => visibleCols.has(c.key))
    const tableCols = (
      <>
        <th className="w-8 px-2 py-2"></th>
        {colsArray.map((c) => <Th key={c.key} k={c.key} label={c.label} w={c.w} center={c.center} />)}
        <th className="w-10 px-2 py-2"></th>
      </>
    )

    const renderRows = (items: Idea[]) => items.map((idea) => (
      <SortableRow key={idea.id} idea={idea} updateIdea={updateIdea} deleteIdea={deleteIdea} setPreviewImage={setPreviewImage} search={search} onUpdateTags={updateTagsGlobally} storyboards={storyboards} onEdit={openEditDialog} cols={visibleCols} />
    ))

    if (!mounted) {
      return (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50"><tr className="border-b">{tableCols}</tr></thead>
            <tbody>{renderRows(filtered)}</tbody>
          </table>
        </div>
      )
    }

    if (groupBy !== "none" && grouped) {
      return (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50"><tr className="border-b">{tableCols}</tr></thead>
            <tbody>
              {grouped.map(([key, items]) => (
                <>
                  <tr key={key} className="bg-muted/20 border-b">
                    <td colSpan={colsArray.length + 2} className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {key} <span className="font-normal text-[10px]">({items.length})</span>
                    </td>
                  </tr>
                  {renderRows(items)}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    return (
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50"><tr className="border-b">{tableCols}</tr></thead>
            <tbody>
              <SortableContext items={filtered.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                {renderRows(filtered)}
              </SortableContext>
            </tbody>
          </table>
        </div>
      </DndContext>
    )
  }

  const renderKanban = () => (
    <div className="grid grid-cols-4 gap-3">
      {statusOpts.map((status) => {
        const items = filtered.filter((i) => i.status === status)
        return (
          <div key={status} className="rounded-lg border bg-muted/20 p-3">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide">{ideaStatusLabels[status]} ({items.length})</h4>
            <div className="space-y-2">
              {items.map((idea) => (
                <div key={idea.id} className="rounded-lg border bg-card p-3 shadow-sm">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">{postTypeLabel(idea.postType)}</span>
                    <button type="button" onClick={() => deleteIdea(idea.id)}><Trash2 className="h-3 w-3 text-destructive" /></button>
                  </div>
                  <p className="cursor-pointer text-xs font-medium hover:underline" onClick={() => openEditDialog(idea)}>{idea.title}</p>
                  {idea.description && <p className="mt-0.5 text-[10px] text-muted-foreground line-clamp-2">{idea.description}</p>}
                  {idea.dueDate && <p className="mt-1 text-[10px] text-muted-foreground">📅 {formatDate(idea.dueDate)}</p>}
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {idea.contentIdeaTags?.map((ct) => (
                      <span key={ct.tag.id} className="rounded-full px-1.5 py-0.5 text-[9px] font-medium text-white" style={{ backgroundColor: ct.tag.color }}>{ct.tag.name}</span>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-1">
                    {statusOpts.filter((s) => s !== status).map((s) => (
                      <button key={s} type="button" onClick={() => updateIdea(idea.id, { status: s })} className="rounded bg-muted px-1.5 py-0.5 text-[9px] hover:bg-muted/80">{ideaStatusLabels[s]}</button>
                    ))}
                  </div>
                </div>
              ))}
              {items.length === 0 && <p className="py-4 text-center text-[10px] text-muted-foreground">Vacío</p>}
            </div>
          </div>
        )
      })}
    </div>
  )

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              className="h-8 w-44 rounded-md border bg-background pl-7 pr-2 text-xs focus:outline-none"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="h-8 rounded-md border bg-background px-2 text-xs focus:outline-none" value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
            <option value="ALL">Prioridad</option>
            {priorityOpts.map((p) => <option key={p} value={p}>{priorityLabels[p]}</option>)}
          </select>
          <select className="h-8 rounded-md border bg-background px-2 text-xs focus:outline-none" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="ALL">Estado</option>
            {statusOpts.map((s) => <option key={s} value={s}>{ideaStatusLabels[s]}</option>)}
          </select>
          <select className="h-8 rounded-md border bg-background px-2 text-xs focus:outline-none" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="ALL">Formato</option>
            {postTypeOpts.map((t) => <option key={t} value={t}>{postTypeLabel(t)}</option>)}
          </select>
          <select className="h-8 rounded-md border bg-background px-2 text-xs focus:outline-none" value={filterPlatform} onChange={(e) => setFilterPlatform(e.target.value)}>
            <option value="ALL">Plataforma</option>
            {platformOpts.map((p) => <option key={p} value={p}>{platformLabel(p)}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <select className="h-8 rounded-md border bg-background px-2 text-xs focus:outline-none" value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
            <option value="none">Sin agrupar</option>
            <option value="status">Estado</option>
            <option value="priority">Prioridad</option>
            <option value="pilar">Pilar</option>
            <option value="postType">Formato</option>
          </select>
          <div className="relative">
            <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => setShowColumnSettings(!showColumnSettings)}><Settings className="h-3.5 w-3.5" /></Button>
            {showColumnSettings && (
              <div className="absolute right-0 top-full z-40 mt-1 w-44 rounded-lg border bg-card p-2 shadow-lg">
                <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Columnas</p>
                {COLUMNS.map((c) => (
                  <label key={c.key} className="flex items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-muted cursor-pointer">
                    <input type="checkbox" checked={visibleCols.has(c.key)} onChange={() => toggleCol(c.key)} className="rounded" />
                    {c.label}
                  </label>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => { setShowColumnSettings(false); setView(view === "table" ? "kanban" : "table") }}
            className="flex h-8 items-center gap-1 rounded-md border px-2 text-xs hover:bg-muted"
          >
            {view === "table" ? <LayoutGrid className="h-3.5 w-3.5" /> : <Table2 className="h-3.5 w-3.5" />}
            {view === "table" ? "Board" : "Tabla"}
          </button>
          <Button size="sm" className="h-8" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4" /> Agregar
          </Button>
        </div>
      </div>

      {showForm && (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">Formato</label>
              <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={newType} onChange={(e) => setNewType(e.target.value)}>
                {postTypeOpts.map((t) => <option key={t} value={t}>{postTypeLabel(t)}</option>)}
              </select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-medium">Tema</label>
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Ej: Nueva imagen voz en off..." />
            </div>
            <div className="space-y-1 sm:col-span-3">
              <label className="text-xs font-medium">Objetivo</label>
              <Input value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Detalle del objetivo..." />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Pilar</label>
              <Input value={newPilar} onChange={(e) => setNewPilar(e.target.value)} placeholder="Pilar..." list="new-pillar-list" />
              <datalist id="new-pillar-list">
                {pillarOpts.map((p) => <option key={p} value={p} />)}
              </datalist>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Prioridad</label>
              <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={newPriority} onChange={(e) => setNewPriority(e.target.value)}>
                {priorityOpts.map((p) => <option key={p} value={p}>{priorityLabels[p]}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Estado</label>
              <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                {statusOpts.map((s) => <option key={s} value={s}>{ideaStatusLabels[s]}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Entrega</label>
              <input type="date" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-medium">Referencia</label>
              {newImageDataUrl ? (
                <div className="flex items-center gap-2">
                  <img src={newImageDataUrl} alt="" className="h-12 w-12 rounded object-cover bg-muted" />
                  <Button variant="ghost" size="sm" onClick={() => setNewImageDataUrl(null)}>Quitar</Button>
                </div>
              ) : (
                <Input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} onPaste={(e) => handleImagePaste(e, setNewImageDataUrl)} placeholder="Pegar URL o imagen (Ctrl+V)..." />
              )}
            </div>
            {storyboards.length > 0 && (
            <div className="space-y-1">
              <label className="text-xs font-medium">Storyboard</label>
              <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={newStoryboardId} onChange={(e) => setNewStoryboardId(e.target.value)}>
                <option value="">Sin storyboard</option>
                {storyboards.map((sb) => <option key={sb.id} value={sb.id}>{sb.title}</option>)}
              </select>
            </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button size="sm" onClick={addIdea}>Agregar</Button>
          </div>
        </div>
      )}

      {ideas.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">No hay contenido. Agregá la primera fila.</p>
      ) : view === "table" ? (
        renderTable()
      ) : (
        renderKanban()
      )}

      {editingIdea && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={closeEditDialog} />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg border-l bg-card shadow-xl overflow-y-auto">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h3 className="text-lg font-semibold">Editar contenido</h3>
              <button type="button" onClick={closeEditDialog} className="rounded-md p-1 hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4 p-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Formato</label>
                  <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={editType} onChange={(e) => setEditType(e.target.value)}>
                    {postTypeOpts.map((t) => <option key={t} value={t}>{postTypeLabel(t)}</option>)}
                  </select>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-medium">Tema</label>
                  <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Ej: Nueva imagen voz en off..." />
                </div>
                <div className="space-y-1 sm:col-span-3">
                  <label className="text-xs font-medium">Objetivo</label>
                  <Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Detalle del objetivo..." />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Pilar</label>
                  <Input value={editPilar} onChange={(e) => setEditPilar(e.target.value)} placeholder="Pilar..." list="edit-pillar-list" />
                  <datalist id="edit-pillar-list">
                    {pillarOpts.map((p) => <option key={p} value={p} />)}
                  </datalist>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Prioridad</label>
                  <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={editPriority} onChange={(e) => setEditPriority(e.target.value)}>
                    {priorityOpts.map((p) => <option key={p} value={p}>{priorityLabels[p]}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Estado</label>
                  <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                    {statusOpts.map((s) => <option key={s} value={s}>{ideaStatusLabels[s]}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Entrega</label>
                  <input type="date" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-medium">Referencia</label>
                  {editImageDataUrl ? (
                    <div className="flex items-center gap-2">
                      <img src={editImageDataUrl} alt="" className="h-12 w-12 rounded object-cover bg-muted" />
                      <Button variant="ghost" size="sm" onClick={() => { setEditImageDataUrl(null); setEditUrl("") }}>Quitar</Button>
                    </div>
                  ) : (
                    <Input value={editUrl} onChange={(e) => setEditUrl(e.target.value)} onPaste={(e) => handleImagePaste(e, setEditImageDataUrl)} placeholder="Pegar URL o imagen (Ctrl+V)..." />
                  )}
                </div>
                {storyboards.length > 0 && (
                <div className="space-y-1">
                  <label className="text-xs font-medium">Storyboard</label>
                  <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={editStoryboardId} onChange={(e) => setEditStoryboardId(e.target.value)}>
                    <option value="">Sin storyboard</option>
                    {storyboards.map((sb) => <option key={sb.id} value={sb.id}>{sb.title}</option>)}
                  </select>
                </div>
                )}
              </div>
            </div>
            <div className="sticky bottom-0 border-t bg-card px-5 py-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={closeEditDialog}>Cancelar</Button>
              <Button onClick={saveEdit}>Guardar</Button>
            </div>
          </div>
        </>
      )}

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Play className="h-3 w-3" /> YouTube/Vimeo inline</span>
        <span className="flex items-center gap-1"><ExternalLink className="h-3 w-3" /> TikTok/Instagram/Facebook externo</span>
        <span className="ml-auto text-[10px] text-muted-foreground">{filtered.length} de {ideas.length} ideas</span>
      </div>

      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setPreviewImage(null)}>
          <img src={previewImage} alt="Vista previa" className="max-h-[90vh] max-w-[90vw] rounded object-contain" />
        </div>
      )}
    </div>
  )
}

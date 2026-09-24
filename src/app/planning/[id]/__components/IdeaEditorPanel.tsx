"use client"

import { useEffect, useRef, useState, type ClipboardEvent } from "react"
import { Copy, MoreHorizontal, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { detectEmbed, platformLabel, postTypeLabel } from "@/lib/embeds"
import { compressImage } from "@/lib/compress-image"
import { ideaImageUrl } from "@/lib/media"
import { dayKeyOf } from "@/lib/calendar"
import { CAPTION_LIMIT, IDEA_STATUS_FLOW, ideaStatusLabels } from "@/lib/ideas"
import { useHorizontalSwipe } from "@/lib/use-horizontal-swipe"
import { TagInput } from "./TagInput"
import { IdeaComments } from "./IdeaComments"
import type { Idea } from "./idea-types"

export const postTypeOpts = ["CARROUSEL", "REEL", "VIDEO", "IMAGE", "STORY", "STATIC", "OTHER"]
export const priorityOpts = ["HIGH", "MEDIUM", "LOW"]
export const platformOpts = ["YOUTUBE", "VIMEO", "INSTAGRAM", "TIKTOK", "LINKEDIN", "FACEBOOK", "IMAGE", "OTHER"]
export const pillarOpts = ["Educación", "Entretenimiento", "Inspiración", "Promoción", "Conversación", "Utilidad", "Detrás de escena", "Noticia", "Otro"]
export const priorityLabels: Record<string, string> = { HIGH: "Alta", MEDIUM: "Media", LOW: "Baja" }

export const fieldClass =
  "w-full rounded-lg border border-white/10 bg-[#18181b] px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
const labelClass = "text-xs font-medium text-zinc-400"

/** Pegar una imagen en el campo de referencia la convierte en la referencia. */
export function handleImagePaste(e: ClipboardEvent<HTMLInputElement>, onDataUrl: (url: string) => void) {
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

interface Form {
  title: string
  description: string
  caption: string
  postType: string
  pilar: string
  priority: string
  status: string
  platform: string
  dueDate: string
  url: string
  imageDataUrl: string | null
  storyboardId: string
}

function formFrom(idea: Idea): Form {
  return {
    title: idea.title,
    description: idea.description,
    caption: idea.caption ?? "",
    postType: idea.postType,
    pilar: idea.pilar,
    priority: idea.priority,
    status: idea.status,
    platform: idea.platform,
    dueDate: dayKeyOf(idea.dueDate),
    url: idea.referenceUrl,
    imageDataUrl: idea.referenceEmbed?.startsWith("data:") ? idea.referenceEmbed : null,
    storyboardId: idea.storyboardId ?? "",
  }
}

interface Props {
  planningId: string
  idea: Idea
  storyboards: Array<{ id: string; title: string }>
  /** Abrir directamente en la conversación, como cuando se llega desde un aviso. */
  focusComments?: boolean
  onClose: () => void
  /** Cambios ya guardados en el servidor: la lista los refleja. Acepta una
   *  función para construir el cambio sobre la versión más reciente. */
  onPatch: (ideaId: string, patch: Partial<Idea> | ((current: Idea) => Partial<Idea>)) => void
  onDuplicate: (idea: Idea) => void
  onDelete: (idea: Idea) => void
}

/**
 * El panel de una pieza: todo lo que se puede decir de ella en un solo lugar,
 * incluido lo que antes vivía repartido —el copy sólo se editaba en la
 * pantalla de publicar, los tags no se podían poner en ningún lado y a los
 * comentarios del cliente no se les podía contestar—.
 *
 * Se cierra con la X, con Escape, tocando fuera o deslizándolo hacia la
 * derecha con el dedo. Si hay cambios sin guardar, pregunta antes.
 */
export function IdeaEditorPanel({
  planningId,
  idea,
  storyboards,
  focusComments,
  onClose,
  onPatch,
  onDuplicate,
  onDelete,
}: Props) {
  // Lo guardado, contra lo que se mide si hay cambios. El panel se monta con
  // `key` por pieza, así que esto arranca de nuevo al abrir otra.
  const [initial, setInitial] = useState<Form>(() => formFrom(idea))
  const [form, setForm] = useState<Form>(initial)
  const [saving, setSaving] = useState(false)
  const [uploadingImages, setUploadingImages] = useState(0)
  const [galleryDragOver, setGalleryDragOver] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const commentsRef = useRef<HTMLDivElement>(null)

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }))

  const dirty = (Object.keys(form) as Array<keyof Form>).some((k) => form[k] !== initial[k])

  useEffect(() => {
    if (!focusComments) return
    const timer = setTimeout(() => commentsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 250)
    return () => clearTimeout(timer)
  }, [focusComments])

  const requestClose = () => {
    if (dirty && !confirm("Tienes cambios sin guardar en esta pieza. ¿Descartarlos?")) return
    onClose()
  }

  /** Arma el cuerpo sólo con lo que cambió: guardar sin tocar la fecha no reagenda nada. */
  const buildBody = (): Record<string, unknown> => {
    const body: Record<string, unknown> = {}
    const simple: Array<[keyof Form, string]> = [
      ["title", "title"],
      ["description", "description"],
      ["caption", "caption"],
      ["postType", "postType"],
      ["pilar", "pilar"],
      ["priority", "priority"],
      ["status", "status"],
    ]
    for (const [key, field] of simple) if (form[key] !== initial[key]) body[field] = form[key]
    if (form.dueDate !== initial.dueDate) body.dueDate = form.dueDate || null
    if (form.storyboardId !== initial.storyboardId) body.storyboardId = form.storyboardId || null

    if (form.imageDataUrl && form.imageDataUrl !== initial.imageDataUrl) {
      body.referenceEmbed = form.imageDataUrl
      body.referenceUrl = ""
      body.platform = "IMAGE"
    } else if (!form.imageDataUrl && initial.imageDataUrl) {
      body.referenceEmbed = ""
      body.referenceUrl = ""
      body.platform = "OTHER"
    } else if (form.url !== initial.url) {
      const embed = form.url ? detectEmbed(form.url) : null
      body.referenceUrl = form.url
      body.referenceEmbed = embed?.embedUrl ?? ""
      body.platform = embed?.platform ?? form.platform
    } else if (form.platform !== initial.platform) {
      body.platform = form.platform
    }
    return body
  }

  /** Guarda y devuelve si salió bien. */
  const save = async ({ close }: { close: boolean }): Promise<boolean> => {
    if (!form.title.trim()) {
      toast.error("La pieza necesita un tema")
      return false
    }
    const body = buildBody()
    if (Object.keys(body).length === 0) {
      if (close) onClose()
      return true
    }
    setSaving(true)
    const res = await fetch(`/api/plannings/${planningId}/ideas/${idea.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null)
    setSaving(false)
    if (!res?.ok) {
      const err = await res?.json().catch(() => null)
      toast.error(err?.error ?? "No se pudo guardar. Revisa tu conexión e inténtalo otra vez.")
      return false
    }
    const patch: Partial<Idea> = { ...(body as Partial<Idea>) }
    if ("dueDate" in body) patch.dueDate = form.dueDate ? `${form.dueDate}T00:00:00.000Z` : null
    if ("storyboardId" in body) {
      const sb = storyboards.find((s) => s.id === form.storyboardId)
      patch.storyboardId = sb?.id ?? null
      patch.storyboard = sb ? { id: sb.id, title: sb.title } : null
    }
    onPatch(idea.id, patch)
    setInitial(form)
    if (close) onClose()
    return true
  }

  const duplicate = async () => {
    // La copia sale de lo guardado: si hay cambios, primero se guardan, o la
    // copia saldría sin lo que se acaba de escribir.
    if (dirty && !(await save({ close: false }))) return
    onDuplicate(idea)
  }

  // Escape cierra (o primero la vista previa); Ctrl/⌘+Enter guarda desde
  // cualquier campo, que es como se guarda sin soltar el teclado.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Un menú abierto se cierra solo con Escape; el panel sigue.
        if (document.querySelector('[role="menu"]')) return
        e.preventDefault()
        if (previewImage) setPreviewImage(null)
        else requestClose()
      } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        save({ close: true })
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  // Deslizar hacia la derecha lo cierra, como se descarta una hoja en el celular.
  const swipe = useHorizontalSwipe({
    allow: { right: true },
    threshold: 110,
    onSwipe: requestClose,
    ignoreSelector: "input, textarea, select, [contenteditable='true'], [data-no-swipe]",
  })

  const setTags = async (tagIds: string[]) => {
    const res = await fetch(`/api/ideas/${idea.id}/tags`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagIds }),
    }).catch(() => null)
    if (!res?.ok) {
      toast.error("No se pudieron guardar los tags")
      return
    }
    const updated = await res.json()
    onPatch(idea.id, { contentIdeaTags: updated.contentIdeaTags ?? [] })
  }

  const addImages = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"))
    if (list.length === 0) return
    setUploadingImages((n) => n + list.length)
    try {
      for (const file of list) {
        try {
          const dataUrl = await compressImage(file)
          const res = await fetch(`/api/plannings/${planningId}/ideas/${idea.id}/images`, {
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
          onPatch(idea.id, (current) => ({ images: [...current.images, image] }))
        } catch {
          toast.error("No se pudo leer una de las imágenes")
        }
      }
    } finally {
      setUploadingImages((n) => Math.max(0, n - list.length))
    }
  }

  const removeImage = async (imageId: string) => {
    const removed = idea.images.find((img) => img.id === imageId)
    onPatch(idea.id, (current) => ({ images: current.images.filter((img) => img.id !== imageId) }))
    const res = await fetch(`/api/plannings/${planningId}/ideas/${idea.id}/images/${imageId}`, {
      method: "DELETE",
    }).catch(() => null)
    if (!res?.ok && removed) {
      toast.error("No se pudo quitar la imagen")
      onPatch(idea.id, (current) => ({ images: [...current.images, removed] }))
    }
  }

  const captionLeft = CAPTION_LIMIT - form.caption.length

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/60 transition-opacity"
        style={{ opacity: swipe.dx > 0 ? Math.max(0.2, 1 - swipe.dx / 400) : 1 }}
        onClick={requestClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Editar pieza"
        {...swipe.handlers}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg touch-pan-y flex-col border-l border-white/10 bg-[#0c0c0e] shadow-xl"
        style={{
          transform: `translateX(${swipe.dx}px)`,
          transition: swipe.dragging ? "none" : "transform 200ms ease-out",
        }}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5">
          <h3 className="text-lg font-semibold text-zinc-100">Editar pieza</h3>
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Más acciones de la pieza"
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-white/5 hover:text-white data-[state=open]:bg-white/10"
                >
                  <MoreHorizontal size={18} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={duplicate}>
                  <Copy size={15} /> Duplicar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem destructive onSelect={() => onDelete(idea)}>
                  <Trash2 size={15} /> Eliminar pieza
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              type="button"
              onClick={requestClose}
              aria-label="Cerrar"
              className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/5 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 touch-pan-y space-y-5 overflow-y-auto overscroll-contain p-4 sm:p-5">
          <div className="space-y-1">
            <label htmlFor="edit-title" className={labelClass}>Tema</label>
            <input id="edit-title" className={fieldClass} value={form.title} onChange={(e) => set("title", e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
            <div className="col-span-2 space-y-1 sm:col-span-1">
              <label htmlFor="edit-type" className={labelClass}>Formato</label>
              <select id="edit-type" className={fieldClass} value={form.postType} onChange={(e) => set("postType", e.target.value)}>
                {postTypeOpts.map((t) => <option key={t} value={t}>{postTypeLabel(t)}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="edit-status" className={labelClass}>Estado</label>
              <select id="edit-status" className={fieldClass} value={form.status} onChange={(e) => set("status", e.target.value)}>
                {IDEA_STATUS_FLOW.map((s) => <option key={s} value={s}>{ideaStatusLabels[s]}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="edit-priority" className={labelClass}>Prioridad</label>
              <select id="edit-priority" className={fieldClass} value={form.priority} onChange={(e) => set("priority", e.target.value)}>
                {priorityOpts.map((p) => <option key={p} value={p}>{priorityLabels[p]}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="edit-description" className={labelClass}>Objetivo <span className="font-normal text-zinc-500">— de qué trata, el brief</span></label>
            <textarea
              id="edit-description"
              rows={3}
              className={`${fieldClass} resize-y`}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor="edit-caption" className={labelClass}>Copy <span className="font-normal text-zinc-500">— el texto que se publica</span></label>
              <span className={`text-[11px] tabular-nums ${captionLeft < 0 ? "text-rose-400" : captionLeft < 200 ? "text-amber-300" : "text-zinc-500"}`}>
                {form.caption.length}/{CAPTION_LIMIT}
              </span>
            </div>
            <textarea
              id="edit-caption"
              rows={5}
              className={`${fieldClass} resize-y`}
              value={form.caption}
              onChange={(e) => set("caption", e.target.value)}
              placeholder="Lo que va en la publicación. Suele escribirse cerca de la fecha."
            />
            {captionLeft < 0 && (
              <p className="text-[11px] text-rose-300">Instagram corta en {CAPTION_LIMIT} caracteres: sobran {-captionLeft}.</p>
            )}
            {form.postType === "STORY" && form.caption.trim() && (
              <p className="text-[11px] text-amber-300/90">Las historias salen sin texto: el copy se guarda para publicarla a mano.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div className="space-y-1">
              <label htmlFor="edit-pilar" className={labelClass}>Pilar</label>
              <input id="edit-pilar" className={fieldClass} value={form.pilar} onChange={(e) => set("pilar", e.target.value)} list="edit-pillar-list" />
              <datalist id="edit-pillar-list">{pillarOpts.map((p) => <option key={p} value={p} />)}</datalist>
            </div>
            <div className="space-y-1">
              <label htmlFor="edit-due" className={labelClass}>Entrega</label>
              <input id="edit-due" type="date" className={fieldClass} value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
              {idea.publishTime && form.dueDate && (
                <p className="text-[11px] text-zinc-500">Sale a las {idea.publishTime}. La hora se cambia en Calendario.</p>
              )}
            </div>
            <div className="space-y-1">
              <label htmlFor="edit-platform" className={labelClass}>Plataforma</label>
              <select id="edit-platform" className={fieldClass} value={form.platform} onChange={(e) => set("platform", e.target.value)}>
                {platformOpts.map((p) => <option key={p} value={p}>{platformLabel(p)}</option>)}
              </select>
            </div>
            {storyboards.length > 0 && (
              <div className="space-y-1">
                <label htmlFor="edit-storyboard" className={labelClass}>Storyboard</label>
                <select id="edit-storyboard" className={fieldClass} value={form.storyboardId} onChange={(e) => set("storyboardId", e.target.value)}>
                  <option value="">Sin storyboard</option>
                  {storyboards.map((sb) => <option key={sb.id} value={sb.id}>{sb.title}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="edit-reference" className={labelClass}>Referencia</label>
            {form.imageDataUrl ? (
              <div className="flex items-center gap-2">
                <img src={form.imageDataUrl} alt="" className="h-12 w-12 rounded bg-zinc-800 object-cover" />
                <button type="button" onClick={() => setForm((f) => ({ ...f, imageDataUrl: null, url: "" }))} className="min-h-9 rounded-md px-2 text-xs text-zinc-400 hover:bg-white/5 hover:text-white">Quitar</button>
              </div>
            ) : (
              <input
                id="edit-reference"
                className={fieldClass}
                value={form.url}
                onChange={(e) => set("url", e.target.value)}
                onPaste={(e) => handleImagePaste(e, (url) => set("imageDataUrl", url))}
                placeholder="Pega un link (TikTok, Reel, YouTube) o una imagen"
              />
            )}
          </div>

          <div className="space-y-1.5">
            <span className={labelClass}>Tags</span>
            <TagInput selectedIds={idea.contentIdeaTags.map((ct) => ct.tag.id)} onChange={setTags} />
          </div>

          {/* Galería: soltar varias imágenes a la vez, verlas y quitarlas una por una */}
          <div className="space-y-2">
            <span className={labelClass}>Imágenes de referencia</span>
            <div
              role="button"
              tabIndex={0}
              onClick={() => galleryInputRef.current?.click()}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") galleryInputRef.current?.click() }}
              onDragOver={(e) => { e.preventDefault(); setGalleryDragOver(true) }}
              onDragLeave={() => setGalleryDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setGalleryDragOver(false); addImages(e.dataTransfer.files) }}
              className={`flex min-h-14 cursor-pointer items-center justify-center rounded-lg border border-dashed px-4 py-3 text-center transition-colors ${
                galleryDragOver ? "border-white/40 bg-white/[0.06]" : "border-white/10 hover:border-white/20"
              }`}
            >
              <p className="text-xs text-zinc-400">
                {uploadingImages > 0 ? `Subiendo… (${uploadingImages})` : "Arrastra imágenes o toca para elegir — varias a la vez"}
              </p>
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
                if (files) addImages(files)
              }}
            />
            {idea.images.length > 0 && (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {idea.images.map((img) => (
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
                      onClick={() => removeImage(img.id)}
                      className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-md bg-black/70 text-zinc-100 transition-colors hover:bg-black hover:text-white sm:opacity-0 sm:group-hover:opacity-100"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div ref={commentsRef} className="scroll-mt-4 space-y-2 border-t border-white/5 pt-4">
            <span className={labelClass}>
              Conversación con el cliente{idea.comments.length > 0 && ` (${idea.comments.length})`}
            </span>
            <IdeaComments
              ideaId={idea.id}
              comments={idea.comments}
              onChange={(comments) => onPatch(idea.id, { comments })}
            />
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-white/10 bg-[#0c0c0e] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-5">
          <span className="hidden text-[11px] text-zinc-500 sm:block">
            <kbd className="rounded border border-white/10 px-1">Ctrl</kbd>+<kbd className="rounded border border-white/10 px-1">Enter</kbd> guarda · <kbd className="rounded border border-white/10 px-1">Esc</kbd> cierra
          </span>
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={requestClose} className="min-h-10 rounded-lg px-4 text-sm text-zinc-300 hover:bg-white/5 hover:text-white">Cancelar</button>
            <button
              type="button"
              onClick={() => save({ close: true })}
              disabled={saving}
              className="min-h-10 rounded-lg bg-brand px-5 text-sm font-semibold text-white hover:bg-[#d0424a] disabled:opacity-60"
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      </div>

      {previewImage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4" onClick={() => setPreviewImage(null)}>
          <img src={previewImage} alt="Vista previa" className="max-h-[90vh] max-w-[90vw] rounded object-contain" />
        </div>
      )}
    </>
  )
}

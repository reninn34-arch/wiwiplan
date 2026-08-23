"use client"

import { useState, useRef, useEffect, type ClipboardEvent } from "react"
import { Plus, ImagePlus, Trash2, Clock, ChevronUp, ChevronDown, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { compressImage } from "@/lib/compress-image"
import { panelImageUrl } from "@/lib/media"

async function fileFromPaste(e: ClipboardEvent): Promise<File | null> {
  const direct = e.clipboardData.files?.[0]
  if (direct && direct.type.startsWith("image/")) return direct

  for (const item of e.clipboardData.items) {
    if (item.type.startsWith("image/")) {
      const file = item.getAsFile()
      if (file) return file
    }
  }
  return null
}

interface Panel {
  id: string
  sceneNumber: number
  description: string
  duration: string
  notes: string
  order: number
  hasImage: boolean
  /** Vista previa local mientras la imagen viaja al servidor. */
  localPreview?: string
  /** Cambia al reemplazar la imagen, para saltear el caché del navegador. */
  imageVersion?: number
}

interface Storyboard {
  id: string
  title: string
  description: string
  panels: Panel[]
}

interface Props {
  planningId: string
}

function PanelSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-white/5 bg-[#0c0c0e]">
      <div className="h-9 border-b border-white/5 bg-white/[0.03]" />
      <div className="aspect-video animate-pulse bg-white/[0.04]" />
      <div className="space-y-2 p-3">
        <div className="h-[60px] animate-pulse rounded bg-white/[0.04]" />
        <div className="h-6 animate-pulse rounded bg-white/[0.03]" />
      </div>
    </div>
  )
}

export function StoryboardsTab({ planningId }: Props) {
  const [storyboards, setStoryboards] = useState<Storyboard[]>([])
  const [activeSb, setActiveSb] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [creating, setCreating] = useState(false)
  const [uploading, setUploading] = useState<Record<string, boolean>>({})

  useEffect(() => {
    let cancelled = false

    fetch(`/api/plannings/${planningId}/storyboard`)
      .then((r) => {
        if (!r.ok) throw new Error("request failed")
        return r.json()
      })
      .then((data) => {
        if (cancelled) return
        const list = Array.isArray(data) ? data : []
        setStoryboards(list)
        if (list.length > 0) setActiveSb(list[0].id)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [planningId])

  const createStoryboard = async () => {
    setCreating(true)
    const res = await fetch(`/api/plannings/${planningId}/storyboard`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: `Storyboard ${storyboards.length + 1}` }),
    })
    setCreating(false)
    if (!res.ok) {
      toast.error("No se pudo crear el storyboard")
      return
    }
    const sb = await res.json()
    sb.panels = []
    setStoryboards((prev) => [...prev, sb])
    setActiveSb(sb.id)
  }

  const addPanel = async (storyboardId: string) => {
    const res = await fetch(`/api/plannings/${planningId}/storyboard/${storyboardId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: "" }),
    })
    if (!res.ok) {
      toast.error("No se pudo agregar la escena")
      return
    }
    const panel = await res.json()
    setStoryboards((prev) =>
      prev.map((sb) => (sb.id === storyboardId ? { ...sb, panels: [...sb.panels, panel] } : sb)),
    )
  }

  const patchPanel = (panelId: string, updates: Partial<Panel>) => {
    setStoryboards((prev) =>
      prev.map((s) => ({
        ...s,
        panels: s.panels.map((p) => (p.id === panelId ? { ...p, ...updates } : p)),
      })),
    )
  }

  const updatePanel = async (panelId: string, updates: Record<string, unknown>) => {
    const snapshot = storyboards
    patchPanel(panelId, updates as Partial<Panel>)

    const res = await fetch(`/api/plannings/${planningId}/storyboard/${panelId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    })
    if (!res.ok) {
      setStoryboards(snapshot)
      toast.error("No se pudo guardar la escena")
    }
  }

  const uploadImage = async (panelId: string, file: File) => {
    setUploading((prev) => ({ ...prev, [panelId]: true }))
    try {
      const dataUrl = await compressImage(file)
      patchPanel(panelId, { localPreview: dataUrl })

      const res = await fetch(`/api/plannings/${planningId}/storyboard/${panelId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: dataUrl }),
      })
      if (!res.ok) throw new Error("upload failed")

      setStoryboards((prev) =>
        prev.map((s) => ({
          ...s,
          panels: s.panels.map((p) =>
            p.id === panelId
              ? { ...p, hasImage: true, imageVersion: (p.imageVersion ?? 0) + 1 }
              : p,
          ),
        })),
      )
    } catch {
      patchPanel(panelId, { localPreview: undefined })
      toast.error("No se pudo guardar la imagen")
    } finally {
      setUploading((prev) => {
        const next = { ...prev }
        delete next[panelId]
        return next
      })
    }
  }

  const deletePanel = async (panelId: string) => {
    const snapshot = storyboards
    setStoryboards((prev) =>
      prev.map((s) => ({ ...s, panels: s.panels.filter((p) => p.id !== panelId) })),
    )

    const res = await fetch(`/api/plannings/${planningId}/storyboard/${panelId}`, {
      method: "DELETE",
    })
    if (!res.ok) {
      setStoryboards(snapshot)
      toast.error("No se pudo eliminar la escena")
    }
  }

  const movePanel = async (panelId: string, direction: "up" | "down") => {
    const sb = storyboards.find((s) => s.panels.some((p) => p.id === panelId))
    if (!sb) return

    const panels = [...sb.panels]
    const idx = panels.findIndex((p) => p.id === panelId)
    const newIdx = direction === "up" ? idx - 1 : idx + 1
    if (idx === -1 || newIdx < 0 || newIdx >= panels.length) return
    ;[panels[idx], panels[newIdx]] = [panels[newIdx], panels[idx]]

    const snapshot = storyboards
    setStoryboards((prev) => prev.map((s) => (s.id === sb.id ? { ...s, panels } : s)))

    const res = await fetch(`/api/plannings/${planningId}/storyboard/reorder`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ panelIds: panels.map((p) => p.id) }),
    })
    if (!res.ok) {
      setStoryboards(snapshot)
      toast.error("No se pudo reordenar las escenas")
    }
  }

  const titleDebounce = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const updateStoryboardTitle = (sbId: string, title: string) => {
    setStoryboards((prev) => prev.map((s) => (s.id === sbId ? { ...s, title } : s)))
    if (titleDebounce.current[sbId]) clearTimeout(titleDebounce.current[sbId])
    titleDebounce.current[sbId] = setTimeout(async () => {
      delete titleDebounce.current[sbId]
      const res = await fetch(`/api/plannings/${planningId}/storyboard`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyboardId: sbId, title }),
      })
      if (!res.ok) toast.error("No se pudo guardar el título")
    }, 400)
  }

  const activeStoryboard = storyboards.find((s) => s.id === activeSb)

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-28 animate-pulse rounded-md bg-white/5" />
          <div className="h-8 w-28 animate-pulse rounded-md bg-white/[0.03]" />
        </div>
        <div className="flex items-center justify-between">
          <div className="h-9 w-48 animate-pulse rounded-md bg-white/5" />
          <div className="h-8 w-32 animate-pulse rounded-md bg-white/[0.03]" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <PanelSkeleton />
          <PanelSkeleton />
          <PanelSkeleton />
        </div>
        <p className="flex items-center justify-center gap-2 text-sm text-zinc-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando storyboards...
        </p>
      </div>
    )
  }

  if (failed) {
    return (
      <div className="rounded-xl border border-white/5 bg-[#0c0c0e] py-12 text-center">
        <p className="text-sm text-zinc-200">No pudimos cargar los storyboards</p>
        <p className="mt-1 text-xs text-zinc-400">Revisá la conexión y volvé a intentar.</p>
        <Button className="mt-4" size="sm" variant="outline" onClick={() => location.reload()}>
          Reintentar
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {storyboards.map((sb) => (
          <button
            key={sb.id}
            type="button"
            onClick={() => setActiveSb(sb.id)}
            aria-current={sb.id === activeSb}
            className={`min-h-9 shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500 ${
              sb.id === activeSb
                ? "bg-white text-black"
                : "bg-white/5 text-zinc-300 hover:bg-white/10"
            }`}
          >
            {sb.title || "Sin título"}
          </button>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={createStoryboard}
          disabled={creating}
          aria-label="Crear storyboard"
          className="shrink-0"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {activeStoryboard ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Input
              className="max-w-xs border border-white/10 bg-[#18181b] text-lg font-semibold text-zinc-100"
              value={activeStoryboard.title}
              aria-label="Título del storyboard"
              placeholder="Sin título"
              onChange={(e) => activeSb && updateStoryboardTitle(activeSb, e.target.value)}
            />
            <Button size="sm" variant="outline" onClick={() => activeSb && addPanel(activeSb)}>
              <Plus className="h-4 w-4" /> Agregar escena
            </Button>
          </div>

          {activeStoryboard.panels.length === 0 ? (
            <div className="rounded-xl border border-white/5 bg-[#0c0c0e] py-12 text-center">
              <p className="text-sm text-zinc-200">Este storyboard todavía no tiene escenas</p>
              <p className="mx-auto mt-1 max-w-sm text-xs text-zinc-400">
                Cada escena lleva una imagen, una descripción y su duración. Podés pegar una captura
                directamente sobre la tarjeta.
              </p>
              <Button className="mt-4" size="sm" onClick={() => activeSb && addPanel(activeSb)}>
                <Plus className="h-4 w-4" /> Agregar la primera escena
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {activeStoryboard.panels.map((panel, idx) => {
                const isUploading = Boolean(uploading[panel.id])
                const imageSrc = panel.localPreview
                  ? panel.localPreview
                  : panel.hasImage
                    ? `${panelImageUrl(panel.id)}${panel.imageVersion ? `?v=${panel.imageVersion}` : ""}`
                    : null

                return (
                  <div
                    key={panel.id}
                    className="overflow-hidden rounded-lg border border-white/5 bg-[#0c0c0e]"
                    onPaste={async (e) => {
                      const file = await fileFromPaste(e)
                      if (!file) return
                      e.preventDefault()
                      uploadImage(panel.id, file)
                    }}
                  >
                    <div className="flex items-center gap-1 border-b border-white/5 bg-white/[0.03] px-3 py-2">
                      <span className="text-xs font-medium text-zinc-300">Escena {idx + 1}</span>
                      <div className="ml-auto flex items-center gap-1 text-xs text-zinc-400">
                        <button
                          type="button"
                          onClick={() => movePanel(panel.id, "up")}
                          disabled={idx === 0}
                          aria-label={`Mover la escena ${idx + 1} hacia arriba`}
                          className="flex h-6 w-6 max-sm:h-9 max-sm:w-9 items-center justify-center rounded transition-colors hover:bg-white/5 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500 disabled:pointer-events-none disabled:opacity-30"
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => movePanel(panel.id, "down")}
                          disabled={idx === activeStoryboard.panels.length - 1}
                          aria-label={`Mover la escena ${idx + 1} hacia abajo`}
                          className="flex h-6 w-6 max-sm:h-9 max-sm:w-9 items-center justify-center rounded transition-colors hover:bg-white/5 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500 disabled:pointer-events-none disabled:opacity-30"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                        <Clock className="ml-1 h-3 w-3" aria-hidden />
                        <input
                          className="w-12 rounded bg-transparent px-1 py-0.5 text-center tabular-nums text-zinc-300 transition-colors focus-visible:bg-white/5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500"
                          value={panel.duration}
                          aria-label={`Duración de la escena ${idx + 1}`}
                          onChange={(e) => updatePanel(panel.id, { duration: e.target.value })}
                          placeholder="0:00"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => deletePanel(panel.id)}
                        aria-label={`Eliminar la escena ${idx + 1}`}
                        className="flex h-6 w-6 max-sm:h-9 max-sm:w-9 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-red-500/10 hover:text-red-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="relative flex aspect-video items-center justify-center bg-white/[0.02]">
                      {imageSrc ? (
                        <>
                          <img
                            src={imageSrc}
                            alt={`Escena ${idx + 1}`}
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover"
                          />
                          <label className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/60 text-xs font-medium text-white opacity-0 transition-opacity hover:opacity-100 focus-within:opacity-100">
                            <ImagePlus className="mr-1.5 h-4 w-4" /> Reemplazar
                            <input
                              type="file"
                              accept="image/*"
                              className="sr-only"
                              aria-label={`Reemplazar la imagen de la escena ${idx + 1}`}
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) uploadImage(panel.id, file)
                                e.target.value = ""
                              }}
                            />
                          </label>
                        </>
                      ) : (
                        <label className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-1 text-xs text-zinc-400 transition-colors hover:bg-white/[0.04] focus-within:bg-white/[0.04]">
                          <ImagePlus className="h-6 w-6" />
                          <span>Agregar imagen</span>
                          <span className="text-[10px] text-zinc-400">o pegá una captura</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            aria-label={`Agregar imagen a la escena ${idx + 1}`}
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) uploadImage(panel.id, file)
                              e.target.value = ""
                            }}
                          />
                        </label>
                      )}

                      {isUploading && (
                        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/60 text-xs text-zinc-100">
                          <Loader2 className="h-4 w-4 animate-spin" /> Guardando imagen...
                        </div>
                      )}
                    </div>

                    <div className="space-y-2 p-3">
                      <textarea
                        className="min-h-[60px] w-full resize-none rounded border border-white/10 bg-transparent p-2 text-sm text-zinc-200 transition-colors placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                        value={panel.description}
                        aria-label={`Descripción de la escena ${idx + 1}`}
                        onChange={(e) => updatePanel(panel.id, { description: e.target.value })}
                        placeholder="Descripción de la escena..."
                      />
                      <input
                        className="w-full rounded border border-white/10 bg-transparent px-2 py-1 text-xs text-zinc-300 transition-colors placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                        value={panel.notes}
                        aria-label={`Notas de la escena ${idx + 1}`}
                        onChange={(e) => updatePanel(panel.id, { notes: e.target.value })}
                        placeholder="Notas adicionales..."
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-white/5 bg-[#0c0c0e] py-12 text-center">
          <p className="text-sm text-zinc-200">Todavía no hay storyboards en este plan</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-zinc-400">
            Un storyboard ordena las escenas de una pieza: imagen, descripción y duración.
          </p>
          <Button className="mt-4" onClick={createStoryboard} disabled={creating}>
            <Plus className="h-4 w-4" /> {creating ? "Creando..." : "Crear storyboard"}
          </Button>
        </div>
      )}
    </div>
  )
}

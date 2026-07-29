"use client"

import { useState, useRef, type ClipboardEvent } from "react"
import { Plus, ImagePlus, Trash2, GripVertical, Clock, ChevronUp, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

function handleImagePaste(e: ClipboardEvent, onDataUrl: (url: string) => void) {
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

interface Panel {
  id: string
  sceneNumber: number
  imageUrl: string
  description: string
  duration: string
  notes: string
  order: number
}

interface Storyboard {
  id: string
  title: string
  description: string
  panels: Panel[]
}

interface Props {
  planningId: string
  storyboards: Storyboard[]
}

export function StoryboardsTab({ planningId, storyboards: initial }: Props) {
  const [storyboards, setStoryboards] = useState(initial)
  const [activeSb, setActiveSb] = useState<string | null>(initial[0]?.id ?? null)

  const createStoryboard = async () => {
    const res = await fetch(`/api/plannings/${planningId}/storyboard`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: `Storyboard ${storyboards.length + 1}` }),
    })
    if (res.ok) {
      const sb = await res.json()
      sb.panels = []
      setStoryboards((prev) => [...prev, sb])
      setActiveSb(sb.id)
    }
  }

  const addPanel = async (storyboardId: string) => {
    const res = await fetch(`/api/plannings/${planningId}/storyboard/${storyboardId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: "Nueva escena" }),
    })
    if (res.ok) {
      const panel = await res.json()
      setStoryboards((prev) =>
        prev.map((sb) =>
          sb.id === storyboardId ? { ...sb, panels: [...sb.panels, panel] } : sb
        )
      )
    }
  }

  const updatePanel = async (panelId: string, updates: Record<string, unknown>) => {
    const sb = storyboards.find((s) => s.panels.some((p) => p.id === panelId))
    if (!sb) return

    const prev = [...storyboards]
    setStoryboards((p) =>
      p.map((s) =>
        s.id === sb.id
          ? { ...s, panels: s.panels.map((p) => (p.id === panelId ? { ...p, ...updates } : p)) }
          : s
      )
    )

    const res = await fetch(`/api/plannings/${planningId}/storyboard/${panelId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    })
    if (!res.ok) {
      setStoryboards(prev)
      toast.error("Error al guardar el panel")
    }
  }

  const deletePanel = async (panelId: string) => {
    const sb = storyboards.find((s) => s.panels.some((p) => p.id === panelId))
    if (!sb) return

    const prev = [...storyboards]
    setStoryboards((p) =>
      p.map((s) =>
        s.id === sb.id ? { ...s, panels: s.panels.filter((p) => p.id !== panelId) } : s
      )
    )

    const res = await fetch(`/api/plannings/${planningId}/storyboard/${panelId}`, { method: "DELETE" })
    if (!res.ok) {
      setStoryboards(prev)
      toast.error("Error al eliminar el panel")
    }
  }

  const movePanel = async (panelId: string, direction: "up" | "down") => {
    const sb = storyboards.find((s) => s.panels.some((p) => p.id === panelId))
    if (!sb) return
    const panels = [...sb.panels]
    const idx = panels.findIndex((p) => p.id === panelId)
    if (idx === -1) return
    const newIdx = direction === "up" ? idx - 1 : idx + 1
    if (newIdx < 0 || newIdx >= panels.length) return
    ;[panels[idx], panels[newIdx]] = [panels[newIdx], panels[idx]]

    const prev = [...storyboards]
    setStoryboards((p) =>
      p.map((s) => (s.id === sb.id ? { ...s, panels } : s))
    )

    const res = await fetch(`/api/plannings/${planningId}/storyboard/reorder`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ panelIds: panels.map((p) => p.id) }),
    })
    if (!res.ok) {
      setStoryboards(prev)
      toast.error("Error al reordenar paneles")
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
      if (!res.ok) toast.error("Error al guardar el título")
    }, 400)
  }

  const activeStoryboard = storyboards.find((s) => s.id === activeSb)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {storyboards.map((sb) => (
          <button
            key={sb.id}
            type="button"
            onClick={() => setActiveSb(sb.id)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              sb.id === activeSb
                ? "bg-white text-black"
                : "bg-white/5 text-zinc-400 hover:bg-white/10"
            }`}
          >
            {sb.title}
          </button>
        ))}
        <Button variant="outline" size="sm" onClick={createStoryboard}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {activeStoryboard ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
              <Input
                className="max-w-xs border border-white/10 bg-[#18181b] text-lg font-semibold text-zinc-200"
                value={activeStoryboard.title}
              onChange={(e) => activeSb && updateStoryboardTitle(activeSb, e.target.value)}
            />
            <Button size="sm" variant="outline" onClick={() => activeSb && addPanel(activeSb)}>
              <Plus className="h-4 w-4" /> Agregar Escena
            </Button>
          </div>

          {activeStoryboard.panels.length === 0 ? (
            <p className="py-8 text-center text-zinc-500">
              No hay escenas. Agregá la primera.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {activeStoryboard.panels.map((panel, idx) => (
                <div key={panel.id} className="rounded-lg border border-white/5 bg-[#0c0c0e]" onPaste={(e) => handleImagePaste(e, (url) => updatePanel(panel.id, { imageUrl: url }))}>
                  <div className="flex items-center gap-1 border-b border-white/5 bg-white/[0.03] px-3 py-2">
                    <GripVertical className="h-4 w-4 text-zinc-500" />
                    <span className="text-xs font-medium text-zinc-400">Escena {idx + 1}</span>
                    <div className="ml-auto flex items-center gap-1 text-xs text-zinc-500">
                      <button type="button" onClick={() => movePanel(panel.id, "up")} disabled={idx === 0} className="disabled:opacity-30">
                        <ChevronUp className="h-3 w-3" />
                      </button>
                      <button type="button" onClick={() => movePanel(panel.id, "down")} disabled={idx === activeStoryboard.panels.length - 1} className="disabled:opacity-30">
                        <ChevronDown className="h-3 w-3" />
                      </button>
                      <Clock className="h-3 w-3" />
                      <input
                        className="w-12 bg-transparent text-center"
                        value={panel.duration}
                        onChange={(e) => updatePanel(panel.id, { duration: e.target.value })}
                        placeholder="0:00"
                      />
                    </div>
                    <button type="button" onClick={() => deletePanel(panel.id)}>
                      <Trash2 className="h-3 w-3 text-red-400" />
                    </button>
                  </div>

                  <div className="flex aspect-video items-center justify-center bg-white/[0.02]">
                    {panel.imageUrl && !panel.imageUrl.startsWith("blob:") ? (
                      <img
                        src={panel.imageUrl}
                        alt={`Escena ${idx + 1}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <label className="flex cursor-pointer flex-col items-center gap-1 text-xs text-zinc-500">
                        <ImagePlus className="h-6 w-6" />
                        <span>Agregar imagen</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              const reader = new FileReader()
                              reader.onload = () => { if (typeof reader.result === "string") updatePanel(panel.id, { imageUrl: reader.result }) }
                              reader.readAsDataURL(file)
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>

                  <div className="space-y-2 p-3">
                    <textarea
                      className="min-h-[60px] w-full resize-none rounded border border-white/10 bg-transparent p-2 text-sm text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-600"
                      value={panel.description}
                      onChange={(e) => updatePanel(panel.id, { description: e.target.value })}
                      placeholder="Descripción de la escena..."
                    />
                    <input
                      className="w-full border border-white/10 bg-transparent px-2 py-1 text-xs text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-600"
                      value={panel.notes}
                      onChange={(e) => updatePanel(panel.id, { notes: e.target.value })}
                      placeholder="Notas adicionales..."
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="py-12 text-center">
          <p className="text-zinc-500">No hay storyboards. Creá uno nuevo.</p>
          <Button className="mt-4" onClick={createStoryboard}>
            <Plus className="h-4 w-4" /> Crear Storyboard
          </Button>
        </div>
      )}
    </div>
  )
}

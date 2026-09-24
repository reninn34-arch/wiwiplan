"use client"

import { useState, useEffect, useRef } from "react"
import { X, Plus, Check } from "lucide-react"
import { foldText, tagColorFor } from "@/lib/ideas"

interface Tag {
  id: string
  name: string
  color: string
}

interface Props {
  selectedIds: string[]
  onChange: (tagIds: string[]) => void
}

/**
 * Los tags de una pieza. Se escribe para filtrar y Enter elige el primero que
 * coincide, o crea el tag si no existe: agregar uno no puede costar más que
 * escribirlo.
 */
export function TagInput({ selectedIds, onChange }: Props) {
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [creating, setCreating] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch("/api/tags")
      .then((r) => (r.ok ? r.json() : []))
      .then(setAllTags)
      .catch(() => setAllTags([]))
  }, [])

  useEffect(() => {
    const handler = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("pointerdown", handler)
    return () => document.removeEventListener("pointerdown", handler)
  }, [])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const folded = foldText(query.trim())
  const matches = folded ? allTags.filter((t) => foldText(t.name).includes(folded)) : allTags
  // Mismo nombre salvo mayúsculas o tildes: es el mismo tag, no uno nuevo.
  const exact = allTags.find((t) => foldText(t.name) === folded)

  const toggleTag = (tagId: string) => {
    if (selectedIds.includes(tagId)) {
      onChange(selectedIds.filter((id) => id !== tagId))
    } else {
      onChange([...selectedIds, tagId])
    }
  }

  const createTag = async () => {
    const name = query.trim()
    if (!name || creating) return
    if (exact) {
      if (!selectedIds.includes(exact.id)) onChange([...selectedIds, exact.id])
      setQuery("")
      return
    }
    setCreating(true)
    const res = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color: tagColorFor(name) }),
    }).catch(() => null)
    setCreating(false)
    if (res?.ok) {
      const tag = await res.json()
      setAllTags((prev) => [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)))
      onChange([...selectedIds, tag.id])
      setQuery("")
    }
  }

  const selected = allTags.filter((t) => selectedIds.includes(t.id))

  return (
    <div className="relative" ref={ref}>
      <div className="flex flex-wrap items-center gap-1.5">
        {selected.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex min-h-7 items-center gap-1 rounded-full pl-2.5 pr-1 text-xs font-medium text-white"
            style={{ backgroundColor: tag.color }}
          >
            {tag.name}
            <button
              type="button"
              onClick={() => toggleTag(tag.id)}
              aria-label={`Quitar ${tag.name}`}
              className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-black/20"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="inline-flex min-h-7 items-center gap-1 rounded-full border border-dashed border-white/15 px-2.5 text-xs text-zinc-400 transition-colors hover:border-white/30 hover:text-zinc-200"
        >
          <Plus className="h-3 w-3" /> {selected.length === 0 ? "Agregar tag" : "Tag"}
        </button>
      </div>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1.5 w-64 max-w-[calc(100vw-3rem)] rounded-xl border border-white/10 bg-[#18181b] p-2 shadow-xl shadow-black/40">
          <input
            ref={inputRef}
            className="mb-1.5 h-9 w-full rounded-lg border border-white/10 bg-[#0c0c0e] px-2.5 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-600"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                // Enter elige lo que se ve primero; si no hay nada, lo crea.
                const first = matches[0]
                if (!exact && first && folded) {
                  if (!selectedIds.includes(first.id)) onChange([...selectedIds, first.id])
                } else {
                  createTag()
                }
                setQuery("")
              }
              if (e.key === "Escape") {
                // Cierra la lista y nada más: el panel de la pieza sigue abierto.
                e.stopPropagation()
                setOpen(false)
              }
            }}
            placeholder="Buscar o crear tag…"
          />
          <div className="max-h-48 space-y-0.5 overflow-y-auto">
            {matches.map((tag) => {
              const on = selectedIds.includes(tag.id)
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={`flex min-h-9 w-full items-center gap-2 rounded-lg px-2 text-sm text-zinc-300 hover:bg-white/5 ${on ? "bg-white/5" : ""}`}
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: tag.color }} />
                  <span className="min-w-0 flex-1 truncate text-left">{tag.name}</span>
                  {on && <Check className="h-3.5 w-3.5 shrink-0 text-zinc-400" />}
                </button>
              )
            })}
            {folded && !exact && (
              <button
                type="button"
                onClick={createTag}
                disabled={creating}
                className="flex min-h-9 w-full items-center gap-2 rounded-lg px-2 text-sm text-zinc-300 hover:bg-white/5 disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Crear «{query.trim()}»</span>
              </button>
            )}
            {!folded && allTags.length === 0 && (
              <p className="px-2 py-1.5 text-xs text-zinc-500">
                Todavía no hay tags. Escribe uno y presiona Enter.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

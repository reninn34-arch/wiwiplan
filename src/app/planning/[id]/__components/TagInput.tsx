"use client"

import { useState, useEffect, useRef } from "react"
import { X, Plus } from "lucide-react"

interface Tag {
  id: string
  name: string
  color: string
}

interface Props {
  selectedIds: string[]
  onChange: (tagIds: string[]) => void
}

export function TagInput({ selectedIds, onChange }: Props) {
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [open, setOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch("/api/tags").then((r) => r.json()).then(setAllTags)
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const createTag = async () => {
    if (!newName.trim()) return
    const res = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    })
    if (res.ok) {
      const tag = await res.json()
      setAllTags((prev) => [...prev, tag])
      onChange([...selectedIds, tag.id])
      setNewName("")
    }
  }

  const toggleTag = (tagId: string) => {
    if (selectedIds.includes(tagId)) {
      onChange(selectedIds.filter((id) => id !== tagId))
    } else {
      onChange([...selectedIds, tagId])
    }
  }

  const selected = allTags.filter((t) => selectedIds.includes(t.id))

  return (
    <div className="relative" ref={ref}>
      <div className="flex flex-wrap gap-1">
        {selected.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
            style={{ backgroundColor: tag.color }}
          >
            {tag.name}
            <button type="button" onClick={() => toggleTag(tag.id)} className="hover:opacity-70">
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-white/10 px-2 py-0.5 text-[10px] text-zinc-400 hover:text-zinc-300"
        >
          <Plus className="h-2.5 w-2.5" />
        </button>
      </div>

      {open && (
        <div className="absolute left-0 top-full z-10 mt-1 w-56 rounded-lg border border-white/5 bg-[#18181b] p-2 shadow-lg">
          <div className="mb-2 flex gap-1">
            <input
              className="min-w-0 flex-1 rounded border border-white/10 bg-transparent px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-600"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); createTag() } }}
              placeholder="Nuevo tag..."
            />
            <button type="button" onClick={createTag} className="shrink-0 rounded bg-white px-2 py-1 text-xs text-black">
              <Plus className="h-3 w-3" />
            </button>
          </div>
          <div className="space-y-0.5">
            {allTags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.id)}
                className={`flex w-full items-center gap-2 rounded px-2 py-1 text-xs text-zinc-400 hover:bg-white/5 ${selectedIds.includes(tag.id) ? "bg-white/5" : ""}`}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: tag.color }} />
                {tag.name}
              </button>
            ))}
            {allTags.length === 0 && <p className="px-2 py-1 text-[10px] text-zinc-400">No hay tags todavía</p>}
          </div>
        </div>
      )}
    </div>
  )
}

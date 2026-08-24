"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Building2, CalendarDays, Lightbulb, Loader2, Search, X } from "lucide-react"
import { SEARCH_MIN_LENGTH, type SearchHit } from "@/lib/search"

/**
 * Búsqueda global. Responde "¿en qué mes hicimos ese carrusel de precios?",
 * que antes obligaba a acordarse del cliente y del mes para llegar a la pieza.
 *
 * Se abre con Ctrl/⌘+K en escritorio y con el botón de lupa en el celular,
 * donde ocupa la pantalla entera porque una paleta flotante ahí no se usa.
 */

const DEBOUNCE_MS = 220

const kindIcon = {
  client: Building2,
  planning: CalendarDays,
  idea: Lightbulb,
} as const

const kindLabel = {
  client: "Cliente",
  planning: "Mes",
  idea: "Pieza",
} as const

export function GlobalSearch() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [hits, setHits] = useState<SearchHit[]>([])
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const close = useCallback(() => {
    setOpen(false)
    setQuery("")
    setHits([])
    setActive(0)
  }, [])

  // Atajo global: Ctrl/⌘+K abre, Escape cierra.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  // Se busca mientras escribes, pero sin disparar una consulta por tecla. Cada
  // búsqueda cancela la anterior: con conexión lenta, si no, una respuesta
  // vieja podía pisar a una nueva.
  useEffect(() => {
    const term = query.trim()
    if (term.length < SEARCH_MIN_LENGTH) return

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        })
        if (!res.ok) throw new Error("búsqueda fallida")
        const data = (await res.json()) as { hits: SearchHit[] }
        setHits(data.hits)
        setActive(0)
      } catch (error) {
        if ((error as Error).name !== "AbortError") setHits([])
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [query])

  const go = useCallback(
    (hit: SearchHit) => {
      close()
      router.push(hit.href)
    },
    [close, router],
  )

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault()
      close()
      return
    }
    if (visibleHits.length === 0) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActive((i) => (i + 1) % visibleHits.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive((i) => (i - 1 + visibleHits.length) % visibleHits.length)
    } else if (e.key === "Enter") {
      e.preventDefault()
      const hit = visibleHits[active]
      if (hit) go(hit)
    }
  }

  // La opción activa se mantiene a la vista al moverse con el teclado.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({
      block: "nearest",
    })
  }, [active])

  const term = query.trim()
  // Se deriva en vez de limpiarse en el efecto: al borrar hasta dejar una sola
  // letra, los resultados de la búsqueda anterior dejan de mostrarse solos, sin
  // un `setState` de más ni una tanda extra de renders.
  const tooShort = term.length < SEARCH_MIN_LENGTH
  const visibleHits = tooShort ? [] : hits
  const showLoading = loading && !tooShort

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Buscar en todo"
        title="Buscar (Ctrl+K)"
        className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-white/5 hover:text-white sm:h-9 sm:w-auto sm:gap-2 sm:px-3"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="hidden text-sm text-zinc-500 sm:inline">Buscar</span>
        <kbd className="hidden rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-zinc-500 lg:inline">
          Ctrl K
        </kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/80 sm:flex sm:items-start sm:justify-center sm:pt-[12vh]"
          onClick={close}
        >
          <div
            className="flex h-full w-full flex-col bg-[#0c0c0e] sm:h-auto sm:max-h-[70vh] sm:w-full sm:max-w-xl sm:rounded-xl sm:border sm:border-white/10 sm:shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Buscar en todo"
          >
            <div className="flex shrink-0 items-center gap-2 border-b border-white/5 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 sm:pt-2">
              <Search className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Clientes, meses, piezas…"
                aria-label="Qué buscar"
                className="h-11 min-w-0 flex-1 bg-transparent text-base text-zinc-100 placeholder:text-zinc-600 focus:outline-none sm:text-sm"
              />
              {showLoading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-zinc-500" aria-hidden />}
              <button
                type="button"
                onClick={close}
                aria-label="Cerrar la búsqueda"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {tooShort ? (
                <p className="px-4 py-8 text-center text-sm text-zinc-500">
                  Escribe al menos dos letras. Busca en clientes, meses y piezas de contenido a la
                  vez.
                </p>
              ) : visibleHits.length === 0 && !showLoading ? (
                <p className="px-4 py-8 text-center text-sm text-zinc-500">
                  Nada coincide con «{term}».
                </p>
              ) : (
                <ul ref={listRef} className="py-1">
                  {visibleHits.map((hit, index) => {
                    const Icon = kindIcon[hit.kind]
                    return (
                      <li key={`${hit.kind}-${hit.id}`}>
                        <button
                          type="button"
                          data-index={index}
                          onMouseEnter={() => setActive(index)}
                          onClick={() => go(hit)}
                          className={`flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors ${
                            index === active ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
                          }`}
                        >
                          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-baseline gap-x-2">
                              <span className="truncate text-sm text-zinc-100">{hit.title}</span>
                              <span className="shrink-0 text-[10px] uppercase tracking-wider text-zinc-600">
                                {kindLabel[hit.kind]}
                              </span>
                            </span>
                            {hit.subtitle && (
                              <span className="mt-0.5 block truncate text-xs text-zinc-500">
                                {hit.subtitle}
                              </span>
                            )}
                            {hit.excerpt && (
                              <span className="mt-0.5 block truncate text-xs text-zinc-600">
                                {hit.excerpt}
                              </span>
                            )}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <div className="hidden shrink-0 items-center gap-3 border-t border-white/5 px-4 py-2 text-[11px] text-zinc-600 sm:flex">
              <span>↑↓ moverse</span>
              <span>↵ abrir</span>
              <span>Esc cerrar</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

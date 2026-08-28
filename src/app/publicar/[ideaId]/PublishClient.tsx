"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft, Check, Copy, ExternalLink, PartyPopper, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { describePublication, networkColors, networkLabels, networkOpenUrls, type SocialNetwork } from "@/lib/social"
import { formatPeriodLabel } from "@/lib/planning-period"

interface Target {
  accountId: string
  network: string
  handle: string
  mode: string
  publishedAt: string | null
}

interface Piece {
  id: string
  title: string
  description: string
  caption: string
  postType: string
  dueDate: string | null
  publishTime: string
  planningId: string
  period: string
  clientName: string
  imageIds: string[]
  targets: Target[]
}

const postTypeLabels: Record<string, string> = {
  CARROUSEL: "Carrusel",
  REEL: "Reel",
  VIDEO: "Video",
  IMAGE: "Imagen",
  STORY: "Historia",
  STATIC: "Estático",
  OTHER: "",
}

export function PublishClient({ piece }: { piece: Piece }) {
  const router = useRouter()
  const [targets, setTargets] = useState(piece.targets)
  const [caption, setCaption] = useState(piece.caption)
  const [savedCaption, setSavedCaption] = useState(piece.caption)
  const [busy, setBusy] = useState(false)

  const done = targets.filter((t) => t.publishedAt !== null).length
  const allDone = targets.length > 0 && done === targets.length
  const summary = describePublication(
    piece.dueDate,
    piece.publishTime,
    targets.map((t) => networkLabels[t.network as SocialNetwork] ?? t.network),
  )

  const copyCaption = async () => {
    if (!caption.trim()) {
      toast.error("Todavía no hay texto escrito")
      return
    }
    try {
      await navigator.clipboard.writeText(caption)
      toast.success("Texto copiado. Pégalo al publicar.")
    } catch {
      toast.error("No se pudo copiar. Selecciónalo y cópialo a mano.")
    }
  }

  const saveCaption = async () => {
    if (caption === savedCaption) return
    const res = await fetch(`/api/plannings/${piece.planningId}/ideas/${piece.id}/caption`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caption }),
    })
    if (!res.ok) {
      toast.error("No se pudo guardar el texto")
      return
    }
    setSavedCaption(caption)
  }

  /**
   * Publica ahora por la API, sin esperar a la hora. Es la forma de probar el
   * carril automático, y de reintentar a mano una pieza que falló.
   */
  const publicarAhora = async (target: Target) => {
    setBusy(true)
    const res = await fetch(`/api/plannings/${piece.planningId}/ideas/${piece.id}/publish-now`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: target.accountId }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)

    if (!res.ok) {
      toast.error(data.error ?? "No se pudo publicar", { duration: 10000 })
      return
    }
    if (data.estado === "procesando") {
      toast.success(data.mensaje ?? "Meta está procesando el archivo.", { duration: 8000 })
      return
    }
    toast.success("Publicada.")
    setTargets((prev) =>
      prev.map((t) =>
        t.accountId === target.accountId ? { ...t, publishedAt: new Date().toISOString() } : t,
      ),
    )
    router.refresh()
  }

  const togglePublished = async (target: Target) => {
    setBusy(true)
    const published = target.publishedAt === null
    const res = await fetch(`/api/plannings/${piece.planningId}/ideas/${piece.id}/published`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: target.accountId, published }),
    })
    setBusy(false)
    if (!res.ok) {
      toast.error("No se pudo marcar")
      return
    }
    const data = (await res.json()) as { targets: Array<{ accountId: string; publishedAt: string | null }> }
    setTargets((prev) =>
      prev.map((t) => {
        const fresh = data.targets.find((x) => x.accountId === t.accountId)
        return fresh ? { ...t, publishedAt: fresh.publishedAt } : t
      }),
    )
  }

  const typeLabel = postTypeLabels[piece.postType] ?? ""

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-300">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-white/5 bg-[#09090b]/95 px-3 pt-[env(safe-area-inset-top)] backdrop-blur sm:px-6">
        <button
          type="button"
          onClick={() => router.push("/agenda")}
          aria-label="Volver a la agenda"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
        >
          <ArrowLeft size={18} />
        </button>
        <span className="truncate py-2 text-sm font-medium text-zinc-200">Publicar</span>
      </header>

      <main className="mx-auto max-w-xl px-4 pb-[max(3rem,env(safe-area-inset-bottom))] pt-6 sm:px-6">
        {/* ── Qué es y cuándo sale ── */}
        <div className="mb-5">
          <p className="text-xs text-zinc-500">
            {piece.clientName}
            {typeLabel && ` · ${typeLabel}`}
            {piece.period && ` · ${formatPeriodLabel(piece.period)}`}
          </p>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-zinc-100">
            {piece.title || "Sin título"}
          </h1>
          <p className={`mt-1 text-sm ${allDone ? "text-emerald-300" : "text-zinc-400"}`}>
            {summary.sentence}
          </p>
          {piece.description && (
            <p className="mt-2 text-sm text-zinc-500">{piece.description}</p>
          )}
        </div>

        {allDone && (
          <div className="mb-5 flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300 ring-1 ring-inset ring-emerald-400/25">
            <PartyPopper className="h-4 w-4 shrink-0" aria-hidden />
            Ya salió en todas sus redes. No queda nada por hacer.
          </div>
        )}

        {/* ── Las referencias, para saber cuál es ── */}
        {piece.imageIds.length > 0 && (
          <div className="mb-5">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              Referencias
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {piece.imageIds.map((imageId) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={imageId}
                  src={`/api/idea-images/${imageId}`}
                  alt=""
                  className="h-28 w-28 shrink-0 rounded-lg object-cover ring-1 ring-inset ring-white/10"
                />
              ))}
            </div>
          </div>
        )}

        {/* ── El copy, listo para pegar ── */}
        <div className="mb-5 rounded-xl border border-white/5 bg-[#0c0c0e] p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              Texto de la publicación
            </p>
            <Button size="sm" className="h-9 text-xs" onClick={copyCaption}>
              <Copy className="h-3.5 w-3.5" /> Copiar
            </Button>
          </div>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            onBlur={saveCaption}
            rows={6}
            placeholder="Escribe acá el texto que va en el post. Se guarda solo."
            aria-label="Texto de la publicación"
            className="w-full resize-y rounded-lg border border-white/10 bg-[#18181b] px-3 py-2 text-base text-zinc-100 placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500 sm:text-sm"
          />
          <p className="mt-2 text-xs text-zinc-500">
            {caption === savedCaption ? "Guardado." : "Sin guardar — toca fuera del recuadro."}
          </p>
        </div>

        {/* ── Una fila por red: abrir y marcar ── */}
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            Dónde sale {targets.length > 0 && `(${done} de ${targets.length} listas)`}
          </p>

          {targets.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-zinc-400">
              Esta pieza no tiene redes elegidas. Vuelve al calendario del mes y dile dónde sale.
            </p>
          ) : (
            targets.map((target) => {
              const network = target.network as SocialNetwork
              const published = target.publishedAt !== null
              return (
                <div
                  key={target.accountId}
                  className={`flex flex-wrap items-center gap-2 rounded-xl border p-3 transition-colors ${
                    published
                      ? "border-emerald-400/20 bg-emerald-500/[0.06]"
                      : "border-white/5 bg-[#0c0c0e]"
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: networkColors[network] ?? "#71717a" }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-zinc-200">
                      {networkLabels[network] ?? target.network}
                    </span>
                    {target.handle && (
                      <span className="block truncate text-xs text-zinc-500">@{target.handle}</span>
                    )}
                  </span>

                  {!published &&
                    (target.mode === "AUTOMATIC" ? (
                      <button
                        type="button"
                        onClick={() => publicarAhora(target)}
                        disabled={busy}
                        className="inline-flex h-10 items-center gap-1.5 rounded-md px-3 text-xs text-emerald-300 ring-1 ring-inset ring-emerald-400/30 transition-colors hover:text-emerald-200 disabled:opacity-50"
                      >
                        <Zap className="h-3.5 w-3.5" /> Publicar ahora
                      </button>
                    ) : (
                      <a
                        href={networkOpenUrls[network] ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-10 items-center gap-1.5 rounded-md px-3 text-xs text-zinc-300 ring-1 ring-inset ring-white/15 transition-colors hover:text-white"
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> Abrir
                      </a>
                    ))}

                  <button
                    type="button"
                    onClick={() => togglePublished(target)}
                    disabled={busy || (target.mode === "AUTOMATIC" && !published)}
                    title={
                      target.mode === "AUTOMATIC" && !published
                        ? "Esta cuenta publica sola: la marca el sistema al salir"
                        : undefined
                    }
                    className={`inline-flex h-10 items-center gap-1.5 rounded-md px-3 text-xs transition-colors disabled:opacity-50 ${
                      published
                        ? "text-emerald-300 ring-1 ring-inset ring-emerald-400/30 hover:text-emerald-200"
                        : "bg-brand text-white hover:bg-[#d0424a]"
                    }`}
                  >
                    {published ? (
                      <>
                        <Check className="h-3.5 w-3.5" /> Ya salió
                      </>
                    ) : (
                      "Marcar como publicada"
                    )}
                  </button>
                </div>
              )
            })
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-10 text-xs"
            onClick={() => router.push("/agenda")}
          >
            Volver a la agenda
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-10 text-xs text-zinc-400 hover:text-zinc-100"
            onClick={() => router.push(`/planning/${piece.planningId}?idea=${piece.id}`)}
          >
            Ver en el mes
          </Button>
        </div>
      </main>
    </div>
  )
}

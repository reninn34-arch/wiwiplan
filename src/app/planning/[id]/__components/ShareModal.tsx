"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Check, Copy, ExternalLink, Link2, Mail, RefreshCw, Share2, X } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * El enlace que ve el cliente.
 *
 * **Uno por plan, siempre.** Antes se acumulaban y el mismo mes quedaba
 * repartido en varias direcciones vivas: al regenerar una, las otras seguían
 * abiertas y no había forma de saber cuál tenía el cliente. Ahora regenerar
 * reemplaza, y la base lo garantiza con una restricción.
 */

interface ShareLink {
  id: string
  token: string
  expiresAt: string | null
  createdAt: string
}

interface Props {
  planningId: string
  shareLinks: ShareLink[]
  /** Para armar el mensaje: "la planificación de agosto de Olivo". */
  planningTitle?: string
  clientName?: string
  onCreated?: (link: ShareLink) => void
  onClose: () => void
}

export function ShareModal({
  planningId,
  shareLinks: initial,
  planningTitle,
  clientName,
  onCreated,
  onClose,
}: Props) {
  const [link, setLink] = useState<ShareLink | null>(initial[0] ?? null)
  const [copiado, setCopiado] = useState(false)
  const [trabajando, setTrabajando] = useState(false)

  const url = link ? `${window.location.origin}/share/${link.token}` : ""
  const asunto = `Planificación${clientName ? ` de ${clientName}` : ""}${
    planningTitle && planningTitle !== "Sin título" ? ` — ${planningTitle}` : ""
  }`
  const mensaje = `${asunto}\n\nAcá puedes verla, comentar cada pieza y aprobarla:\n${url}`

  const generar = async () => {
    if (trabajando) return
    // Regenerar rompe el enlace que el cliente ya tiene. Es reversible sólo
    // volviendo a mandarle el nuevo, así que se pregunta antes.
    if (link && !confirm("El enlace actual dejará de funcionar. ¿Generar uno nuevo?")) return

    setTrabajando(true)
    const res = await fetch(`/api/plannings/${planningId}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
    setTrabajando(false)

    if (!res.ok) {
      toast.error("No se pudo generar el enlace")
      return
    }
    const nuevo = await res.json()
    setLink(nuevo)
    onCreated?.(nuevo)
    toast.success(link ? "Enlace nuevo. El anterior ya no funciona." : "Enlace listo.")
  }

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      toast.error("No se pudo copiar. Selecciónalo y cópialo a mano.")
    }
  }

  /**
   * El menú del sistema: en el celular abre la lista completa de apps
   * instaladas, que es lo que la gente espera al tocar "compartir". En
   * escritorio no suele existir, y por eso debajo están las salidas directas.
   */
  const compartirNativo = async () => {
    if (!navigator.share) {
      toast.info("Tu navegador no tiene menú de compartir. Usa los botones de abajo.")
      return
    }
    try {
      await navigator.share({ title: asunto, text: mensaje })
    } catch {
      /* lo canceló: no es un error */
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-0 sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md rounded-t-2xl border border-white/10 bg-[#0c0c0e] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-100">Compartir con el cliente</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-9 w-9 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!link ? (
          <>
            <p className="mb-4 text-sm text-zinc-400">
              Todavía no hay enlace. Al generarlo, quien lo tenga podrá ver la planificación,
              comentar cada pieza y aprobarla — sin necesidad de cuenta.
            </p>
            <Button
              className="w-full bg-brand text-white hover:bg-[#d0424a]"
              onClick={generar}
              disabled={trabajando}
            >
              <Link2 className="h-4 w-4" /> {trabajando ? "Generando…" : "Crear enlace"}
            </Button>
          </>
        ) : (
          <>
            <p className="mb-3 text-xs text-zinc-500">
              Hay un solo enlace por planificación. Cualquiera que lo tenga puede verla.
            </p>

            <div className="mb-3 flex items-center gap-2 rounded-lg border border-white/10 bg-[#18181b] p-1.5">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir como lo ve el cliente"
                className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-xs text-zinc-300 transition-colors hover:bg-white/5"
              >
                <span className="truncate">{url}</span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />
              </a>
              <button
                type="button"
                onClick={copiar}
                aria-label="Copiar enlace"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-100"
              >
                {copiado ? (
                  <Check className="h-4 w-4 text-emerald-400" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>

            <Button
              className="mb-2 w-full bg-brand text-white hover:bg-[#d0424a]"
              onClick={compartirNativo}
            >
              <Share2 className="h-4 w-4" /> Compartir…
            </Button>

            {/* Salidas directas: en escritorio no hay menú del sistema, y en el
                celular hay quien prefiere ir al grano. */}
            <div className="grid grid-cols-2 gap-2">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(mensaje)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-11 items-center justify-center gap-2 rounded-md bg-white/[0.06] text-sm text-zinc-200 transition-colors hover:bg-white/[0.1]"
              >
                <span className="text-[#25D366]">●</span> WhatsApp
              </a>
              <a
                href={`mailto:?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(mensaje)}`}
                className="flex min-h-11 items-center justify-center gap-2 rounded-md bg-white/[0.06] text-sm text-zinc-200 transition-colors hover:bg-white/[0.1]"
              >
                <Mail className="h-4 w-4 text-zinc-400" /> Correo
              </a>
            </div>

            <button
              type="button"
              onClick={generar}
              disabled={trabajando}
              className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-md text-xs text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${trabajando ? "animate-spin" : ""}`} />
              Generar uno nuevo y anular éste
            </button>
          </>
        )}
      </div>
    </div>
  )
}

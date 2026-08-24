"use client"

import { useState, useEffect, useRef, useCallback, useSyncExternalStore } from "react"
import { createPortal } from "react-dom"
import { Bell, CheckCheck, MessageSquare, ThumbsUp, X } from "lucide-react"
import Link from "next/link"

interface Notification {
  id: string
  type: string
  title: string
  message: string
  link: string
  read: boolean
  createdAt: string
}

/** Fecha corta y legible: en el panel angosto no entra el timestamp completo. */
function timeAgo(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const diffMs = Date.now() - date.getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return "ahora"
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  if (days === 1) return "ayer"
  if (days < 7) return `hace ${days} días`
  return date.toLocaleDateString("es-EC", { day: "numeric", month: "short" })
}

const MOBILE_QUERY = "(max-width: 639px)"

const emptySubscribe = () => () => {}

/** El portal necesita el body: en el servidor no existe. */
function useMounted() {
  return useSyncExternalStore(emptySubscribe, () => true, () => false)
}

/** El ancho manda el formato: hoja inferior en el teléfono, panel en escritorio. */
function useIsMobile() {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(MOBILE_QUERY)
      media.addEventListener("change", onChange)
      return () => media.removeEventListener("change", onChange)
    },
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false,
  )
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const mounted = useMounted()
  const isMobile = useIsMobile()
  // Posición del panel en escritorio, calculada desde el botón.
  const [anchor, setAnchor] = useState({ top: 0, right: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchNotifs = async () => {
      try {
        const res = await fetch("/api/notifications")
        if (res.ok) {
          const data = await res.json()
          setUnread(data.unread)
          setNotifications(data.notifications)
        }
      } catch {}
    }
    // Sin consultas mientras la pestaña está en segundo plano: al volver,
    // una sola consulta pone al día el contador.
    const tick = () => {
      if (document.visibilityState === "visible") fetchNotifs()
    }
    tick()
    const interval = setInterval(tick, 30000)
    document.addEventListener("visibilitychange", tick)
    return () => {
      clearInterval(interval)
      document.removeEventListener("visibilitychange", tick)
    }
  }, [])

  /**
   * El panel se dibuja con un portal en el body. Es obligatorio: el header
   * usa backdrop-blur y eso convierte al header en el marco de referencia de
   * los elementos position:fixed, así que un panel dentro del header quedaba
   * anclado al header y no a la pantalla.
   */
  const placePanel = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return
    // clientWidth y no innerWidth: innerWidth incluye la barra de
    // desplazamiento y el panel quedaba corrido unos píxeles del botón.
    setAnchor({ top: rect.bottom + 8, right: document.documentElement.clientWidth - rect.right })
  }, [])

  // La posición inicial se calcula al abrir; aquí solo se sigue al scroll.
  useEffect(() => {
    if (!open || isMobile) return
    window.addEventListener("resize", placePanel)
    window.addEventListener("scroll", placePanel, true)
    return () => {
      window.removeEventListener("resize", placePanel)
      window.removeEventListener("scroll", placePanel, true)
    }
  }, [open, isMobile, placePanel])

  // Cerrar al tocar fuera (botón y panel viven en árboles distintos) o con Escape.
  useEffect(() => {
    if (!open) return
    const handler = (e: PointerEvent) => {
      const target = e.target as Node
      if (buttonRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("pointerdown", handler)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", handler)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  // Con el panel abierto en móvil, el fondo no debe desplazarse detrás.
  useEffect(() => {
    if (!open || !isMobile) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [open, isMobile])

  const markAsRead = async () => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id)
    if (unreadIds.length === 0) return
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: unreadIds }),
    })
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnread(0)
  }

  const icon = (type: string) =>
    type === "approve" ? (
      <ThumbsUp className="h-4 w-4 shrink-0 text-green-500" />
    ) : (
      <MessageSquare className="h-4 w-4 shrink-0 text-blue-500" />
    )

  const panel = (
    <>
      {/* Fondo solo en móvil: el panel ocupa el ancho completo abajo */}
      {isMobile && (
        <div className="fixed inset-0 z-[60] bg-black/60" onClick={() => setOpen(false)} aria-hidden />
      )}

      <div
        ref={panelRef}
        role="dialog"
        aria-label="Notificaciones"
        style={
          isMobile
            ? undefined
            : { top: anchor.top, right: anchor.right, width: "24rem", maxHeight: "26rem" }
        }
        className={
          isMobile
            ? "fixed inset-x-0 bottom-0 z-[61] flex max-h-[75vh] flex-col rounded-t-2xl border border-white/10 bg-[#0c0c0e] shadow-2xl"
            : "fixed z-[61] flex flex-col rounded-lg border border-white/5 bg-[#0c0c0e] shadow-2xl"
        }
      >
        {/* Tirador: señal visual de que el panel se cierra desde abajo */}
        {isMobile && (
          <div className="flex justify-center pt-2">
            <span className="h-1 w-10 rounded-full bg-white/15" aria-hidden />
          </div>
        )}

        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/5 px-4 py-3 sm:px-3 sm:py-2">
          <span className="text-sm font-semibold text-zinc-200 sm:text-xs">Notificaciones</span>
          <div className="flex items-center gap-1">
            {unread > 0 && (
              <button
                type="button"
                onClick={markAsRead}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-xs text-zinc-300 transition-colors hover:bg-white/5 hover:text-white sm:min-h-0 sm:py-1 sm:text-[11px]"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Marcar leídas
              </button>
            )}
            {isMobile && (
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="flex h-9 w-9 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-100"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)] sm:pb-0">
          {notifications.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-zinc-400 sm:py-6 sm:text-xs">
              Sin notificaciones
            </p>
          ) : (
            notifications.map((n) => (
              <Link
                key={n.id}
                href={n.link}
                onClick={() => setOpen(false)}
                className={`flex items-start gap-3 border-b border-white/5 px-4 py-3.5 transition-colors last:border-b-0 hover:bg-white/[0.03] sm:gap-2 sm:px-3 sm:py-2.5 ${
                  n.read ? "" : "bg-white/[0.03]"
                }`}
              >
                <span className="mt-0.5">{icon(n.type)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-sm font-medium text-zinc-100 sm:text-xs">{n.title}</p>
                    <span className="shrink-0 text-[11px] text-zinc-500 sm:text-[10px]">
                      {timeAgo(n.createdAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-sm text-zinc-400 sm:text-xs">{n.message}</p>
                </div>
                {!n.read && (
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" aria-label="Sin leer" />
                )}
              </Link>
            ))
          )}
        </div>
      </div>
    </>
  )

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          if (!open) placePanel()
          setOpen(!open)
        }}
        aria-label={unread > 0 ? `Notificaciones: ${unread} sin leer` : "Notificaciones"}
        aria-expanded={open}
        className="relative flex h-10 w-10 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-100"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold tabular-nums text-brand-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && mounted && createPortal(panel, document.body)}
    </div>
  )
}

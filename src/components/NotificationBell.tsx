"use client"

import { useState, useEffect, useRef } from "react"
import { Bell, CheckCheck, MessageSquare, ThumbsUp, ExternalLink } from "lucide-react"
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

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const ref = useRef<HTMLDivElement>(null)

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
    fetchNotifs()
    const interval = setInterval(fetchNotifs, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

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
    type === "approve" ? <ThumbsUp className="h-3.5 w-3.5 shrink-0 text-green-500" /> : <MessageSquare className="h-3.5 w-3.5 shrink-0 text-blue-500" />

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border bg-card shadow-lg">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-xs font-semibold">Notificaciones</span>
            {unread > 0 && (
              <button type="button" onClick={markAsRead} className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline">
                <CheckCheck className="h-3 w-3" /> Leer todas
              </button>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">Sin notificaciones</p>
            ) : (
              notifications.map((n) => (
                <Link
                  key={n.id}
                  href={n.link}
                  onClick={() => setOpen(false)}
                  className={`flex items-start gap-2 border-b px-3 py-2 text-xs transition-colors hover:bg-muted/50 ${n.read ? "" : "bg-muted/20"}`}
                >
                  {icon(n.type)}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{n.title}</p>
                    <p className="text-muted-foreground line-clamp-2">{n.message}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{new Date(n.createdAt).toLocaleString("es-AR")}</p>
                  </div>
                  <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

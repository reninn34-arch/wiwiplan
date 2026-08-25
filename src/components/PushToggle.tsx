"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Bell, BellOff, BellRing } from "lucide-react"

/**
 * Interruptor de los avisos de publicación en **este** dispositivo.
 *
 * El permiso lo da el navegador, no la app, y es por dispositivo: activarlo en
 * la computadora no lo activa en el teléfono. Por eso el texto habla siempre de
 * "este dispositivo" en vez de dar a entender que es una preferencia de cuenta.
 */

type State = "cargando" | "no-soportado" | "instalar-primero" | "apagado" | "encendido" | "bloqueado"

/** La llave pública viaja en base64url y el navegador la quiere en bytes. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4)
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(normalized)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i)
  return output
}

/**
 * En iPhone el push sólo existe si la app está instalada en la pantalla de
 * inicio. En Safari a secas no hay forma, y decirlo claro evita que alguien
 * toque el botón diez veces esperando que funcione.
 */
function isIosWithoutInstall(): boolean {
  if (typeof window === "undefined") return false
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent)
  if (!ios) return false
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  return !standalone
}

export function PushToggle() {
  const [state, setState] = useState<State>("cargando")
  const [busy, setBusy] = useState(false)

  // Devuelve el estado en vez de asignarlo, para que el efecto no haga
  // `setState` de forma síncrona: el `.then` siempre lo deja para después.
  const computeState = useCallback(async (): Promise<State> => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      return isIosWithoutInstall() ? "instalar-primero" : "no-soportado"
    }
    if (Notification.permission === "denied") return "bloqueado"

    const registration = await navigator.serviceWorker.ready
    const existing = await registration.pushManager.getSubscription()
    return existing ? "encendido" : "apagado"
  }, [])

  useEffect(() => {
    let cancelled = false
    computeState()
      .then((next) => {
        if (!cancelled) setState(next)
      })
      .catch(() => {
        if (!cancelled) setState("no-soportado")
      })
    return () => {
      cancelled = true
    }
  }, [computeState])

  const turnOn = async () => {
    setBusy(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        setState(permission === "denied" ? "bloqueado" : "apagado")
        return
      }

      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!key) {
        toast.error("Faltan las llaves de aviso en el servidor")
        return
      }

      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
      })

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...subscription.toJSON(), label: navigator.userAgent.slice(0, 80) }),
      })
      if (!res.ok) {
        await subscription.unsubscribe()
        toast.error("No se pudo activar el aviso")
        return
      }

      setState("encendido")
      toast.success("Listo. Te vamos a avisar en este dispositivo cuando toque publicar.")
    } catch (error) {
      console.error(error)
      toast.error("No se pudo activar el aviso")
    } finally {
      setBusy(false)
    }
  }

  const turnOff = async () => {
    setBusy(true)
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        })
        await subscription.unsubscribe()
      }
      setState("apagado")
      toast.success("Listo, no te avisamos más en este dispositivo.")
    } catch (error) {
      console.error(error)
      toast.error("No se pudo desactivar")
    } finally {
      setBusy(false)
    }
  }

  if (state === "cargando") return null

  const box = "rounded-xl border border-white/5 bg-[#0c0c0e] p-4"

  if (state === "no-soportado") {
    return (
      <div className={box}>
        <p className="flex items-start gap-2 text-sm text-zinc-400">
          <BellOff className="mt-0.5 h-4 w-4 shrink-0 text-zinc-600" aria-hidden />
          Este navegador no puede recibir avisos. Abre WiwiPlan desde el teléfono para que te avise
          cuando toque publicar.
        </p>
      </div>
    )
  }

  if (state === "instalar-primero") {
    return (
      <div className={box}>
        <p className="flex items-start gap-2 text-sm text-zinc-400">
          <BellOff className="mt-0.5 h-4 w-4 shrink-0 text-zinc-600" aria-hidden />
          <span>
            En iPhone los avisos sólo funcionan con la app instalada. Toca{" "}
            <strong className="text-zinc-300">Compartir</strong> y luego{" "}
            <strong className="text-zinc-300">Agregar a inicio</strong>; después vuelve acá y
            actívalos.
          </span>
        </p>
      </div>
    )
  }

  if (state === "bloqueado") {
    return (
      <div className={box}>
        <p className="flex items-start gap-2 text-sm text-zinc-400">
          <BellOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-400/70" aria-hidden />
          Bloqueaste los avisos en este dispositivo. Se vuelven a permitir desde los ajustes del
          navegador, en el candado junto a la dirección.
        </p>
      </div>
    )
  }

  const on = state === "encendido"

  return (
    <div className={box}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-start gap-2 text-sm text-zinc-300">
          {on ? (
            <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
          ) : (
            <Bell className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
          )}
          <span>
            {on
              ? "Te avisamos en este dispositivo cuando llegue la hora de publicar."
              : "Actívalos y te avisamos en este dispositivo cuando toque publicar."}
          </span>
        </p>
        <button
          type="button"
          onClick={on ? turnOff : turnOn}
          disabled={busy}
          className={`shrink-0 rounded-md px-3 py-2 text-xs transition-colors disabled:opacity-50 ${
            on
              ? "text-zinc-400 ring-1 ring-inset ring-white/10 hover:text-zinc-200"
              : "bg-brand text-white hover:bg-[#d0424a]"
          }`}
        >
          {busy ? "Un momento…" : on ? "Desactivar" : "Activar avisos"}
        </button>
      </div>
    </div>
  )
}

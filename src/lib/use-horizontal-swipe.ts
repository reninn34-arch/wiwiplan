"use client"

import { useRef, useState, type MouseEvent, type PointerEvent } from "react"

/**
 * Deslizar con el dedo hacia un lado, sin pelear con el desplazamiento de la
 * página.
 *
 * El gesto sólo arranca cuando el dedo se movió claramente en horizontal: con
 * que se incline un poco hacia arriba o abajo, es scroll y se suelta. El
 * elemento tiene que llevar `touch-action: pan-y` (`touch-pan-y`), así el
 * navegador sigue desplazando en vertical y el horizontal queda para nosotros.
 *
 * Sólo toque y lápiz: con el ratón nadie "desliza", arrastra, y eso ya lo
 * cubren las otras formas de hacer lo mismo.
 */

export type SwipeDirection = "left" | "right"

interface Options {
  /** Hacia dónde se puede deslizar. Hacia el otro lado el elemento no se mueve. */
  allow: { left?: boolean; right?: boolean }
  /** Píxeles a partir de los cuales soltar dispara la acción. */
  threshold?: number
  onSwipe: (direction: SwipeDirection) => void
  /** Si el dedo apoya sobre algo que coincide, no hay gesto: campos de texto, menús. */
  ignoreSelector?: string
  enabled?: boolean
}

/** Cuánto hay que moverse antes de decidir si es gesto o scroll. */
const SLOP = 10

export function useHorizontalSwipe({
  allow,
  threshold = 88,
  onSwipe,
  ignoreSelector,
  enabled = true,
}: Options) {
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const start = useRef<{ x: number; y: number; t: number; id: number } | null>(null)
  const axis = useRef<"h" | "v" | null>(null)
  const armed = useRef(false)
  /** Cuándo terminó el último gesto, para que el toque de salida no cuente como clic. */
  const swipedAt = useRef(-Infinity)

  const reset = () => {
    start.current = null
    axis.current = null
    armed.current = false
    setDragging(false)
    setDx(0)
  }

  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    if (!enabled || e.pointerType === "mouse") return
    // Un menú abierto vive en un portal, pero sus eventos suben por el árbol
    // de React hasta acá: deslizar dentro de él no puede mover la fila.
    if (!e.currentTarget.contains(e.target as Node)) return
    if (ignoreSelector && (e.target as Element).closest(ignoreSelector)) return
    start.current = { x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId }
    axis.current = null
  }

  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    const s = start.current
    if (!s || e.pointerId !== s.id) return
    const mx = e.clientX - s.x
    const my = e.clientY - s.y

    if (!axis.current) {
      if (Math.abs(mx) > SLOP && Math.abs(mx) > Math.abs(my) * 1.3) {
        axis.current = "h"
        setDragging(true)
        e.currentTarget.setPointerCapture?.(e.pointerId)
      } else if (Math.abs(my) > SLOP) {
        // Es scroll: se suelta y el navegador sigue solo.
        start.current = null
        return
      } else {
        return
      }
    }

    const allowed = mx > 0 ? allow.right : allow.left
    const x = allowed ? mx : 0
    const nowArmed = Math.abs(x) >= threshold
    if (nowArmed !== armed.current) {
      armed.current = nowArmed
      // Un toque corto al cruzar el umbral, como en las apps de correo: avisa
      // que soltar ahora hace algo. Sólo existe en Android; iOS lo ignora.
      if (nowArmed) navigator.vibrate?.(8)
    }
    setDx(x)
  }

  const onPointerUp = (e: PointerEvent<HTMLElement>) => {
    const s = start.current
    if (!s || axis.current !== "h") {
      reset()
      return
    }
    const mx = e.clientX - s.x
    const velocity = Math.abs(mx) / Math.max(e.timeStamp - s.t, 1)
    const direction: SwipeDirection = mx > 0 ? "right" : "left"
    const allowed = direction === "right" ? allow.right : allow.left
    // Un golpe rápido cuenta aunque no llegue al umbral: es como se desliza
    // con el pulgar, sin arrastrar hasta la mitad de la pantalla.
    const passed = Math.abs(mx) >= threshold || (Math.abs(mx) >= threshold / 2 && velocity > 0.6)
    swipedAt.current = performance.now()
    reset()
    if (allowed && passed) onSwipe(direction)
  }

  const onClickCapture = (e: MouseEvent<HTMLElement>) => {
    if (performance.now() - swipedAt.current < 400) {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  return {
    dx,
    dragging,
    armed: Math.abs(dx) >= threshold,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: reset,
      onClickCapture,
    },
  }
}

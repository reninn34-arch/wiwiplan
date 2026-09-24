"use client"

import { useState, type ReactNode } from "react"
import { useHorizontalSwipe, type SwipeDirection } from "@/lib/use-horizontal-swipe"

/**
 * Una fila que se desliza para actuar, como un correo en el celular.
 *
 * Cada lado es opcional y cada acción tiene que existir también de otra forma
 * —en un menú, en un botón—: el gesto acelera, no es el único camino.
 */

export interface SwipeAction {
  label: string
  icon: ReactNode
  /** Fondo que aparece detrás mientras se desliza. */
  className: string
  onTrigger: () => void
  /** La fila sale volando antes de actuar: para lo que la quita de la lista. */
  dismiss?: boolean
}

/** Campos y menús: apoyar el dedo ahí es para usarlos, no para deslizar. */
const IGNORE = "input, textarea, select, [contenteditable='true'], [data-no-swipe]"

export function SwipeableRow({
  onSwipeRight,
  onSwipeLeft,
  className,
  children,
}: {
  /** Lo que pasa al deslizar hacia la derecha (el fondo asoma a la izquierda). */
  onSwipeRight?: SwipeAction | null
  /** Lo que pasa al deslizar hacia la izquierda (el fondo asoma a la derecha). */
  onSwipeLeft?: SwipeAction | null
  className?: string
  children: ReactNode
}) {
  const [leaving, setLeaving] = useState<SwipeDirection | null>(null)

  const run = (direction: SwipeDirection) => {
    const action = direction === "right" ? onSwipeRight : onSwipeLeft
    if (!action) return
    if (action.dismiss) {
      setLeaving(direction)
      setTimeout(() => {
        action.onTrigger()
        setLeaving(null)
      }, 180)
    } else {
      action.onTrigger()
    }
  }

  const { dx, dragging, armed, handlers } = useHorizontalSwipe({
    allow: { right: !!onSwipeRight, left: !!onSwipeLeft },
    onSwipe: run,
    ignoreSelector: IGNORE,
  })

  const shown = dx > 0 ? onSwipeRight : dx < 0 ? onSwipeLeft : null
  const offset = leaving === "right" ? "110%" : leaving === "left" ? "-110%" : `${dx}px`

  return (
    <div className={`relative overflow-hidden rounded-lg ${className ?? ""}`}>
      {shown && (
        <div
          aria-hidden
          className={`absolute inset-0 flex items-center gap-2 px-5 text-sm font-semibold text-white ${
            dx > 0 ? "justify-start" : "justify-end"
          } ${shown.className}`}
        >
          <span className={`transition-transform duration-150 ${armed ? "scale-110" : "scale-90 opacity-80"}`}>
            {shown.icon}
          </span>
          <span className={armed ? "" : "opacity-80"}>{shown.label}</span>
        </div>
      )}
      <div
        {...handlers}
        className="relative touch-pan-y"
        style={{
          transform: `translateX(${offset})`,
          transition: dragging ? "none" : "transform 180ms ease-out",
        }}
      >
        {children}
      </div>
    </div>
  )
}

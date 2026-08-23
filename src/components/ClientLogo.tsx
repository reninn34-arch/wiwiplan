"use client"

import { useState } from "react"
import { clientLogoUrl } from "@/lib/media"

interface Props {
  clientId: string
  name: string
  /** Lado del avatar en px. */
  size?: number
  className?: string
  /** Cambia para volver a pedir la imagen después de subir una nueva. */
  version?: number
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return "?"
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

/**
 * Avatar del cliente. La imagen se pide al servidor por URL (cacheable) en vez
 * de venir embebida en base64; si el cliente no tiene logo, el endpoint
 * responde 404 y queda la inicial.
 */
export function ClientLogo({ clientId, name, size = 28, className = "", version }: Props) {
  // Guardamos qué imagen falló, no un booleano: al cambiar de cliente o de
  // versión la clave deja de coincidir y se vuelve a intentar sola.
  const [failedSrc, setFailedSrc] = useState<string | null>(null)

  const src = `${clientLogoUrl(clientId)}${version ? `?v=${version}` : ""}`
  const style = { width: size, height: size }
  const base = `shrink-0 overflow-hidden rounded-full ${className}`

  if (failedSrc === src) {
    return (
      <span
        style={{ ...style, fontSize: Math.max(9, Math.round(size * 0.38)) }}
        className={`${base} inline-flex items-center justify-center bg-white/[0.06] font-semibold leading-none text-zinc-300`}
        aria-hidden
      >
        {initials(name)}
      </span>
    )
  }

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      style={style}
      className={`${base} bg-white/[0.06] object-cover`}
      onError={() => setFailedSrc(src)}
    />
  )
}

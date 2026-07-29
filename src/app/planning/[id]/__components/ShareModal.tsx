"use client"

import { useState } from "react"
import { X, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface ShareLink {
  id: string
  token: string
  expiresAt: string | null
  createdAt: string
}

interface Props {
  planningId: string
  shareLinks: ShareLink[]
  onClose: () => void
}

export function ShareModal({ planningId, shareLinks: initial, onClose }: Props) {
  const [links, setLinks] = useState(initial)
  const [copied, setCopied] = useState<string | null>(null)

  const createLink = async () => {
    const res = await fetch(`/api/plannings/${planningId}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
    if (res.ok) {
      const link = await res.json()
      setLinks((prev) => [link, ...prev])
    }
  }

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/share/${token}`
    navigator.clipboard.writeText(url)
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="w-full max-w-md rounded-lg border border-white/5 bg-[#0c0c0e] p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-200">Compartir Planificación</h2>
          <button type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X className="h-5 w-5" />
          </button>
        </div>

        <Button className="mb-4 w-full bg-white text-black hover:bg-zinc-200" onClick={createLink}>
          Generar nuevo enlace
        </Button>

        {links.length === 0 ? (
          <p className="py-4 text-center text-sm text-zinc-500">
            No hay enlaces de compartir generados.
          </p>
        ) : (
          <div className="space-y-2">
            {links.map((link) => (
              <div key={link.id} className="flex items-center gap-2 rounded-md border border-white/5 bg-[#0c0c0e] p-2">
                <Input
                  readOnly
                  value={`${window.location.origin}/share/${link.token}`}
                  className="flex-1 text-xs"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyLink(link.token)}
                >
                  {copied === link.token ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

"use client"

import { useState } from "react"
import { Plus, Trash2, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { detectEmbed, platformLabel } from "@/lib/embeds"

interface Video {
  id: string
  url: string
  title: string
  platform: string
  embedUrl: string
  thumbnailUrl: string
  notes: string
  order: number
}

interface Props {
  planningId: string
  videos: Video[]
}

export function VideoReferencesTab({ planningId, videos: initial }: Props) {
  const [videos, setVideos] = useState(initial)
  const [newUrl, setNewUrl] = useState("")

  const addVideo = async () => {
    if (!newUrl.trim()) return
    const detected = detectEmbed(newUrl)
    const res = await fetch(`/api/plannings/${planningId}/videos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: newUrl,
        platform: detected?.platform ?? "OTHER",
        embedUrl: detected?.embedUrl ?? "",
        title: "",
      }),
    })
    if (res.ok) {
      const video = await res.json()
      setVideos((prev) => [...prev, video])
      setNewUrl("")
    }
  }

  const deleteVideo = async (videoId: string) => {
    await fetch(`/api/plannings/${planningId}/videos/${videoId}`, { method: "DELETE" })
    setVideos((prev) => prev.filter((v) => v.id !== videoId))
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="URL (YouTube, TikTok, Instagram, Facebook, Vimeo)..."
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addVideo()}
          className="flex-1"
        />
        <Button size="sm" onClick={addVideo}><Plus className="h-4 w-4" /> Agregar</Button>
      </div>

      {videos.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">No hay videos de referencia.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {videos.map((video) => (
            <div key={video.id} className="rounded-lg border bg-card overflow-hidden">
              {video.embedUrl && (video.platform === "YOUTUBE" || video.platform === "VIMEO") ? (
                <div className="aspect-video">
                  <iframe
                    src={video.embedUrl}
                    className="h-full w-full"
                    allowFullScreen
                    title={video.title}
                  />
                </div>
              ) : video.embedUrl ? (
                <a
                  href={video.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex aspect-video items-center justify-center bg-muted hover:bg-muted/80 transition-colors"
                >
                  <div className="flex flex-col items-center gap-2 text-muted-foreground group-hover:text-foreground">
                    <ExternalLink className="h-8 w-8" />
                    <span className="text-xs font-medium">Abrir en {platformLabel(video.platform)}</span>
                  </div>
                </a>
              ) : (
                <div className="flex aspect-video items-center justify-center bg-muted">
                  <ExternalLink className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div className="flex items-center justify-between p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{video.title || "Video de referencia"}</p>
                  <p className="text-xs text-muted-foreground">{platformLabel(video.platform)}</p>
                  {video.notes && <p className="text-xs text-muted-foreground">{video.notes}</p>}
                </div>
                <button type="button" onClick={() => deleteVideo(video.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

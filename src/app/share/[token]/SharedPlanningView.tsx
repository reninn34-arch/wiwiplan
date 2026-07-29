"use client"

import { useState } from "react"
import { CheckCircle, Lightbulb, Layout, Clock, ImagePlus, ExternalLink, MessageSquare, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { platformLabel, postTypeLabel } from "@/lib/embeds"

const statusLabels: Record<string, string> = {
  DRAFT: "Borrador", IN_PROGRESS: "En Progreso", REVIEW: "Revisión",
  APPROVED: "Aprobado", PUBLISHED: "Publicado",
}

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  REVIEW: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  PUBLISHED: "bg-purple-100 text-purple-800",
}

const platformLabels: Record<string, string> = {
  YOUTUBE: "YouTube", INSTAGRAM: "Instagram", TIKTOK: "TikTok", LINKEDIN: "LinkedIn", OTHER: "Otro",
}

const ideaStatusLabels: Record<string, string> = {
  IDEA: "Idea", SELECTED: "Seleccionada", IN_PRODUCTION: "En Producción", DONE: "Lista",
}

interface Panel {
  id: string
  sceneNumber: number
  imageUrl: string
  description: string
  duration: string
  notes: string
  order: number
}

interface Storyboard {
  id: string
  title: string
  description: string
  panels: Panel[]
}

interface Comment {
  id: string
  authorName: string
  text: string
  createdAt: string
}

interface ContentIdea {
  id: string
  title: string
  description: string
  pilar: string
  postType: string
  platform: string
  referenceUrl: string
  referenceEmbed: string
  status: string
  priority: string
  order: number
  dueDate: string | null
  storyboardId: string | null
  storyboard: { id: string; title: string; panels: Panel[] } | null
  contentIdeaTags: Array<{ tag: { id: string; name: string; color: string } }>
  comments: Comment[]
}

interface Planning {
  id: string
  title: string
  description: string
  status: string
  targetAudience: string
  goals: string
  notes: string
  client: { id: string; name: string } | null
  contentIdeas: ContentIdea[]
  storyboards: Storyboard[]
}

interface Props {
  planning: Planning
}

function ClientCommentRow({ idea, onPreviewImage }: { idea: ContentIdea; onPreviewImage: (url: string) => void }) {
  const [open, setOpen] = useState(false)
  const [showStoryboard, setShowStoryboard] = useState(false)
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const [comments, setComments] = useState(idea.comments)

  const addComment = async () => {
    const msg = text.trim()
    if (!msg || sending) return
    setSending(true)
    setText("")
    const res = await fetch(`/api/ideas/${idea.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: msg, authorName: "Cliente" }),
    })
    if (res.ok) {
      const comment = await res.json()
      setComments((prev) => [...prev, comment])
    }
    setSending(false)
  }

  return (
    <>
      <tr className="border-b last:border-0">
        <td className="px-3 py-2">
          <p className="font-medium text-sm">{idea.title}</p>
        </td>
        <td className="px-3 py-2">
          {idea.description ? <p className="text-xs text-muted-foreground line-clamp-2">{idea.description}</p> : <span className="text-xs text-muted-foreground">—</span>}
        </td>
        <td className="px-3 py-2">
          {idea.referenceEmbed && (idea.platform === "YOUTUBE" || idea.platform === "VIMEO") ? (
            <div className="aspect-video w-32 rounded overflow-hidden">
              <iframe src={idea.referenceEmbed} className="h-full w-full" allowFullScreen title={idea.title} />
            </div>
          ) : idea.referenceEmbed && idea.platform === "IMAGE" ? (
            <img src={idea.referenceEmbed} alt={idea.title} className="h-10 w-10 shrink-0 rounded object-cover bg-muted cursor-pointer hover:opacity-80 transition-opacity" onClick={() => onPreviewImage(idea.referenceEmbed)} />
          ) : idea.referenceUrl ? (
            <a href={idea.referenceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary underline">
              <ExternalLink className="h-3 w-3" /> {platformLabel(idea.platform)}
            </a>
          ) : idea.storyboard ? (
            <div className="space-y-1">
              <button type="button" onClick={() => setShowStoryboard(!showStoryboard)} className="inline-flex items-center gap-1 text-xs rounded bg-muted px-2 py-0.5 hover:bg-muted/80">
                <Layout className="h-3 w-3" /> {idea.storyboard.title}
              </button>
              {showStoryboard && idea.storyboard.panels.length > 0 && (
                <div className="mt-1 space-y-1 border-l-2 pl-2">
                  {idea.storyboard.panels.map((p) => (
                    <div key={p.id} className="flex items-start gap-2">
                      {p.imageUrl && !p.imageUrl.startsWith("blob:") && (
                        <img src={p.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded object-cover bg-muted cursor-pointer hover:opacity-80" onClick={() => onPreviewImage(p.imageUrl)} />
                      )}
                      <div className="min-w-0 text-[10px] text-muted-foreground">
                        <p className="font-medium">#{p.sceneNumber}</p>
                        {p.description && <p className="line-clamp-2">{p.description}</p>}
                        {p.duration && <p className="text-[9px]">⏱ {p.duration}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </td>
        <td className="px-3 py-2 text-xs">{idea.pilar || <span className="text-muted-foreground">—</span>}</td>
        <td className="px-3 py-2">
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{ideaStatusLabels[idea.status]}</span>
        </td>
        <td className="px-3 py-2 text-xs text-muted-foreground">
          {idea.dueDate ? new Date(idea.dueDate).toLocaleDateString("es-AR") : "—"}
        </td>
        <td className="px-3 py-2 text-center">
          <button type="button" onClick={() => setOpen(!open)} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
            <MessageSquare className="h-3 w-3" />
            <span>{comments.length}</span>
          </button>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={7} className="bg-muted/20 px-6 py-3">
            <div className="space-y-2">
              {comments.length === 0 && <p className="text-xs text-muted-foreground">Sin comentarios.</p>}
              {comments.map((c) => (
                <div key={c.id} className="rounded-lg border bg-card px-3 py-2">
                  <p className="text-xs font-medium">{c.authorName}</p>
                  <p className="text-sm">{c.text}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(c.createdAt).toLocaleString("es-AR")}</p>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  className="min-w-0 flex-1 rounded-md border bg-background px-3 py-1.5 text-xs focus:outline-none disabled:opacity-50"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addComment() } }}
                  placeholder="Escribí un comentario..."
                  disabled={sending}
                />
                <button type="button" onClick={addComment} disabled={sending} className="rounded-md bg-primary px-2 py-1.5 text-xs text-primary-foreground disabled:opacity-50">
                  <Send className={`h-3 w-3 ${sending ? "animate-pulse" : ""}`} />
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export function SharedPlanningView({ planning }: Props) {
  const [status, setStatus] = useState(planning.status)
  const [isApproving, setIsApproving] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  const handleApprove = async () => {
    setIsApproving(true)
    try {
      const res = await fetch(`/api/share/${window.location.pathname.split("/").pop()}/approve`, {
        method: "POST",
      })
      if (res.ok) setStatus("APPROVED")
    } finally {
      setIsApproving(false)
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">{planning.title}</h1>
              {planning.client && (
                <p className="mt-1 text-muted-foreground">
                  Planificación para: <span className="font-medium">{planning.client.name}</span>
                </p>
              )}
            </div>
            <span className={`rounded-full px-3 py-1 text-sm font-medium ${statusColors[status]}`}>
              {statusLabels[status] ?? status}
            </span>
          </div>
        </header>

        {planning.description && (
          <section className="mb-8">
            <h2 className="mb-2 text-lg font-semibold">Descripción</h2>
            <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground" dangerouslySetInnerHTML={{ __html: planning.description }} />
          </section>
        )}

        <div className="mb-8 grid gap-6 sm:grid-cols-2">
          {planning.targetAudience && (
            <div className="rounded-lg border bg-card p-4">
              <h3 className="mb-1 text-sm font-semibold">Audiencia Objetivo</h3>
              <div className="prose prose-sm dark:prose-invert max-w-none text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: planning.targetAudience }} />
            </div>
          )}
          {planning.goals && (
            <div className="rounded-lg border bg-card p-4">
              <h3 className="mb-1 text-sm font-semibold">Objetivos</h3>
              <div className="prose prose-sm dark:prose-invert max-w-none text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: planning.goals }} />
            </div>
          )}
        </div>

        {planning.contentIdeas.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
              <Lightbulb className="h-5 w-5" /> Ideas de Contenido
            </h2>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="border-b">
                    <th className="px-3 py-2 text-left font-medium text-xs uppercase tracking-wide text-muted-foreground">Tema</th>
                    <th className="px-3 py-2 text-left font-medium text-xs uppercase tracking-wide text-muted-foreground">Objetivo</th>
                    <th className="px-3 py-2 text-left font-medium text-xs uppercase tracking-wide text-muted-foreground">Referencia</th>
                    <th className="px-3 py-2 text-left font-medium text-xs uppercase tracking-wide text-muted-foreground">Pilar</th>
                    <th className="px-3 py-2 text-left font-medium text-xs uppercase tracking-wide text-muted-foreground">Estado</th>
                    <th className="px-3 py-2 text-left font-medium text-xs uppercase tracking-wide text-muted-foreground">Entrega</th>
                    <th className="w-14 px-3 py-2 text-center font-medium text-xs uppercase tracking-wide text-muted-foreground"><MessageSquare className="h-3 w-3" /></th>
                  </tr>
                </thead>
                <tbody>
                  {planning.contentIdeas.map((idea) => (
                    <ClientCommentRow key={idea.id} idea={idea} onPreviewImage={setPreviewImage} />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {planning.notes && (
          <section className="mb-8">
            <h2 className="mb-2 text-lg font-semibold">Notas</h2>
            <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground" dangerouslySetInnerHTML={{ __html: planning.notes }} />
          </section>
        )}

        {planning.storyboards.map((sb) => (
          <section key={sb.id} className="mb-8">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
              <Layout className="h-5 w-5" /> {sb.title}
            </h2>
            {sb.panels.length === 0 ? (
              <p className="text-muted-foreground">Sin escenas.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sb.panels.map((panel, idx) => (
                  <div key={panel.id} className="rounded-lg border bg-card">
                    <div className="flex items-center gap-2 border-b bg-muted/50 px-3 py-2">
                      <span className="text-sm font-medium">Escena {idx + 1}</span>
                      {panel.duration && (
                        <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" /> {panel.duration}
                        </span>
                      )}
                    </div>
                    <div className="flex aspect-video items-center justify-center bg-muted/30">
                      {panel.imageUrl && !panel.imageUrl.startsWith("blob:") ? (
                        <img src={panel.imageUrl} alt={`Escena ${idx + 1}`} className="h-full w-full object-cover" />
                      ) : (
                        <ImagePlus className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    <div className="p-3">
                      <div className="prose prose-sm dark:prose-invert max-w-none text-sm" dangerouslySetInnerHTML={{ __html: panel.description || "Sin descripción" }} />
                      {panel.notes && <div className="prose prose-xs dark:prose-invert max-w-none mt-1 text-xs text-muted-foreground" dangerouslySetInnerHTML={{ __html: panel.notes }} />}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}

        {status !== "APPROVED" && (
          <div className="flex justify-center py-8">
            <Button size="lg" onClick={handleApprove} disabled={isApproving} className="gap-2">
              <CheckCircle className="h-5 w-5" />
              {isApproving ? "Aprobando..." : "Aprobar Planificación"}
            </Button>
          </div>
        )}

        {status === "APPROVED" && (
          <div className="py-8 text-center">
            <div className="inline-flex items-center gap-2 rounded-lg bg-green-50 px-6 py-3 text-green-700 dark:bg-green-900/20 dark:text-green-400">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">Planificación aprobada</span>
            </div>
          </div>
        )}

        {previewImage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setPreviewImage(null)}>
            <img src={previewImage} alt="Vista previa" className="max-h-[90vh] max-w-[90vw] rounded object-contain" />
          </div>
        )}
      </div>
    </main>
  )
}

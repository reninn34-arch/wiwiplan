"use client"

import { useState } from "react"
import { CheckCircle, Lightbulb, Layout, Clock, ImagePlus, ExternalLink, MessageSquare, Send, Hash } from "lucide-react"
import { Button } from "@/components/ui/button"
import { platformLabel, postTypeLabel } from "@/lib/embeds"
import {
  PaymentAccountHeader,
  PaymentLedger,
  type PaymentRecord,
} from "@/components/payments/PaymentStatus"
import { summarizePayments } from "@/lib/payments"
import { ClientLogo } from "@/components/ClientLogo"
import { panelImageUrl } from "@/lib/media"

const statusLabels: Record<string, string> = {
  DRAFT: "Borrador", IN_PROGRESS: "En Progreso", REVIEW: "Revisión",
  APPROVED: "Aprobado", PUBLISHED: "Publicado",
}

const statusColors: Record<string, string> = {
  DRAFT: "bg-white/5 text-zinc-400",
  IN_PROGRESS: "bg-blue-500/10 text-blue-400",
  REVIEW: "bg-yellow-500/10 text-yellow-400",
  APPROVED: "bg-green-500/10 text-green-400",
  PUBLISHED: "bg-purple-500/10 text-purple-400",
}

const ideaStatusLabels: Record<string, string> = {
  IDEA: "Idea", SELECTED: "Seleccionada", IN_PRODUCTION: "En Producción", DONE: "Lista",
}

interface Panel {
  id: string
  sceneNumber: number
  hasImage: boolean
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
  period: string
  targetAudience: string
  goals: string
  notes: string
  client: { id: string; name: string } | null
  priceCents: number
  contentIdeas: ContentIdea[]
  storyboards: Storyboard[]
  payments: PaymentRecord[]
}

interface Props {
  planning: Planning
}

function ClientCommentCard({ idea, onPreviewImage }: { idea: ContentIdea; onPreviewImage: (url: string) => void }) {
  const [open, setOpen] = useState(false)
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
    <div className="rounded-lg border border-white/5 bg-[#0c0c0e] overflow-hidden">
      <div className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-zinc-200">{idea.title}</p>
          <span className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-zinc-400">{ideaStatusLabels[idea.status]}</span>
        </div>

        {idea.description && <p className="text-xs text-zinc-400">{idea.description}</p>}

        <div className="flex flex-wrap gap-2 text-xs text-zinc-400">
          {idea.pilar && (
            <span className="inline-flex items-center gap-1 rounded bg-white/5 px-1.5 py-0.5">
              <Hash size={10} /> {idea.pilar}
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded bg-white/5 px-1.5 py-0.5">
            {postTypeLabel(idea.postType)}
          </span>
        </div>

        <div className="text-xs">
          {idea.referenceEmbed && (idea.platform === "YOUTUBE" || idea.platform === "VIMEO") ? (
            <div className="aspect-video rounded overflow-hidden">
              <iframe src={idea.referenceEmbed} className="h-full w-full" allowFullScreen title={idea.title} />
            </div>
          ) : idea.referenceEmbed && idea.platform === "IMAGE" ? (
            <img src={idea.referenceEmbed} alt={idea.title} className="h-16 w-16 rounded object-cover bg-white/[0.03] cursor-pointer hover:opacity-80" onClick={() => onPreviewImage(idea.referenceEmbed)} />
          ) : idea.referenceUrl ? (
            <a href={idea.referenceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-white underline">
              <ExternalLink className="h-3 w-3" /> {platformLabel(idea.platform)}
            </a>
          ) : idea.storyboard ? (
            <button type="button" onClick={() => document.getElementById(`sb-${idea.storyboard!.id}`)?.scrollIntoView({ behavior: "smooth" })} className="inline-flex items-center gap-1 rounded bg-white/5 px-2 py-0.5 text-zinc-400 hover:bg-white/10">
              <Layout className="h-3 w-3" /> {idea.storyboard.title}
            </button>
          ) : null}
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-white/5">
          <button type="button" onClick={() => setOpen(!open)} className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-white">
            <MessageSquare className="h-3 w-3" />
            {comments.length} {comments.length === 1 ? "comentario" : "comentarios"}
          </button>
        </div>

        {open && (
          <div className="space-y-2 pt-2 border-t border-white/5">
            {comments.length === 0 && <p className="text-xs text-zinc-400">Sin comentarios.</p>}
            {comments.map((c) => (
              <div key={c.id} className="rounded border border-white/5 px-3 py-2">
                <p className="text-xs font-medium text-zinc-300">{c.authorName}</p>
                <p className="text-sm text-zinc-200">{c.text}</p>
                <p className="text-[10px] text-zinc-400">{new Date(c.createdAt).toLocaleString("es-AR")}</p>
              </div>
            ))}
            <div className="flex gap-2">
              <input
                className="min-w-0 flex-1 rounded-md border border-white/10 bg-[#18181b] px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-600 disabled:opacity-50"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addComment() } }}
                placeholder="Escribí un comentario..."
                disabled={sending}
              />
              <button type="button" onClick={addComment} disabled={sending} className="rounded-md bg-white px-2 py-1.5 text-xs text-black disabled:opacity-50">
                <Send className={`h-3 w-3 ${sending ? "animate-pulse" : ""}`} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ClientCommentRow({ idea, onPreviewImage }: { idea: ContentIdea; onPreviewImage: (url: string) => void }) {
  const [open, setOpen] = useState(false)
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
          <p className="font-medium text-sm text-zinc-200">{idea.title}</p>
        </td>
        <td className="px-3 py-2">
          {idea.description ? <p className="text-xs text-zinc-400 line-clamp-2">{idea.description}</p> : <span className="text-xs text-zinc-400">—</span>}
        </td>
        <td className="px-3 py-2">
          {idea.referenceEmbed && (idea.platform === "YOUTUBE" || idea.platform === "VIMEO") ? (
            <div className="aspect-video w-32 rounded overflow-hidden">
              <iframe src={idea.referenceEmbed} className="h-full w-full" allowFullScreen title={idea.title} />
            </div>
          ) : idea.referenceEmbed && idea.platform === "IMAGE" ? (
            <img src={idea.referenceEmbed} alt={idea.title} className="h-10 w-10 shrink-0 rounded object-cover bg-white/[0.03] cursor-pointer hover:opacity-80 transition-opacity" onClick={() => onPreviewImage(idea.referenceEmbed)} />
          ) : idea.referenceUrl ? (
            <a href={idea.referenceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-white underline">
              <ExternalLink className="h-3 w-3" /> {platformLabel(idea.platform)}
            </a>
          ) : idea.storyboard ? (
            <button
              type="button"
              onClick={() => document.getElementById(`sb-${idea.storyboard!.id}`)?.scrollIntoView({ behavior: "smooth" })}
              className="inline-flex items-center gap-1 text-xs rounded bg-white/5 px-2 py-0.5 text-zinc-400 hover:bg-white/10"
            >
              <Layout className="h-3 w-3" /> {idea.storyboard.title}
            </button>
          ) : (
            <span className="text-xs text-zinc-400">—</span>
          )}
        </td>
        <td className="px-3 py-2 text-xs text-zinc-400">{idea.pilar || <span className="text-zinc-400">—</span>}</td>
        <td className="px-3 py-2">
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-zinc-400">{ideaStatusLabels[idea.status]}</span>
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
          <td colSpan={6} className="bg-white/[0.02] px-6 py-3">
            <div className="space-y-2">
              {comments.length === 0 && <p className="text-xs text-zinc-400">Sin comentarios.</p>}
              {comments.map((c) => (
                <div key={c.id} className="rounded-lg border border-white/5 bg-[#0c0c0e] px-3 py-2">
                  <p className="text-xs font-medium text-zinc-300">{c.authorName}</p>
                  <p className="text-sm text-zinc-200">{c.text}</p>
                  <p className="text-[10px] text-zinc-400">{new Date(c.createdAt).toLocaleString("es-AR")}</p>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  className="min-w-0 flex-1 rounded-md border border-white/10 bg-[#18181b] px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-600 disabled:opacity-50"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addComment() } }}
                  placeholder="Escribí un comentario..."
                  disabled={sending}
                />
                <button type="button" onClick={addComment} disabled={sending} className="rounded-md bg-white px-2 py-1.5 text-xs text-black disabled:opacity-50">
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

  const paymentSummary = summarizePayments(planning.priceCents, planning.payments)
  const showPayments = planning.priceCents > 0 || planning.payments.length > 0

  const formatPeriod = (p: string) => {
    if (!p) return ""
    const months: Record<string, string> = {
      "01": "Enero", "02": "Febrero", "03": "Marzo", "04": "Abril",
      "05": "Mayo", "06": "Junio", "07": "Julio", "08": "Agosto",
      "09": "Septiembre", "10": "Octubre", "11": "Noviembre", "12": "Diciembre",
    }
    const parts = p.split("-")
    if (parts.length === 2) return `${months[parts[1]] ?? parts[1]} ${parts[0]}`
    return p
  }

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
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-6 sm:py-8">
        <header className="mb-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-3xl font-bold text-zinc-200 truncate">{planning.title}</h1>
              {planning.client && (
                <p className="mt-1 text-sm sm:text-base text-zinc-400">
                  <ClientLogo
                    clientId={planning.client.id}
                    name={planning.client.name}
                    size={20}
                    className="mr-1.5 inline-block align-middle"
                  />
                  Planificación para: <span className="font-medium text-zinc-300">{planning.client.name}</span>
                  {planning.period && <span className="text-zinc-400"> — {formatPeriod(planning.period)}</span>}
                </p>
              )}
            </div>
            <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${statusColors[status]}`}>
              {statusLabels[status] ?? status}
            </span>
          </div>
        </header>

        {showPayments && (
          <section className="mb-8 rounded-xl border border-white/5 bg-[#0c0c0e] p-5">
            <PaymentAccountHeader
              summary={paymentSummary}
              payments={planning.payments}
              title="Tu plan de pago"
            />

            {planning.payments.length > 0 && (
              <div className="mt-5 border-t border-white/5 pt-4">
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
                  Pagos recibidos
                </h3>
                <PaymentLedger payments={planning.payments} />
              </div>
            )}
          </section>
        )}

        {planning.description && (
          <section className="mb-8">
            <h2 className="mb-2 text-lg font-semibold text-zinc-200">Descripción</h2>
            <div className="prose prose-sm dark:prose-invert max-w-none text-zinc-400" dangerouslySetInnerHTML={{ __html: planning.description }} />
          </section>
        )}

        <div className="mb-8 grid gap-6 sm:grid-cols-2">
          {planning.targetAudience && (
            <div className="rounded-lg border border-white/5 bg-[#0c0c0e] p-4">
              <h3 className="mb-1 text-sm font-semibold text-zinc-300">Audiencia Objetivo</h3>
              <div className="prose prose-sm dark:prose-invert max-w-none text-sm text-zinc-400" dangerouslySetInnerHTML={{ __html: planning.targetAudience }} />
            </div>
          )}
          {planning.goals && (
            <div className="rounded-lg border border-white/5 bg-[#0c0c0e] p-4">
              <h3 className="mb-1 text-sm font-semibold text-zinc-300">Objetivos</h3>
              <div className="prose prose-sm dark:prose-invert max-w-none text-sm text-zinc-400" dangerouslySetInnerHTML={{ __html: planning.goals }} />
            </div>
          )}
        </div>

        {planning.contentIdeas.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-zinc-200">
              <Lightbulb className="h-5 w-5" /> Ideas de Contenido
            </h2>

            {/* Mobile cards */}
            <div className="space-y-3 sm:hidden">
              {planning.contentIdeas.map((idea) => (
                <ClientCommentCard key={idea.id} idea={idea} onPreviewImage={setPreviewImage} />
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto rounded-lg border border-white/5">
              <table className="w-full text-sm">
                <thead className="bg-white/[0.03]">
                  <tr className="border-b border-white/5">
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-400">Tema</th>
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-400">Objetivo</th>
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-400">Referencia</th>
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-400">Pilar</th>
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-400">Estado</th>
                    <th className="w-14 px-3 py-2 text-center text-xs font-medium uppercase tracking-wide text-zinc-400"><MessageSquare className="h-3 w-3" /></th>
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
            <h2 className="mb-2 text-lg font-semibold text-zinc-200">Notas</h2>
            <div className="prose prose-sm dark:prose-invert max-w-none text-zinc-400" dangerouslySetInnerHTML={{ __html: planning.notes }} />
          </section>
        )}

        {planning.storyboards.map((sb) => (
          <section key={sb.id} id={`sb-${sb.id}`} className="mb-8 scroll-mt-8">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-zinc-200">
              <Layout className="h-5 w-5" /> {sb.title}
            </h2>
            {sb.panels.length === 0 ? (
              <p className="text-zinc-400">Sin escenas.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sb.panels.map((panel, idx) => (
                  <div key={panel.id} className="rounded-lg border border-white/5 bg-[#0c0c0e]">
                    <div className="flex items-center gap-2 border-b border-white/5 bg-white/[0.03] px-3 py-2">
                      <span className="text-sm font-medium text-zinc-300">Escena {idx + 1}</span>
                      {panel.duration && (
                        <span className="ml-auto flex items-center gap-1 text-xs text-zinc-400">
                          <Clock className="h-3 w-3" /> {panel.duration}
                        </span>
                      )}
                    </div>
                    <div className="flex aspect-video items-center justify-center bg-white/[0.02]">
                      {panel.hasImage ? (
                        <img
                          src={panelImageUrl(panel.id)}
                          alt={`Escena ${idx + 1}`}
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full cursor-zoom-in object-cover"
                          onClick={() => setPreviewImage(panelImageUrl(panel.id))}
                        />
                      ) : (
                        <ImagePlus className="h-8 w-8 text-zinc-500" aria-hidden />
                      )}
                    </div>
                    <div className="p-3">
                      <div className="prose prose-sm dark:prose-invert max-w-none text-sm text-zinc-300" dangerouslySetInnerHTML={{ __html: panel.description || "Sin descripción" }} />
                      {panel.notes && <div className="prose prose-xs dark:prose-invert max-w-none mt-1 text-xs text-zinc-400" dangerouslySetInnerHTML={{ __html: panel.notes }} />}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}

        {status !== "APPROVED" && (
          <div className="flex justify-center py-8">
            <Button size="lg" onClick={handleApprove} disabled={isApproving} className="gap-2 bg-white text-black hover:bg-zinc-200">
              <CheckCircle className="h-5 w-5" />
              {isApproving ? "Aprobando..." : "Aprobar Planificación"}
            </Button>
          </div>
        )}

        {status === "APPROVED" && (
          <div className="py-8 text-center">
            <div className="inline-flex items-center gap-2 rounded-lg bg-green-500/10 px-6 py-3 font-medium text-green-400">
              <CheckCircle className="h-5 w-5" />
              <span>Planificación aprobada</span>
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

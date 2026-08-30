"use client"

import { useState } from "react"
import { CheckCircle, Lightbulb, Layout, Clock, ImagePlus, ExternalLink, MessageSquare, Send, Hash } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FeedPreview } from "./FeedPreview"
import { IdeaCard } from "./IdeaCard"
import { platformLabel, postTypeLabel } from "@/lib/embeds"
import {
  PaymentAccountHeader,
  PaymentLedger,
  type PaymentRecord,
} from "@/components/payments/PaymentStatus"
import { summarizePayments } from "@/lib/payments"
import { ClientLogo } from "@/components/ClientLogo"
import { panelImageUrl, ideaImageUrl } from "@/lib/media"

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
  images: Array<{ id: string }>
  /** El texto que va en la publicación. */
  caption: string
  /** El archivo que de verdad se publica, distinto de `images`. */
  media: Array<{ id: string; url: string; kind: string; order: number }>
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
  client: {
    id: string
    name: string
    logo: string | null
    accounts: Array<{ network: string; handle: string }>
  } | null
  priceCents: number
  contentIdeas: ContentIdea[]
  storyboards: Storyboard[]
  payments: PaymentRecord[]
}

/** El perfil real de Instagram, cuando la cuenta está conectada. */
interface Profile {
  username: string
  name: string
  pictureUrl: string | null
  followers: number | null
  mediaCount: number | null
}

interface Props {
  planning: Planning
  profile: Profile | null
}

export function SharedPlanningView({ planning, profile }: Props) {
  /** El feed primero: es lo que el cliente quiere ver, y el detalle es donde
   *  después trabaja. */
  const [vista, setVista] = useState<"feed" | "detalle">("feed")
  const [status, setStatus] = useState(planning.status)
  const [isApproving, setIsApproving] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  // Publicado ya pasó por aprobado: el botón no reaparece ni permite volver atrás.
  const isApproved = status === "APPROVED" || status === "PUBLISHED"

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
      if (res.ok) {
        // El servidor manda el estado final: si el plan ya estaba publicado,
        // se queda publicado en vez de retroceder a aprobado.
        const data = await res.json().catch(() => null)
        setStatus(data?.status ?? "APPROVED")
      }
    } finally {
      setIsApproving(false)
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-6 sm:py-8">
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
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-200">
                <Lightbulb className="h-5 w-5" /> Ideas de Contenido
              </h2>
              {/* Dos lentes sobre el mismo mes: el feed se ve entero y responde
                  "cómo va a quedar"; el detalle se lee pieza por pieza y es
                  donde se comenta. */}
              <div className="flex rounded-lg bg-white/[0.06] p-0.5 text-xs">
                {(
                  [
                    ["feed", "Feed"],
                    ["detalle", "Detalle"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setVista(id)}
                    className={`min-h-9 rounded-md px-3 transition-colors ${
                      vista === id ? "bg-white/10 text-white" : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {vista === "feed" && (
              <FeedPreview
                ideas={planning.contentIdeas}
                clientName={profile?.name || planning.client?.name || "Cliente"}
                // La foto real manda sobre el logo guardado: es la que la gente
                // asocia con la cuenta, y ya viene recortada en círculo.
                avatarUrl={profile?.pictureUrl ?? null}
                clientLogo={planning.client?.logo ?? null}
                handle={
                  profile?.username ||
                  planning.client?.accounts.find((a) => a.network === "INSTAGRAM")?.handle ||
                  ""
                }
                followers={profile?.followers ?? null}
                period={planning.period}
                referenceUrl={ideaImageUrl}
              />
            )}

            {vista === "detalle" && (
              // Ordenadas por fecha y no por el orden interno de la app: el
              // cliente lee su mes en calendario, no en la secuencia en que se
              // crearon las piezas.
              <div>
                <p className="mb-3 text-xs text-zinc-500">
                  Cada tarjeta es una publicación: qué día sale, qué se va a ver y qué va a decir.
                  Si quieres cambiar algo, déjalo en el comentario de esa pieza.
                </p>
                {/* `items-start` para que cada tarjeta mida lo suyo. Sin esto la
                    rejilla iguala las alturas de cada fila y una tarjeta corta
                    se estira con un vacío debajo. */}
                <div className="grid items-start gap-3 lg:grid-cols-2">
                {[...planning.contentIdeas]
                  .sort((a, b) =>
                    (a.dueDate ?? "￿").localeCompare(b.dueDate ?? "￿"),
                  )
                  .map((idea) => (
                    <IdeaCard key={idea.id} idea={idea} onPreviewImage={setPreviewImage} />
                  ))}
                </div>
              </div>
            )}
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

        {!isApproved && (
          <div className="flex justify-center py-8">
            <Button size="lg" onClick={handleApprove} disabled={isApproving} className="w-full gap-2 bg-brand text-white hover:bg-[#d0424a] sm:w-auto">
              <CheckCircle className="h-5 w-5" />
              {isApproving ? "Aprobando..." : "Aprobar Planificación"}
            </Button>
          </div>
        )}

        {isApproved && (
          <div className="py-8 text-center">
            <div className="inline-flex items-center gap-2 rounded-lg bg-green-500/10 px-6 py-3 font-medium text-green-400">
              <CheckCircle className="h-5 w-5" />
              <span>{status === "PUBLISHED" ? "Planificación aprobada y publicada" : "Planificación aprobada"}</span>
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

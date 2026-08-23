"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Share2, MoreHorizontal, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InfoTab } from "./InfoTab"
import { ContentIdeasTab } from "./ContentIdeasTab"
import dynamic from "next/dynamic"
import { ShareModal } from "./ShareModal"
import { PaymentsTab } from "./PaymentsTab"
import { PaymentStamp, type PaymentRecord } from "@/components/payments/PaymentStatus"
import { ClientLogo } from "@/components/ClientLogo"
import { formatMoney, summarizePayments } from "@/lib/payments"
import { NotificationBell } from "@/components/NotificationBell"

const loadStoryboardsTab = () => import("./StoryboardsTab")
const StoryboardsTab = dynamic(() => loadStoryboardsTab().then((m) => ({ default: m.StoryboardsTab })), { ssr: false })

const months: Record<string, string> = {
  "01": "Enero", "02": "Febrero", "03": "Marzo", "04": "Abril",
  "05": "Mayo", "06": "Junio", "07": "Julio", "08": "Agosto",
  "09": "Septiembre", "10": "Octubre", "11": "Noviembre", "12": "Diciembre",
}

function formatPeriod(p: string) {
  if (!p) return ""
  const parts = p.split("-")
  if (parts.length === 2) return `${months[parts[1]] ?? parts[1]} ${parts[0]}`
  return p
}

const statusLabels: Record<string, string> = {
  DRAFT: "Borrador",
  IN_PROGRESS: "En Progreso",
  REVIEW: "Revisión",
  APPROVED: "Aprobado",
  PUBLISHED: "Publicado",
}

const tabs = [
  { id: "contenido", label: "Contenido" },
  { id: "info", label: "Información" },
  { id: "storyboard", label: "Storyboards" },
  { id: "pagos", label: "Pagos" },
] as const

type TabId = (typeof tabs)[number]["id"]

interface PlanningData {
  id: string
  title: string
  description: string
  period: string
  status: string
  targetAudience: string
  goals: string
  notes: string
  clientId: string | null
  priceCents: number
  createdAt: string
  updatedAt: string
  client: { id: string; name: string; email: string } | null
  contentIdeas: Array<{
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
    storyboard: { id: string; title: string } | null
    contentIdeaTags: Array<{ tag: { id: string; name: string; color: string } }>
    comments: Array<{ id: string; authorName: string; text: string; createdAt: string }>
  }>
  storyboards: Array<{
    id: string
    title: string
  }>
  shareLinks: Array<{
    id: string
    token: string
    expiresAt: string | null
    createdAt: string
  }>
  payments: PaymentRecord[]
}

interface Props {
  planning: PlanningData
  clients: Array<{ id: string; name: string }>
}

export function PlanningDetailClient({ planning: initial, clients }: Props) {
  const router = useRouter()
  const [planning, setPlanning] = useState(initial)
  const [editingPeriod, setEditingPeriod] = useState(false)
  const [periodMonth, setPeriodMonth] = useState("")
  const [periodYear, setPeriodYear] = useState("")
  const [activeTab, setActiveTab] = useState<TabId>("contenido")
  const [showShare, setShowShare] = useState(false)

  const updatePlanning = useCallback((updates: Partial<PlanningData>) => {
    setPlanning((prev) => ({ ...prev, ...updates }))
  }, [])

  const handleDelete = async () => {
    if (!confirm("¿Eliminar esta planificación?")) return
    await fetch(`/api/plannings/${planning.id}`, { method: "DELETE" })
    router.push("/dashboard")
  }

  const savePeriod = async () => {
    setEditingPeriod(false)
    if (!periodMonth || !periodYear) return
    const newPeriod = `${periodYear}-${periodMonth}`
    if (newPeriod === planning.period) return
    await fetch(`/api/plannings/${planning.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period: newPeriod }),
    })
    setPlanning((prev) => ({ ...prev, period: newPeriod }))
  }

  const paymentSummary = summarizePayments(planning.priceCents, planning.payments)
  const showPaymentBadge = planning.priceCents > 0 || planning.payments.length > 0

  const startEditPeriod = () => {
    const parts = planning.period ? planning.period.split("-") : []
    setPeriodMonth(parts[1] ?? "")
    setPeriodYear(parts[0] ?? "")
    setEditingPeriod(true)
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-300">
      {/* Sticky Header */}
      <header className="px-4 sm:px-6 py-3 border-b border-white/5 flex items-center justify-between bg-[#09090b] sticky top-0 z-20 gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="w-8 h-8 shrink-0 flex items-center justify-center hover:bg-white/5 rounded-lg transition-colors text-zinc-400 hover:text-white"
          >
            <ArrowLeft size={16} />
          </button>

          <div className="flex items-center text-sm font-medium min-w-0">
            <span className="hidden sm:inline text-zinc-400 hover:text-zinc-300 cursor-pointer transition-colors truncate" onClick={() => router.push("/dashboard")}>Workspace</span>
            <ChevronRight size={14} className="hidden sm:block text-zinc-700 mx-1 shrink-0" />
            <span className="text-zinc-400 hover:text-zinc-300 cursor-pointer transition-colors truncate max-w-[120px] sm:max-w-[200px] flex items-center gap-1.5" onClick={() => router.push("/dashboard")}>
              {planning.client ? (
                <ClientLogo clientId={planning.client.id} name={planning.client.name} size={20} />
              ) : null}
              {planning.client?.name ?? "Sin cliente"}
            </span>
            <ChevronRight size={14} className="text-zinc-700 mx-1 shrink-0" />
            <span className="text-zinc-100 flex items-center gap-2 min-w-0">
              {editingPeriod ? (
                <div className="flex items-center gap-1" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) savePeriod() }}>
                  <select className="h-6 rounded border border-white/10 bg-zinc-800 px-1 text-[11px] text-zinc-200 focus:outline-none" value={periodMonth} onChange={(e) => setPeriodMonth(e.target.value)} autoFocus>
                    <option value="">Mes</option>
                    {Object.entries(months).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <select className="h-6 rounded border border-white/10 bg-zinc-800 px-1 text-[11px] text-zinc-200 focus:outline-none" value={periodYear} onChange={(e) => setPeriodYear(e.target.value)}>
                    <option value="">Año</option>
                    {Array.from({ length: 10 }, (_, i) => { const y = new Date().getFullYear() - 1 + i; return <option key={y} value={y}>{y}</option> })}
                  </select>
                  <button type="button" onClick={savePeriod} className="h-6 rounded bg-white px-1.5 text-[10px] font-semibold text-black hover:bg-zinc-200">OK</button>
                </div>
              ) : (
                <>
                  {planning.period ? formatPeriod(planning.period) : "Sin período"}
                  <button type="button" onClick={startEditPeriod} className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-white/10 text-zinc-300 hover:bg-white/20 transition-colors">
                    {statusLabels[planning.status] ?? planning.status}
                  </button>
                </>
              )}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <NotificationBell />
          <div className="w-px h-4 bg-white/10 mx-1" />
          <Button variant="ghost" size="sm" onClick={() => setShowShare(true)} className="text-zinc-300 hover:text-white hover:bg-white/5 gap-2 px-3">
            <Share2 size={14} /> Compartir
          </Button>
          <button type="button" onClick={handleDelete} className="w-8 h-8 flex items-center justify-center hover:bg-white/5 rounded-lg transition-colors text-zinc-400">
            <MoreHorizontal size={16} />
          </button>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Title Area */}
        <div className="mb-8 flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-white tracking-tight mb-2">
              {planning.title || "Plan de Contenido"}
            </h1>
            <p className="text-sm text-zinc-400">
              Gestiona y organiza las ideas y publicaciones para {planning.period ? formatPeriod(planning.period) : "este período"}.
            </p>
          </div>

          {showPaymentBadge && (
            <button
              type="button"
              onClick={() => setActiveTab("pagos")}
              className="flex items-center gap-3 rounded-lg border border-white/5 bg-[#0c0c0e] px-3.5 py-2.5 transition-colors hover:border-white/10 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500"
            >
              <PaymentStamp state={paymentSummary.state} />
              <span className="text-xs text-zinc-400">
                {paymentSummary.dueCents > 0 ? (
                  <>
                    Saldo{" "}
                    <span className="font-medium tabular-nums text-zinc-100">
                      {formatMoney(paymentSummary.dueCents)}
                    </span>
                  </>
                ) : (
                  <>
                    Cobrado{" "}
                    <span className="font-medium tabular-nums text-zinc-100">
                      {formatMoney(paymentSummary.paidCents)}
                    </span>
                  </>
                )}
              </span>
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-white/5 mb-6 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              onMouseEnter={tab.id === "storyboard" ? loadStoryboardsTab : undefined}
              onFocus={tab.id === "storyboard" ? loadStoryboardsTab : undefined}
              className={`px-3 sm:px-4 py-2.5 text-sm font-medium capitalize whitespace-nowrap transition-all relative ${
                activeTab === tab.id
                  ? "text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-300 hover:bg-white/[0.02] rounded-t-lg"
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-white rounded-t-full" />
              )}
            </button>
          ))}
        </div>

        {activeTab === "info" && (
          <InfoTab planning={planning} clients={clients} onUpdate={updatePlanning} />
        )}
        {activeTab === "contenido" && (
          <ContentIdeasTab planningId={planning.id} ideas={planning.contentIdeas} storyboards={planning.storyboards.map((s) => ({ id: s.id, title: s.title }))} />
        )}
        {activeTab === "storyboard" && (
          <StoryboardsTab planningId={planning.id} />
        )}
        {activeTab === "pagos" && (
          <PaymentsTab
            planningId={planning.id}
            priceCents={planning.priceCents}
            payments={planning.payments}
            onChange={updatePlanning}
          />
        )}
      </main>

      {showShare && (
        <ShareModal
          planningId={planning.id}
          shareLinks={planning.shareLinks}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  )
}

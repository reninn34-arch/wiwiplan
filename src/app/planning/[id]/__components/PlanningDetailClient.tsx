"use client"

import { useState, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Share2, MoreHorizontal, ChevronRight, ChevronDown, Trash2, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { InfoTab } from "./InfoTab"
import { ContentIdeasTab } from "./ContentIdeasTab"
import dynamic from "next/dynamic"
import { ShareModal } from "./ShareModal"
import { PaymentsTab } from "./PaymentsTab"
import { PaymentStamp, type PaymentRecord } from "@/components/payments/PaymentStatus"
import { ClientLogo } from "@/components/ClientLogo"
import { formatMoney, summarizePayments } from "@/lib/payments"
import { NotificationBell } from "@/components/NotificationBell"
import { toast } from "sonner"

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

const statusOpts = ["DRAFT", "IN_PROGRESS", "REVIEW", "APPROVED", "PUBLISHED"]

const statusLabels: Record<string, string> = {
  DRAFT: "Borrador",
  IN_PROGRESS: "En Progreso",
  REVIEW: "Revisión",
  APPROVED: "Aprobado",
  PUBLISHED: "Publicado",
}

const statusChipStyles: Record<string, string> = {
  DRAFT: "bg-white/5 text-zinc-300 ring-white/10",
  IN_PROGRESS: "bg-blue-500/10 text-blue-300 ring-blue-400/25",
  REVIEW: "bg-amber-500/10 text-amber-300 ring-amber-400/25",
  APPROVED: "bg-emerald-500/10 text-emerald-300 ring-emerald-400/25",
  PUBLISHED: "bg-purple-500/10 text-purple-300 ring-purple-400/25",
}

const statusDotStyles: Record<string, string> = {
  DRAFT: "bg-zinc-400",
  IN_PROGRESS: "bg-blue-400",
  REVIEW: "bg-amber-400",
  APPROVED: "bg-emerald-400",
  PUBLISHED: "bg-purple-400",
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
    images: Array<{ id: string; order: number }>
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
  installments: Array<{ id: string; label: string; amountCents: number; dueDate: string }>
  user: { name: string | null; email: string }
}

interface Props {
  planning: PlanningData
  clients: Array<{ id: string; name: string }>
}

export function PlanningDetailClient({ planning: initial, clients }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const focusIdeaId = searchParams.get("idea")
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
    if (!confirm("¿Eliminar esta planificación? Se borran sus ideas, storyboards y pagos.")) return
    const res = await fetch(`/api/plannings/${planning.id}`, { method: "DELETE" })
    if (!res.ok) {
      toast.error("No se pudo eliminar la planificación")
      return
    }
    router.push("/dashboard")
  }

  const changeStatus = async (status: string) => {
    if (status === planning.status) return
    const prev = planning.status
    setPlanning((p) => ({ ...p, status }))
    const res = await fetch(`/api/plannings/${planning.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) {
      setPlanning((p) => ({ ...p, status: prev }))
      toast.error("No se pudo cambiar el estado")
      return
    }
    toast.success(`Estado: ${statusLabels[status] ?? status}`)
  }

  const savePeriod = async () => {
    setEditingPeriod(false)
    if (!periodMonth || !periodYear) return
    const newPeriod = `${periodYear}-${periodMonth}`
    if (newPeriod === planning.period) return
    const prev = planning.period
    setPlanning((p) => ({ ...p, period: newPeriod }))
    const res = await fetch(`/api/plannings/${planning.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period: newPeriod }),
    })
    if (!res.ok) {
      setPlanning((p) => ({ ...p, period: prev }))
      toast.error("No se pudo cambiar el período")
    }
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
      <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-white/5 bg-[#09090b]/95 px-3 pt-[env(safe-area-inset-top)] backdrop-blur sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-1 py-2 sm:gap-2">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            aria-label="Volver al workspace"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="flex min-w-0 items-center text-sm font-medium">
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="hidden truncate text-zinc-400 transition-colors hover:text-zinc-200 sm:inline"
            >
              Workspace
            </button>
            <ChevronRight size={14} className="mx-1 hidden shrink-0 text-zinc-700 sm:block" />
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="flex min-w-0 items-center gap-1.5 truncate text-zinc-300 transition-colors hover:text-white"
            >
              {planning.client ? (
                <ClientLogo clientId={planning.client.id} name={planning.client.name} size={20} />
              ) : null}
              <span className="truncate">{planning.client?.name ?? "Sin cliente"}</span>
            </button>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 py-2 sm:gap-2">
          <NotificationBell />
          <div className="mx-1 hidden h-4 w-px bg-white/10 sm:block" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowShare(true)}
            className="hidden h-10 gap-2 px-3 text-zinc-300 hover:bg-white/5 hover:text-white sm:inline-flex"
          >
            <Share2 size={14} /> Compartir
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Más acciones"
                className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-white/5 hover:text-white data-[state=open]:bg-white/10 data-[state=open]:text-white"
              >
                <MoreHorizontal size={18} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem className="sm:hidden" onSelect={() => setShowShare(true)}>
                <Share2 size={15} /> Compartir
              </DropdownMenuItem>
              <DropdownMenuItem className="sm:hidden" onSelect={startEditPeriod}>
                <Calendar size={15} /> Cambiar período
              </DropdownMenuItem>
              <DropdownMenuSeparator className="sm:hidden" />
              <DropdownMenuItem destructive onSelect={handleDelete}>
                <Trash2 size={15} /> Eliminar planificación
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-3 py-5 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-8">
        {/* Title Area */}
        <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="mb-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {planning.title || "Plan de Contenido"}
            </h1>

            {/* Período y estado son dos controles distintos, cada uno con su propia acción */}
            <div className="flex flex-wrap items-center gap-2">
              {editingPeriod ? (
                <div
                  className="flex items-center gap-1.5"
                  onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) savePeriod() }}
                >
                  <select
                    className="h-9 rounded-lg border border-white/10 bg-[#18181b] px-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                    value={periodMonth}
                    onChange={(e) => setPeriodMonth(e.target.value)}
                    aria-label="Mes"
                    autoFocus
                  >
                    <option value="">Mes</option>
                    {Object.entries(months).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <select
                    className="h-9 rounded-lg border border-white/10 bg-[#18181b] px-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                    value={periodYear}
                    onChange={(e) => setPeriodYear(e.target.value)}
                    aria-label="Año"
                  >
                    <option value="">Año</option>
                    {Array.from({ length: 10 }, (_, i) => { const y = new Date().getFullYear() - 1 + i; return <option key={y} value={y}>{y}</option> })}
                  </select>
                  <button type="button" onClick={savePeriod} className="h-9 rounded-lg bg-brand px-3 text-xs font-semibold text-white hover:bg-[#d0424a]">OK</button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={startEditPeriod}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white/5 px-3 text-sm font-medium text-zinc-300 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <Calendar size={14} className="text-zinc-500" />
                  {planning.period ? formatPeriod(planning.period) : "Sin período"}
                </button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium ring-1 ring-inset transition-colors hover:brightness-125 ${statusChipStyles[planning.status] ?? statusChipStyles.DRAFT}`}
                  >
                    <span className={`h-2 w-2 rounded-full ${statusDotStyles[planning.status] ?? statusDotStyles.DRAFT}`} aria-hidden />
                    {statusLabels[planning.status] ?? planning.status}
                    <ChevronDown size={14} className="opacity-70" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>Estado del plan</DropdownMenuLabel>
                  {statusOpts.map((s) => (
                    <DropdownMenuCheckItem key={s} selected={planning.status === s} onSelect={() => changeStatus(s)}>
                      <span className={`h-2 w-2 rounded-full ${statusDotStyles[s]}`} aria-hidden />
                      {statusLabels[s]}
                    </DropdownMenuCheckItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <p className="mt-3 text-sm text-zinc-400">
              Gestiona y organiza las ideas y publicaciones para {planning.period ? formatPeriod(planning.period) : "este período"}.
            </p>
          </div>

          {showPaymentBadge && (
            <button
              type="button"
              onClick={() => setActiveTab("pagos")}
              className="flex w-full shrink-0 items-center gap-3 rounded-lg border border-white/5 bg-[#0c0c0e] px-3.5 py-3 transition-colors hover:border-white/10 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500 sm:w-auto sm:py-2.5"
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
        <div className="-mx-3 mb-5 flex items-center gap-1 overflow-x-auto border-b border-white/5 px-3 [scrollbar-width:none] sm:mx-0 sm:mb-6 sm:px-0 [&::-webkit-scrollbar]:hidden">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              onMouseEnter={tab.id === "storyboard" ? loadStoryboardsTab : undefined}
              onFocus={tab.id === "storyboard" ? loadStoryboardsTab : undefined}
              aria-current={activeTab === tab.id ? "page" : undefined}
              className={`relative min-h-11 whitespace-nowrap px-3 py-3 text-sm font-medium capitalize transition-all sm:px-4 sm:py-2.5 ${
                activeTab === tab.id
                  ? "text-zinc-100"
                  : "rounded-t-lg text-zinc-400 hover:bg-white/[0.02] hover:text-zinc-300"
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-[-1px] left-0 h-[2px] w-full rounded-t-full bg-white" />
              )}
            </button>
          ))}
        </div>

        {activeTab === "info" && (
          <InfoTab planning={planning} clients={clients} onUpdate={updatePlanning} />
        )}
        {activeTab === "contenido" && (
          <ContentIdeasTab planningId={planning.id} ideas={planning.contentIdeas} storyboards={planning.storyboards.map((s) => ({ id: s.id, title: s.title }))} focusIdeaId={focusIdeaId} />
        )}
        {activeTab === "storyboard" && (
          <StoryboardsTab planningId={planning.id} />
        )}
        {activeTab === "pagos" && (
          <PaymentsTab
            planningId={planning.id}
            priceCents={planning.priceCents}
            payments={planning.payments}
            installments={planning.installments}
            onChange={updatePlanning}
            client={planning.client}
            periodLabel={formatPeriod(planning.period)}
            planTitle={planning.title}
            businessName={planning.user.name ?? planning.user.email.split("@")[0]}
            businessEmail={planning.user.email}
          />
        )}
      </main>

      {showShare && (
        <ShareModal
          planningId={planning.id}
          shareLinks={planning.shareLinks}
          onCreated={(link) => updatePlanning({ shareLinks: [link] })}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  )
}

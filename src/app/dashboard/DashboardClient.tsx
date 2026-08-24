"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Plus, LogOut, Lightbulb, Layout, MessageSquare, Calendar, ArrowUp, ChevronRight, ChevronDown, Building2, Camera, Settings, Wallet } from "lucide-react"
import { signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { ClientLogo } from "@/components/ClientLogo"
import { paymentDotStyles } from "@/components/payments/PaymentStatus"
import { formatMoney, parseAmountToCents, summarizePayments } from "@/lib/payments"
import { formatPeriodLabel } from "@/lib/planning-period"
import { formatDayLabel } from "@/lib/calendar"
import { compressAvatar } from "@/lib/compress-image"
import { Input } from "@/components/ui/input"
import { NotificationBell } from "@/components/NotificationBell"
import { GlobalSearch } from "@/components/GlobalSearch"
import { toast } from "sonner"

const months: Record<string, string> = {
  "01": "Enero", "02": "Febrero", "03": "Marzo", "04": "Abril",
  "05": "Mayo", "06": "Junio", "07": "Julio", "08": "Agosto",
  "09": "Septiembre", "10": "Octubre", "11": "Noviembre", "12": "Diciembre",
}
const shortMonths: Record<string, string> = {
  "01": "ene", "02": "feb", "03": "mar", "04": "abr",
  "05": "may", "06": "jun", "07": "jul", "08": "ago",
  "09": "sep", "10": "oct", "11": "nov", "12": "dic",
}

/** Etiqueta compacta para chips de deuda: "sep 26" en vez de "Septiembre 2026". */
function formatPeriodShort(p: string) {
  const parts = p.split("-")
  if (parts.length === 2) return `${shortMonths[parts[1]] ?? parts[1]} ${parts[0].slice(2)}`
  return p
}

function formatPeriod(p: string) {
  return p ? formatPeriodLabel(p) : ""
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
const priorityLabels: Record<string, string> = {
  HIGH: "Alta", MEDIUM: "Media", LOW: "Baja",
}
const planStatusLabels: Record<string, string> = {
  DRAFT: "Borrador", IN_PROGRESS: "En Progreso", REVIEW: "Revisión", APPROVED: "Aprobado", PUBLISHED: "Publicado",
}
const ACTIVE_STATES = ["IN_PROGRESS", "REVIEW", "APPROVED"]

/**
 * Card de mes, compartida entre "En curso" y el archivo de clientes.
 * Muestra el cliente porque en la vista plana los meses conviven de varios dueños.
 */
function MonthCard({ p }: { p: Planning }) {
  const router = useRouter()
  const cobro = summarizePayments(p.priceCents, p.payments)
  return (
    <button
      type="button"
      onClick={() => router.push(`/planning/${p.id}`)}
      className="group rounded-lg border border-white/5 bg-[#0c0c0e] p-4 text-left transition-all hover:bg-white/[0.02]"
    >
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-200 group-hover:text-white">
          {p.period ? formatPeriod(p.period) : p.title}
        </h3>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${statusColors[p.status]}`}>
          {planStatusLabels[p.status] ?? p.status}
        </span>
      </div>
      {p.title && p.period && <p className="mb-2 truncate text-xs text-zinc-400">{p.title}</p>}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-zinc-400">
        {p.client && (
          <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> {p.client.name}</span>
        )}
        <span className="flex items-center gap-1"><Lightbulb className="h-3 w-3" /> {p._count.contentIdeas} ideas</span>
        <span className="flex items-center gap-1"><Layout className="h-3 w-3" /> {p._count.storyboards} sb</span>
        {cobro.state !== "UNPRICED" && (
          <span className="flex items-center gap-1 tabular-nums">
            <span className={`h-1.5 w-1.5 rounded-full ${paymentDotStyles[cobro.state]}`} aria-hidden />
            {cobro.dueCents > 0 ? `debe ${formatMoney(cobro.dueCents)}` : "pagado"}
          </span>
        )}
      </div>
    </button>
  )
}

interface Client {
  id: string
  name: string
  email?: string
}

interface Planning {
  id: string
  title: string
  period: string
  status: string
  updatedAt: string
  createdAt: string
  client: { id: string; name: string } | null
  _count: { contentIdeas: number; storyboards: number }
  priceCents: number
  payments: Array<{ amountCents: number }>
}

interface PendingIdea {
  id: string
  title: string
  description: string
  status: string
  priority: string
  dueDate: string | null
  planning: { id: string; title: string; period: string; status: string; client: { name: string } | null }
  _count: { comments: number }
}

interface Props {
  plannings: Planning[]
  clients: Client[]
  pendingIdeas: PendingIdea[]
  user: { id: string; name: string | null; email: string }
}

export function DashboardClient({ plannings: initial, clients: initialClients, pendingIdeas, user }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [showClientForm, setShowClientForm] = useState(false)
  const [newClientName, setNewClientName] = useState("")
  const [newClientEmail, setNewClientEmail] = useState("")
  const [newClientLogo, setNewClientLogo] = useState<string | null>(null)
  // Tarifa del cliente: el contrato. Cada mes nuevo nace con este valor puesto.
  const [newClientPlan, setNewClientPlan] = useState("")
  const [newClientRate, setNewClientRate] = useState("")
  const [clients, setClients] = useState(initialClients)
  const [expandedClient, setExpandedClient] = useState<string | null>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)
  // Filtro activado desde el resumen de negocio.
  const [summaryFilter, setSummaryFilter] = useState<"ALL" | "DEBT" | "REVIEW" | "APPROVED" | "PUBLISHED">("ALL")
  const [clientChip, setClientChip] = useState("ALL")
  // Pendientes arranca plegado: si lo abrís, queda abierto en las próximas visitas.
  const [pendOpen, setPendOpen] = useState<boolean | null>(null)
  const [showAllPendientes, setShowAllPendientes] = useState(false)
  const [showMonthDialog, setShowMonthDialog] = useState(false)
  const [monthClientId, setMonthClientId] = useState("")
  const [monthPeriod, setMonthPeriod] = useState("")
  // Duplicar mes anterior: "" arranca en blanco.
  const [copyFromId, setCopyFromId] = useState("")
  const [copyIdeas, setCopyIdeas] = useState(true)
  const [copyPricing, setCopyPricing] = useState(true)
  const [copyCosts, setCopyCosts] = useState(true)
  const [copyNotes, setCopyNotes] = useState(true)
  const [creatingMonth, setCreatingMonth] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setPendOpen(localStorage.getItem("wiwiplan-pendientes") === "1")
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  const now = new Date()
  const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

  const createClient = async () => {
    if (!newClientName.trim()) return
    const rateCents = newClientRate.trim() ? parseAmountToCents(newClientRate) : 0
    if (rateCents === null || rateCents < 0) {
      toast.error("Escribe una tarifa válida, por ejemplo 600")
      return
    }
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newClientName,
        email: newClientEmail.trim(),
        logo: newClientLogo,
        planName: newClientPlan.trim(),
        rateCents,
      }),
    })
    if (res.ok) {
      const client = await res.json()
      setClients((prev) => [...prev, client].sort((a, b) => a.name.localeCompare(b.name)))
      setNewClientName("")
      setNewClientEmail("")
      setNewClientLogo(null)
      setNewClientPlan("")
      setNewClientRate("")
      setShowClientForm(false)
      setExpandedClient(client.id)
    } else {
      toast.error("No se pudo crear el cliente")
    }
  }

  /**
   * `copy` viaja explícito y no sale del estado del diálogo: así ningún otro
   * botón de "agregar mes" arrastra por accidente un molde que quedó elegido.
   */
  const createMonth = async (
    clientId: string,
    period: string,
    copy: { fromId: string; ideas: boolean; pricing: boolean; costs: boolean; notes: boolean } | null,
  ) => {
    setCreatingMonth(true)
    const res = await fetch("/api/plannings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "",
        clientId,
        period,
        ...(copy
          ? {
              copyFromId: copy.fromId,
              copy: { ideas: copy.ideas, pricing: copy.pricing, costs: copy.costs, notes: copy.notes },
            }
          : {}),
      }),
    })
    setCreatingMonth(false)
    if (res.ok) {
      const data = await res.json()
      if (copy && data.ideas > 0) {
        toast.success(`Mes creado con ${data.ideas} ${data.ideas === 1 ? "idea copiada" : "ideas copiadas"}`)
      }
      router.push(`/planning/${data.id}`)
      return true
    }
    if (res.status === 409) {
      toast.error("Ese cliente ya tiene un mes con ese período")
    } else if (res.status === 404) {
      toast.error("No encontramos el mes a duplicar")
    } else {
      toast.error("No se pudo crear el mes")
    }
    return false
  }

  /** El mes más reciente del cliente: el candidato natural a duplicar. */
  const latestMonthOf = (clientId: string) => {
    const plans = initial.filter((p) => p.client?.id === clientId)
    if (plans.length === 0) return ""
    return [...plans].sort(sortByPeriod)[0].id
  }

  /** Si el cliente ya tiene el mes corriente, propone el siguiente. */
  const suggestPeriod = (clientId: string) => {
    if (!clientId) return defaultPeriod
    const periods = new Set(initial.filter((p) => p.client?.id === clientId).map((p) => p.period))
    if (!periods.has(defaultPeriod)) return defaultPeriod
    const [y, m] = defaultPeriod.split("-").map(Number)
    const next = new Date(y, m, 1)
    return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`
  }

  const openMonthDialog = (forClientId?: string, forPeriod?: string) => {
    const clientId = forClientId || monthClientId || clients[0]?.id || ""
    setMonthClientId(clientId)
    setMonthPeriod(forPeriod ?? suggestPeriod(clientId))
    setCopyFromId(latestMonthOf(clientId))
    setShowMonthDialog(true)
  }

  const clientPlannings = new Map<string, Planning[]>()
  const uncategorized: Planning[] = []

  for (const p of initial) {
    if (p.client) {
      const arr = clientPlannings.get(p.client.id) ?? []
      arr.push(p)
      clientPlannings.set(p.client.id, arr)
    } else {
      uncategorized.push(p)
    }
  }

  const filteredUncategorized = uncategorized.filter((p) =>
    !search || p.title.toLowerCase().includes(search.toLowerCase())
  )

  const sortByPeriod = (a: Planning, b: Planning) => b.period.localeCompare(a.period) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()

  const hasClientMatch = (c: Client) => {
    if (!search) return true
    const plans = clientPlannings.get(c.id) ?? []
    return c.name.toLowerCase().includes(search.toLowerCase()) || plans.some((p) => p.title.toLowerCase().includes(search.toLowerCase()))
  }

  // --- Resumen de negocio (todo sale de datos ya cargados) ---
  const debtOf = (p: Planning) => summarizePayments(p.priceCents, p.payments).dueCents
  const totalDebt = initial.reduce((sum, p) => sum + debtOf(p), 0)
  const reviewCount = initial.filter((p) => p.status === "REVIEW").length
  const approvedCount = initial.filter((p) => p.status === "APPROVED").length
  const publishedCount = initial.filter((p) => p.status === "PUBLISHED").length

  // --- Pool de "En curso": cambia según el filtro que activaste en el resumen ---
  let basePlans: Planning[]
  let sectionLabel = "En curso"
  if (summaryFilter === "DEBT") {
    basePlans = initial.filter((p) => debtOf(p) > 0)
    sectionLabel = "Con saldo pendiente"
  } else {
    const active = initial.filter((p) => ACTIVE_STATES.includes(p.status))
    if (active.length > 0) {
      basePlans = active
    } else {
      basePlans = [...initial].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6)
      sectionLabel = "Últimos meses tocados"
    }
    if (summaryFilter === "REVIEW") {
      basePlans = basePlans.filter((p) => p.status === "REVIEW")
      sectionLabel = "En revisión"
    } else if (summaryFilter === "APPROVED") {
      basePlans = basePlans.filter((p) => p.status === "APPROVED")
      sectionLabel = "Aprobados"
    } else if (summaryFilter === "PUBLISHED") {
      // Los publicados viven en el archivo: al filtrarlos salen igual en la grilla.
      basePlans = initial.filter((p) => p.status === "PUBLISHED")
      sectionLabel = "Publicados"
    }
  }
  basePlans.sort(sortByPeriod)

  const chipClients = clients.filter((c) => basePlans.some((p) => p.client?.id === c.id))
  const visibleActive = clientChip === "ALL" ? basePlans : basePlans.filter((p) => p.client?.id === clientChip)

  const toggleSummary = (filter: "DEBT" | "REVIEW" | "APPROVED" | "PUBLISHED") => {
    setSummaryFilter((prev) => (prev === filter ? "ALL" : filter))
    setClientChip("ALL")
  }

  // --- Pendientes domados ---
  const PEND_LIMIT = 8
  const visiblePendientes = showAllPendientes ? pendingIdeas : pendingIdeas.slice(0, PEND_LIMIT)
  const togglePend = () =>
    setPendOpen((open) => {
      localStorage.setItem("wiwiplan-pendientes", open ? "0" : "1")
      return !open
    })

  // --- Diálogo nuevo mes ---
  const monthDuplicate =
    !!monthClientId && !!monthPeriod && initial.some((p) => p.client?.id === monthClientId && p.period === monthPeriod)
  const yearOpts = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]

  // Meses que se pueden usar de molde. Primero los del cliente elegido, pero se
  // permite copiar de otro cliente: un esqueleto que funciona sirve para varios.
  const copySources = initial
    .filter((p) => !(p.client?.id === monthClientId && p.period === monthPeriod))
    .sort((a, b) => {
      const own = (p: Planning) => (p.client?.id === monthClientId ? 0 : 1)
      return own(a) - own(b) || sortByPeriod(a, b)
    })
  const copySource = copySources.find((p) => p.id === copyFromId) ?? null
  const copyToggleClass = (on: boolean) =>
    `rounded-md px-2.5 py-1.5 text-xs transition-colors ${
      on ? "bg-white/10 text-zinc-200 ring-1 ring-inset ring-white/20" : "text-zinc-500 hover:text-zinc-300"
    }`

  const metricCardClass = (active: boolean) =>
    `rounded-lg border px-4 py-3 text-left transition-colors ${
      active ? "border-white/25 bg-white/[0.07]" : "border-white/5 bg-[#0c0c0e] hover:bg-white/[0.02]"
    }`

  return (
    <div className="mx-auto max-w-5xl px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] sm:py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3 sm:mb-8 sm:items-center">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-200 sm:text-3xl">WiwiPlan</h1>
          <p className="mt-1 text-sm text-zinc-400 sm:text-base">
            {user.name ?? user.email} — {clients.length} clientes, {initial.length} meses
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <Button className="h-10" onClick={() => setShowClientForm(!showClientForm)}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nuevo cliente</span>
            <span className="sm:hidden">Cliente</span>
          </Button>
          <GlobalSearch />
          <NotificationBell />
          <Link
            href="/settings"
            aria-label="Administración"
            title="Administración"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-100"
          >
            <Settings className="h-4 w-4" />
          </Link>
          <Button variant="ghost" size="icon" aria-label="Cerrar sesión" className="h-10 w-10" onClick={() => signOut({ callbackUrl: "/login" })}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {showClientForm && (
        <div className="mb-8 rounded-lg border border-white/5 bg-[#0c0c0e] p-4">
          <h2 className="mb-3 text-lg font-semibold text-zinc-200">Nuevo cliente</h2>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button type="button" onClick={() => logoInputRef.current?.click()} className="relative w-12 h-12 shrink-0 rounded-full border border-dashed border-white/10 flex items-center justify-center hover:bg-white/5 overflow-hidden">
                {newClientLogo ? (
                  <img src={newClientLogo} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <Camera size={16} className="text-zinc-500" />
                )}
              </button>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                aria-label="Logo del cliente"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ""
                  if (file) setNewClientLogo(await compressAvatar(file))
                }}
              />
            </div>
            <Input
              placeholder="Nombre del cliente"
              value={newClientName}
              onChange={(e) => setNewClientName(e.target.value)}
              className="h-10 w-full sm:h-9 sm:min-w-[12rem] sm:flex-1"
            />
            <Input
              placeholder="Email (opcional)"
              value={newClientEmail}
              onChange={(e) => setNewClientEmail(e.target.value)}
              className="h-10 w-full sm:h-9 sm:min-w-[12rem] sm:flex-1"
            />
            <Input
              placeholder="Plan (opcional, ej.: Plan Crecimiento)"
              value={newClientPlan}
              onChange={(e) => setNewClientPlan(e.target.value)}
              className="h-10 w-full sm:h-9 sm:min-w-[12rem] sm:flex-1"
            />
            <div className="relative w-full sm:w-36">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400">$</span>
              <Input
                placeholder="600.00"
                inputMode="decimal"
                aria-label="Tarifa mensual del cliente"
                value={newClientRate}
                onChange={(e) => setNewClientRate(e.target.value)}
                className="h-10 w-full pl-7 tabular-nums sm:h-9"
              />
            </div>
            <Button className="h-10 w-full sm:w-auto" onClick={createClient}>Crear cliente</Button>
            <p className="w-full text-xs text-zinc-500">
              La tarifa mensual es el contrato: cada mes nuevo de este cliente ya nace con ese valor
              puesto, y no hay que volver a teclearlo.
            </p>
          </div>
        </div>
      )}

      {/* Resumen de negocio: un vistazo al dinero y al pipeline */}
      <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <button
          type="button"
          className={metricCardClass(summaryFilter === "DEBT")}
          onClick={() => toggleSummary("DEBT")}
        >
          <p className="text-[11px] uppercase tracking-wide text-zinc-500">Por cobrar</p>
          <p className={`mt-1 text-xl font-bold tabular-nums ${totalDebt > 0 ? "text-amber-300" : "text-zinc-100"}`}>
            {formatMoney(totalDebt)}
          </p>
        </button>
        <button
          type="button"
          className={metricCardClass(summaryFilter === "REVIEW")}
          onClick={() => toggleSummary("REVIEW")}
        >
          <p className="text-[11px] uppercase tracking-wide text-zinc-500">En revisión</p>
          <p className={`mt-1 text-xl font-bold tabular-nums ${reviewCount > 0 ? "text-yellow-300" : "text-zinc-100"}`}>
            {reviewCount}
          </p>
        </button>
        <button
          type="button"
          className={metricCardClass(summaryFilter === "APPROVED")}
          onClick={() => toggleSummary("APPROVED")}
        >
          <p className="text-[11px] uppercase tracking-wide text-zinc-500">Aprobados</p>
          <p className={`mt-1 text-xl font-bold tabular-nums ${approvedCount > 0 ? "text-green-300" : "text-zinc-100"}`}>
            {approvedCount}
          </p>
        </button>
        <button
          type="button"
          className={metricCardClass(summaryFilter === "PUBLISHED")}
          onClick={() => toggleSummary("PUBLISHED")}
        >
          <p className="text-[11px] uppercase tracking-wide text-zinc-500">Publicados</p>
          <p className={`mt-1 text-xl font-bold tabular-nums ${publishedCount > 0 ? "text-purple-300" : "text-zinc-100"}`}>
            {publishedCount}
          </p>
        </button>
      </section>

      {/* En curso: los meses vivos a un clic, sin acordeón */}
      <section className="mb-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-zinc-200">
            {sectionLabel} <span className="text-sm font-normal text-zinc-500">({visibleActive.length})</span>
          </h2>
          {clients.length > 0 && (
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => openMonthDialog()}>
              <Plus className="h-3 w-3" /> Nuevo mes
            </Button>
          )}
        </div>
        {chipClients.length > 1 && (
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {[{ id: "ALL", name: "Todos" }, ...chipClients].map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setClientChip(c.id)}
                aria-pressed={clientChip === c.id}
                className={`inline-flex min-h-9 shrink-0 items-center rounded-full border px-3.5 text-xs font-medium transition-colors ${
                  clientChip === c.id
                    ? "border-white/20 bg-white/10 text-zinc-100"
                    : "border-white/5 text-zinc-400 hover:border-white/15 hover:text-zinc-200"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
        {visibleActive.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleActive.map((p) => (
              <MonthCard key={p.id} p={p} />
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-white/10 p-6 text-center text-xs text-zinc-400">
            {summaryFilter === "ALL"
              ? clients.length === 0
                ? "Crea un cliente para empezar."
                : "Nada en curso. Crea un mes nuevo para arrancar."
              : "Sin meses que cumplan ese filtro."}
          </p>
        )}
      </section>

      {pendingIdeas.length > 0 && (
        <section className="mb-8">
          <button type="button" onClick={togglePend} aria-expanded={pendOpen ?? false} className="mb-3 flex min-h-11 w-full items-center gap-2 text-left text-lg font-semibold text-zinc-200 hover:text-white">
            <ArrowUp className="h-4 w-4 shrink-0 text-rose-400" />
            <span>Pendientes ({pendingIdeas.length})</span>
            <ChevronDown className={`ml-auto h-4 w-4 shrink-0 text-zinc-500 transition-transform ${pendOpen ?? false ? "" : "-rotate-90"}`} />
          </button>
          {(pendOpen ?? false) && (
          <>
          {/* Mobile cards */}
          <div className="space-y-3 sm:hidden">
            {visiblePendientes.map((idea) => (
              <div key={idea.id} className="rounded-lg border border-white/5 bg-[#0c0c0e] overflow-hidden cursor-pointer" onClick={() => router.push(`/planning/${idea.planning.id}?idea=${idea.id}`)}>
                <div className="p-3 space-y-2">
                  <p className="text-sm font-medium text-zinc-200">{idea.title}</p>
                  {idea.description && <p className="text-xs text-zinc-400 line-clamp-2">{idea.description}</p>}
                  <div className="flex flex-wrap gap-1.5 text-xs text-zinc-400">
                    <span className="rounded bg-white/5 px-1.5 py-0.5">
                      {idea.planning.client?.name}{idea.planning.period && <> — {formatPeriod(idea.planning.period)}</>}
                    </span>
                    <span className="rounded bg-white/5 px-1.5 py-0.5 text-zinc-400">{ideaStatusLabels[idea.status] ?? idea.status}</span>
                    <span className={`rounded bg-white/5 px-1.5 py-0.5 ${idea.priority === "HIGH" ? "text-rose-400" : idea.priority === "MEDIUM" ? "text-amber-400" : "text-zinc-400"}`}>
                      {priorityLabels[idea.priority] ?? idea.priority}
                    </span>
                    {idea.dueDate && (
                      <span className="rounded bg-white/5 px-1.5 py-0.5 text-zinc-400">
                        📅 {formatDayLabel(idea.dueDate)}
                      </span>
                    )}
                  </div>
                  {idea._count.comments > 0 && (
                    <p className="text-xs text-zinc-400"><MessageSquare className="h-3 w-3 inline-block" /> {idea._count.comments} comentarios</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto rounded-lg border border-white/5">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.03]">
                <tr className="border-b border-white/5">
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-400">Título</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-400">Cliente / Mes</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-400">Estado</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-400">Prioridad</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-400"><Calendar className="h-3 w-3 inline" /> Entrega</th>
                  <th className="w-10 px-3 py-2 text-center text-xs font-medium uppercase tracking-wide text-zinc-400"><MessageSquare className="h-3 w-3 inline-block" /></th>
                </tr>
              </thead>
              <tbody>
                {visiblePendientes.map((idea) => (
                  <tr key={idea.id} className="cursor-pointer border-b border-white/5 last:border-0 hover:bg-white/[0.02]" onClick={() => router.push(`/planning/${idea.planning.id}?idea=${idea.id}`)}>
                    <td className="px-3 py-2">
                      <p className="font-medium text-zinc-200">{idea.title}</p>
                      {idea.description && <p className="text-xs text-zinc-400 line-clamp-1">{idea.description}</p>}
                    </td>
                    <td className="px-3 py-2 text-xs text-zinc-400">
                      {idea.planning.client?.name}
                      {idea.planning.period && <span> — {formatPeriod(idea.planning.period)}</span>}
                    </td>
                    <td className="px-3 py-2">
                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-zinc-400">{ideaStatusLabels[idea.status] ?? idea.status}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`text-xs font-semibold ${idea.priority === "HIGH" ? "text-rose-400" : idea.priority === "MEDIUM" ? "text-amber-400" : "text-zinc-400"}`}>{idea.priority === "HIGH" ? "Alta" : idea.priority === "MEDIUM" ? "Media" : "Baja"}</span>
                    </td>
                    <td className="px-3 py-2 text-xs text-zinc-400">
                      {idea.dueDate ? formatDayLabel(idea.dueDate) : "—"}
                    </td>
                    <td className="px-3 py-2 text-center text-xs text-zinc-400">
                      {idea._count.comments > 0 && <MessageSquare className="h-3 w-3 inline-block" />}
                      {idea._count.comments}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pendingIdeas.length > 8 && (
            <button
              type="button"
              onClick={() => setShowAllPendientes((v) => !v)}
              className="mt-3 w-full rounded-lg border border-dashed border-white/10 py-2.5 text-xs text-zinc-400 transition-colors hover:border-white/20 hover:text-zinc-200"
            >
              {showAllPendientes ? "Ver menos" : `Ver todas (${pendingIdeas.length})`}
            </button>
          )}
          </>
          )}
        </section>
      )}

      <div className="mb-6">
        <Input
          placeholder="Buscar clientes o meses..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 sm:h-9"
        />
      </div>

      <div className="space-y-4">
        {clients.filter(hasClientMatch).map((client) => {
          const plans = (clientPlannings.get(client.id) ?? []).sort(sortByPeriod)
          const isExpanded = expandedClient === client.id
          const latestPeriod = plans.length > 0 ? formatPeriod(plans[0].period) : null
          return (
            <div key={client.id} className="rounded-lg border border-white/5 bg-[#0c0c0e]">
              <button
                type="button"
                onClick={() => setExpandedClient(isExpanded ? null : client.id)}
                className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 rounded-lg px-4 py-3.5 text-left transition-colors hover:bg-white/[0.02]"
              >
                <ClientLogo clientId={client.id} name={client.name} size={28} />
                <span className="text-base sm:text-lg font-semibold text-zinc-200 truncate">{client.name}</span>
                {latestPeriod && <span className="rounded bg-white/5 px-1.5 py-0.5 text-[11px] font-medium text-zinc-400">{latestPeriod}</span>}
                <span className="text-xs text-zinc-400">{plans.length} {plans.length === 1 ? "mes" : "meses"}</span>
                {(() => {
                  // Un chip por cada mes con deuda: el total mezclado no deja
                  // claro de qué período es lo que falta cobrar.
                  const conDeuda = plans
                    .filter((plan) => summarizePayments(plan.priceCents, plan.payments).dueCents > 0)
                    .sort(sortByPeriod)
                  if (conDeuda.length === 0) return null
                  return conDeuda.map((plan) => {
                    const due = summarizePayments(plan.priceCents, plan.payments).dueCents
                    return (
                      <span
                        key={plan.id}
                        className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium tabular-nums text-amber-300 ring-1 ring-inset ring-amber-400/25"
                        title={`Saldo pendiente de ${formatPeriod(plan.period) || plan.title}`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden />
                        {formatPeriodShort(plan.period) || plan.title}: debe {formatMoney(due)}
                      </span>
                    )
                  })
                })()}
                <ChevronRight className={`ml-auto h-4 w-4 text-zinc-500 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
              </button>
              {isExpanded && (
                <div className="border-t border-white/5 p-4">
                  <div className="mb-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => openMonthDialog(client.id, defaultPeriod)}>
                      <Plus className="h-3 w-3" /> Agregar {formatPeriod(defaultPeriod)}
                    </Button>
                    {/* Va acá y no en el encabezado: ese ya es un botón entero y
                        no se puede anidar otro adentro. */}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={() => router.push(`/clients/${client.id}`)}
                    >
                      <Wallet className="h-3 w-3" /> Estado de cuenta
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {plans.map((p) => (
                      <MonthCard key={p.id} p={p} />
                    ))}
                    {plans.length === 0 && <p className="col-span-full py-6 text-center text-xs text-zinc-400">Sin meses todavía. Agrega el primer mes.</p>}
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {filteredUncategorized.length > 0 && (
          <div className="rounded-lg border border-white/5 bg-[#0c0c0e]">
            <div className="px-4 py-3">
              <span className="text-lg font-semibold text-zinc-200">Sin cliente</span>
              <span className="ml-2 text-xs text-zinc-400">{filteredUncategorized.length} planificaciones</span>
            </div>
            <div className="grid gap-3 border-t border-white/5 p-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredUncategorized.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => router.push(`/planning/${p.id}`)}
                  className="group rounded-lg border border-white/5 bg-[#0c0c0e] p-4 text-left transition-all hover:bg-white/[0.02]"
                >
                  <h3 className="text-sm font-semibold text-zinc-200 group-hover:text-white">{p.title}</h3>
                  <div className="mt-2 flex gap-3 text-xs text-zinc-400">
                    <span className="flex items-center gap-1"><Lightbulb className="h-3 w-3" /> {p._count.contentIdeas} ideas</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {clients.filter(hasClientMatch).length === 0 && filteredUncategorized.length === 0 && (
          <div className="rounded-lg border border-dashed border-white/10 p-12 text-center">
            <p className="text-zinc-400">{search ? "Sin resultados" : "Crea un cliente para empezar."}</p>
          </div>
        )}
      </div>

      {showMonthDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4" onClick={() => setShowMonthDialog(false)}>
          <div className="w-full max-w-sm rounded-lg border border-white/5 bg-[#0c0c0e] p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-1 text-lg font-semibold text-zinc-200">Nuevo mes</h2>
            <p className="mb-4 text-xs text-zinc-400">Elige el cliente y el período a planificar.</p>
            <div className="space-y-3">
              <select
                value={monthClientId}
                onChange={(e) => {
                  setMonthClientId(e.target.value)
                  setMonthPeriod(suggestPeriod(e.target.value))
                  setCopyFromId(latestMonthOf(e.target.value))
                }}
                className="h-10 w-full rounded-lg border border-white/10 bg-[#18181b] px-3 text-sm text-zinc-200 focus:outline-none"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <select
                  value={monthPeriod.slice(5)}
                  onChange={(e) => setMonthPeriod(`${monthPeriod.slice(0, 4)}-${e.target.value}`)}
                  className="h-10 min-w-0 flex-1 rounded-lg border border-white/10 bg-[#18181b] px-3 text-sm text-zinc-200 focus:outline-none"
                >
                  {Object.entries(months).map(([num, name]) => (
                    <option key={num} value={num}>{name}</option>
                  ))}
                </select>
                <select
                  value={monthPeriod.slice(0, 4)}
                  onChange={(e) => setMonthPeriod(`${e.target.value}-${monthPeriod.slice(5)}`)}
                  className="h-10 w-24 shrink-0 rounded-lg border border-white/10 bg-[#18181b] px-3 text-sm text-zinc-200 focus:outline-none"
                >
                  {yearOpts.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              {copySources.length > 0 && (
                <div className="rounded-lg border border-white/5 bg-[#0a0a0c] p-3">
                  <label htmlFor="copy-from" className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                    Duplicar de
                  </label>
                  <select
                    id="copy-from"
                    value={copyFromId}
                    onChange={(e) => setCopyFromId(e.target.value)}
                    className="h-10 w-full rounded-lg border border-white/10 bg-[#18181b] px-3 text-sm text-zinc-200 focus:outline-none"
                  >
                    <option value="">Empezar en blanco</option>
                    {copySources.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.client?.id === monthClientId ? "" : `${p.client?.name ?? "Sin cliente"} · `}
                        {formatPeriod(p.period) || p.title} — {p._count.contentIdeas} ideas
                      </option>
                    ))}
                  </select>
                  {copySource && (
                    <>
                      <div className="mt-2.5 flex flex-wrap gap-1">
                        <button type="button" onClick={() => setCopyIdeas(!copyIdeas)} className={copyToggleClass(copyIdeas)}>
                          Ideas
                        </button>
                        <button type="button" onClick={() => setCopyPricing(!copyPricing)} className={copyToggleClass(copyPricing)}>
                          Precio y cuotas
                        </button>
                        <button type="button" onClick={() => setCopyCosts(!copyCosts)} className={copyToggleClass(copyCosts)}>
                          Costos
                        </button>
                        <button type="button" onClick={() => setCopyNotes(!copyNotes)} className={copyToggleClass(copyNotes)}>
                          Notas del plan
                        </button>
                      </div>
                      <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
                        Las ideas se copian como ideas nuevas, sin comentarios, imágenes ni estado de producción.
                        Los cobros registrados y los storyboards no se copian.
                      </p>
                    </>
                  )}
                </div>
              )}
              {monthDuplicate && (
                <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-300 ring-1 ring-inset ring-amber-400/25">
                  Ese cliente ya tiene un mes con este período.
                </p>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="ghost" className="min-h-10" onClick={() => setShowMonthDialog(false)}>Cancelar</Button>
                <Button
                  className="min-h-10 bg-brand text-white hover:bg-[#d0424a]"
                  disabled={monthDuplicate || !monthClientId || creatingMonth}
                  onClick={async () => {
                    const created = await createMonth(
                      monthClientId,
                      monthPeriod,
                      copySource
                        ? {
                            fromId: copySource.id,
                            ideas: copyIdeas,
                            pricing: copyPricing,
                            costs: copyCosts,
                            notes: copyNotes,
                          }
                        : null,
                    )
                    if (created) setShowMonthDialog(false)
                  }}
                >
                  {creatingMonth ? "Creando…" : copySource ? "Crear y duplicar" : "Crear mes"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

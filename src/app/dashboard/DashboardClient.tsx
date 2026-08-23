"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Plus, LogOut, Lightbulb, Layout, MessageSquare, Calendar, ArrowUp, ChevronRight, Building2, Camera } from "lucide-react"
import { signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { ClientLogo } from "@/components/ClientLogo"
import { paymentDotStyles } from "@/components/payments/PaymentStatus"
import { formatMoney, summarizePayments } from "@/lib/payments"
import { compressAvatar } from "@/lib/compress-image"
import { Input } from "@/components/ui/input"
import { NotificationBell } from "@/components/NotificationBell"

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
  const [clients, setClients] = useState(initialClients)
  const [expandedClient, setExpandedClient] = useState<string | null>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)

  const now = new Date()
  const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

  const createClient = async () => {
    if (!newClientName.trim()) return
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newClientName, email: newClientEmail || newClientName.toLowerCase().replace(/\s+/g, ".") + "@temp.com", logo: newClientLogo }),
    })
    if (res.ok) {
      const client = await res.json()
      setClients((prev) => [...prev, client].sort((a, b) => a.name.localeCompare(b.name)))
      setNewClientName("")
      setNewClientEmail("")
      setNewClientLogo(null)
      setShowClientForm(false)
      setExpandedClient(client.id)
    }
  }

  const createMonth = async (clientId: string, period: string) => {
    const res = await fetch("/api/plannings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "", clientId, period }),
    })
    if (res.ok) {
      const data = await res.json()
      router.push(`/planning/${data.id}`)
    }
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

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-200">WiwiPlan</h1>
          <p className="mt-1 text-zinc-400">
            {user.name ?? user.email} — {clients.length} clientes, {initial.length} meses
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => setShowClientForm(!showClientForm)}>
            <Plus className="h-4 w-4" /> Nuevo cliente
          </Button>
          <NotificationBell />
          <Button variant="ghost" size="icon" onClick={() => signOut({ callbackUrl: "/login" })}>
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
              className="flex-1"
            />
            <Input
              placeholder="Email (opcional)"
              value={newClientEmail}
              onChange={(e) => setNewClientEmail(e.target.value)}
              className="flex-1"
            />
            <Button onClick={createClient}>Crear cliente</Button>
          </div>
        </div>
      )}

      {pendingIdeas.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-zinc-200">
            <ArrowUp className="h-4 w-4 text-rose-400" /> Pendientes ({pendingIdeas.length})
          </h2>

          {/* Mobile cards */}
          <div className="space-y-3 sm:hidden">
            {pendingIdeas.map((idea) => (
              <div key={idea.id} className="rounded-lg border border-white/5 bg-[#0c0c0e] overflow-hidden cursor-pointer" onClick={() => router.push(`/planning/${idea.planning.id}`)}>
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
                        📅 {new Date(idea.dueDate).toLocaleDateString("es-AR")}
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
                {pendingIdeas.map((idea) => (
                  <tr key={idea.id} className="cursor-pointer border-b border-white/5 last:border-0 hover:bg-white/[0.02]" onClick={() => router.push(`/planning/${idea.planning.id}`)}>
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
                      {idea.dueDate ? new Date(idea.dueDate).toLocaleDateString("es-AR") : "—"}
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
        </section>
      )}

      <div className="mb-6">
        <Input
          placeholder="Buscar clientes o meses..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
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
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors flex-wrap"
              >
                <ClientLogo clientId={client.id} name={client.name} size={28} />
                <span className="text-base sm:text-lg font-semibold text-zinc-200 truncate">{client.name}</span>
                {latestPeriod && <span className="rounded bg-white/5 px-1.5 py-0.5 text-[11px] font-medium text-zinc-400">{latestPeriod}</span>}
                <span className="text-xs text-zinc-400">{plans.length} {plans.length === 1 ? "mes" : "meses"}</span>
                {(() => {
                  const debe = plans.reduce(
                    (sum, plan) => sum + summarizePayments(plan.priceCents, plan.payments).dueCents,
                    0,
                  )
                  if (debe === 0) return null
                  return (
                    <span className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium tabular-nums text-amber-300 ring-1 ring-inset ring-amber-400/25">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden />
                      debe {formatMoney(debe)}
                    </span>
                  )
                })()}
                <ChevronRight className={`ml-auto h-4 w-4 text-zinc-500 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
              </button>
              {isExpanded && (
                <div className="border-t border-white/5 p-4">
                  <div className="mb-3">
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => createMonth(client.id, defaultPeriod)}>
                      <Plus className="h-3 w-3" /> Agregar {formatPeriod(defaultPeriod)}
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {plans.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => router.push(`/planning/${p.id}`)}
                        className="group rounded-lg border border-white/5 bg-[#0c0c0e] p-4 text-left transition-all hover:bg-white/[0.02]"
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-zinc-200 group-hover:text-white">
                            {p.period ? formatPeriod(p.period) : p.title}
                          </h3>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${statusColors[p.status]}`}>
                            {p.status === "DRAFT" ? "Borrador" : p.status === "IN_PROGRESS" ? "En Progreso" : p.status === "REVIEW" ? "Revisión" : p.status === "APPROVED" ? "Aprobado" : p.status === "PUBLISHED" ? "Publicado" : p.status}
                          </span>
                        </div>
                        {p.title && p.period && <p className="mb-2 text-xs text-zinc-400">{p.title}</p>}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-zinc-400">
                          <span className="flex items-center gap-1"><Lightbulb className="h-3 w-3" /> {p._count.contentIdeas} ideas</span>
                          <span className="flex items-center gap-1"><Layout className="h-3 w-3" /> {p._count.storyboards} sb</span>
                          {(() => {
                            const cobro = summarizePayments(p.priceCents, p.payments)
                            if (cobro.state === "UNPRICED") return null
                            return (
                              <span className="flex items-center gap-1 tabular-nums">
                                <span className={`h-1.5 w-1.5 rounded-full ${paymentDotStyles[cobro.state]}`} aria-hidden />
                                {cobro.dueCents > 0
                                  ? `debe ${formatMoney(cobro.dueCents)}`
                                  : "pagado"}
                              </span>
                            )
                          })()}
                        </div>
                      </button>
                    ))}
                    {plans.length === 0 && <p className="col-span-full py-6 text-center text-xs text-zinc-400">Sin meses todavía. Agregá el primer mes.</p>}
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
            <p className="text-zinc-400">{search ? "Sin resultados" : "Creá un cliente para empezar."}</p>
          </div>
        )}
      </div>
    </div>
  )
}

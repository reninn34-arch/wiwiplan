"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, LogOut, Lightbulb, Layout, MessageSquare, Calendar, ArrowUp, ChevronRight, Building2 } from "lucide-react"
import { signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

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
  DRAFT: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  IN_PROGRESS: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  REVIEW: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  APPROVED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  PUBLISHED: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
}

interface Client {
  id: string
  name: string
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

export function DashboardClient({ plannings: initial, clients, pendingIdeas, user }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [showNewForm, setShowNewForm] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [newClientId, setNewClientId] = useState("")
  const [newPeriod, setNewPeriod] = useState("")
  const [expandedClient, setExpandedClient] = useState<string | null>(null)

  const now = new Date()
  const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

  const createPlanning = async () => {
    const res = await fetch("/api/plannings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle || "Sin título", clientId: newClientId || null, period: newPeriod || defaultPeriod }),
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
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">WiwiPlan</h1>
          <p className="mt-1 text-muted-foreground">
            {user.name ?? user.email} — {clients.length} clientes, {initial.length} meses
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => setShowNewForm(!showNewForm)}>
            <Plus className="h-4 w-4" /> Nuevo mes
          </Button>
          <Button variant="ghost" size="icon" onClick={() => signOut({ callbackUrl: "/login" })}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {showNewForm && (
        <div className="mb-8 rounded-lg border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">Nuevo mes de contenido</h2>
          <div className="flex flex-wrap gap-3">
            <select
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={newClientId}
              onChange={(e) => setNewClientId(e.target.value)}
            >
              <option value="">Seleccionar cliente...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <input
              type="month"
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={newPeriod || defaultPeriod}
              onChange={(e) => setNewPeriod(e.target.value)}
            />
            <Input
              placeholder="Título (opcional)"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="flex-1"
            />
            <Button onClick={createPlanning}>Crear</Button>
          </div>
        </div>
      )}

      {pendingIdeas.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <ArrowUp className="h-4 w-4 text-red-500" /> Pendientes ({pendingIdeas.length})
          </h2>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="border-b">
                  <th className="px-3 py-2 text-left font-medium">Título</th>
                  <th className="px-3 py-2 text-left font-medium">Planificación</th>
                  <th className="px-3 py-2 text-left font-medium">Estado</th>
                  <th className="px-3 py-2 text-left font-medium">Prioridad</th>
                  <th className="px-3 py-2 text-left font-medium"><Calendar className="h-3 w-3 inline" /> Entrega</th>
                  <th className="w-10 px-3 py-2 text-center"><MessageSquare className="h-3 w-3 inline-block" /></th>
                </tr>
              </thead>
              <tbody>
                {pendingIdeas.map((idea) => (
                  <tr key={idea.id} className="cursor-pointer border-b last:border-0 hover:bg-muted/30" onClick={() => router.push(`/planning/${idea.planning.id}`)}>
                    <td className="px-3 py-2">
                      <p className="font-medium">{idea.title}</p>
                      {idea.description && <p className="text-xs text-muted-foreground line-clamp-1">{idea.description}</p>}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {idea.planning.title}
                      {idea.planning.client && <span> — {idea.planning.client.name}</span>}
                      {idea.planning.period && <span className="ml-1 text-[10px]">({formatPeriod(idea.planning.period)})</span>}
                    </td>
                    <td className="px-3 py-2">
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{idea.status}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`text-xs font-semibold ${idea.priority === "HIGH" ? "text-red-600" : idea.priority === "MEDIUM" ? "text-amber-600" : "text-green-600"}`}>{idea.priority}</span>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {idea.dueDate ? new Date(idea.dueDate).toLocaleDateString("es-AR") : "—"}
                    </td>
                    <td className="px-3 py-2 text-center text-xs text-muted-foreground">
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

      <div className="space-y-6">
        {clients.filter(hasClientMatch).map((client) => {
          const plans = (clientPlannings.get(client.id) ?? []).sort(sortByPeriod)
          const isExpanded = expandedClient === client.id
          return (
            <div key={client.id} className="rounded-lg border bg-card shadow-sm">
              <button
                type="button"
                onClick={() => setExpandedClient(isExpanded ? null : client.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
              >
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <span className="text-lg font-semibold">{client.name}</span>
                <span className="text-xs text-muted-foreground">{plans.length} meses</span>
                <ChevronRight className={`ml-auto h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`} />
              </button>
              {isExpanded && (
                <div className="grid gap-3 border-t p-4 sm:grid-cols-2 lg:grid-cols-3">
                  {plans.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => router.push(`/planning/${p.id}`)}
                      className="group rounded-lg border bg-card p-4 text-left shadow-sm transition-all hover:shadow-md"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <h3 className="text-sm font-semibold group-hover:text-primary">
                          {p.period ? formatPeriod(p.period) : p.title}
                        </h3>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${statusColors[p.status]}`}>
                          {p.status}
                        </span>
                      </div>
                      {p.title && p.period && <p className="mb-2 text-xs text-muted-foreground">{p.title}</p>}
                      <div className="flex gap-3 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1"><Lightbulb className="h-3 w-3" /> {p._count.contentIdeas} ideas</span>
                        <span className="flex items-center gap-1"><Layout className="h-3 w-3" /> {p._count.storyboards} sb</span>
                      </div>
                    </button>
                  ))}
                  {plans.length === 0 && <p className="col-span-full py-4 text-center text-xs text-muted-foreground">Sin meses aún</p>}
                </div>
              )}
            </div>
          )
        })}

        {filteredUncategorized.length > 0 && (
          <div className="rounded-lg border bg-card shadow-sm">
            <div className="px-4 py-3">
              <span className="text-lg font-semibold">Sin cliente</span>
              <span className="ml-2 text-xs text-muted-foreground">{filteredUncategorized.length} planificaciones</span>
            </div>
            <div className="grid gap-3 border-t p-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredUncategorized.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => router.push(`/planning/${p.id}`)}
                  className="group rounded-lg border bg-card p-4 text-left shadow-sm transition-all hover:shadow-md"
                >
                  <h3 className="text-sm font-semibold group-hover:text-primary">{p.title}</h3>
                  <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Lightbulb className="h-3 w-3" /> {p._count.contentIdeas} ideas</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {clients.filter(hasClientMatch).length === 0 && filteredUncategorized.length === 0 && (
          <div className="rounded-lg border border-dashed p-12 text-center">
            <p className="text-muted-foreground">{search ? "Sin resultados" : "No hay clientes ni planificaciones. Creá un nuevo mes."}</p>
          </div>
        )}
      </div>
    </div>
  )
}

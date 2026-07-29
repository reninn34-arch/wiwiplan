"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, LogOut, Lightbulb, Layout, MessageSquare, Calendar, ArrowUp, ArrowDown } from "lucide-react"
import { signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const statusLabels: Record<string, string> = {
  DRAFT: "Borrador",
  IN_PROGRESS: "En Progreso",
  REVIEW: "Revisión",
  APPROVED: "Aprobado",
  PUBLISHED: "Publicado",
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
  status: string
  updatedAt: string
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
  planning: { id: string; title: string; status: string; client: { name: string } | null }
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

  const filtered = initial.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase())
  )

  const createPlanning = async () => {
    const res = await fetch("/api/plannings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle || "Sin título", clientId: newClientId || null }),
    })
    if (res.ok) {
      const data = await res.json()
      router.push(`/planning/${data.id}`)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">WiwiPlan</h1>
          <p className="mt-1 text-muted-foreground">
            {user.name ?? user.email} — {initial.length} planificaciones
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => setShowNewForm(!showNewForm)}>
            <Plus className="h-4 w-4" /> Nueva
          </Button>
          <Button variant="ghost" size="icon" onClick={() => signOut({ callbackUrl: "/login" })}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {showNewForm && (
        <div className="mb-8 rounded-lg border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">Nueva Planificación</h2>
          <div className="flex gap-3">
            <Input
              placeholder="Título"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="flex-1"
            />
            <select
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={newClientId}
              onChange={(e) => setNewClientId(e.target.value)}
            >
              <option value="">Sin cliente</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
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
          placeholder="Buscar planificaciones..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">
            {search ? "Sin resultados" : "No hay planificaciones todavía. Creá una nueva."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => router.push(`/planning/${p.id}`)}
              className="group rounded-lg border bg-card p-4 text-left shadow-sm transition-all hover:shadow-md"
            >
              <div className="mb-3 flex items-start justify-between">
                <h3 className="font-semibold group-hover:text-primary">{p.title}</h3>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${statusColors[p.status]}`}>
                  {statusLabels[p.status] ?? p.status}
                </span>
              </div>
              {p.client && (
                <p className="mb-2 text-sm text-muted-foreground">Cliente: {p.client.name}</p>
              )}
              <div className="flex gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Lightbulb className="h-3 w-3" /> {p._count.contentIdeas} ideas
                </span>
                <span className="flex items-center gap-1">
                  <Layout className="h-3 w-3" /> {p._count.storyboards} storyboards
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {new Date(p.updatedAt).toLocaleDateString("es-AR")}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

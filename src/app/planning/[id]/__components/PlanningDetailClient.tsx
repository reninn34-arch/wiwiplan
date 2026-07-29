"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Info, Table, Layout, Share2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InfoTab } from "./InfoTab"
import { ContentIdeasTab } from "./ContentIdeasTab"
import { StoryboardsTab } from "./StoryboardsTab"
import { ShareModal } from "./ShareModal"

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

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  IN_PROGRESS: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  REVIEW: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  APPROVED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  PUBLISHED: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
}

const tabs = [
  { id: "contenido", label: "Contenido", icon: Table },
  { id: "info", label: "Info", icon: Info },
  { id: "storyboard", label: "Storyboard", icon: Layout },
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
    description: string
    panels: Array<{
      id: string
      sceneNumber: number
      imageUrl: string
      description: string
      duration: string
      notes: string
      order: number
    }>
  }>
  shareLinks: Array<{
    id: string
    token: string
    expiresAt: string | null
    createdAt: string
  }>
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

  const startEditPeriod = () => {
    const parts = planning.period ? planning.period.split("-") : []
    setPeriodMonth(parts[1] ?? "")
    setPeriodYear(parts[0] ?? "")
    setEditingPeriod(true)
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">{planning.title}</h1>
              {editingPeriod ? (
                <div className="flex items-center gap-1" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) savePeriod() }}>
                  <select
                    className="h-7 rounded-md border border-input bg-background px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    value={periodMonth}
                    onChange={(e) => setPeriodMonth(e.target.value)}
                    autoFocus
                  >
                    <option value="">Mes</option>
                    {Object.entries(months).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <select
                    className="h-7 rounded-md border border-input bg-background px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    value={periodYear}
                    onChange={(e) => setPeriodYear(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") savePeriod() }}
                  >
                    <option value="">Año</option>
                    {Array.from({ length: 10 }, (_, i) => {
                      const y = new Date().getFullYear() - 1 + i
                      return <option key={y} value={y}>{y}</option>
                    })}
                  </select>
                  <button type="button" onClick={savePeriod} className="h-7 rounded-md bg-primary px-2 text-[10px] font-medium text-primary-foreground hover:bg-primary/90">OK</button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={startEditPeriod}
                  className="inline-flex items-center gap-1 rounded-md border bg-muted/50 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  {planning.period ? formatPeriod(planning.period) : "Asignar mes"}
                </button>
              )}
            </div>
            {planning.client && (
              <p className="text-sm text-muted-foreground">Cliente: {planning.client.name}</p>
            )}
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusColors[planning.status]}`}>
            {statusLabels[planning.status] ?? planning.status}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowShare(true)}>
            <Share2 className="h-4 w-4" /> Compartir
          </Button>
          <Button variant="ghost" size="icon" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </header>

      <div className="mb-6 border-b">
        <nav className="flex gap-0">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {activeTab === "info" && (
        <InfoTab planning={planning} clients={clients} onUpdate={updatePlanning} />
      )}
      {activeTab === "contenido" && (
        <ContentIdeasTab planningId={planning.id} ideas={planning.contentIdeas} storyboards={planning.storyboards.map((s) => ({ id: s.id, title: s.title }))} />
      )}
      {activeTab === "storyboard" && (
        <StoryboardsTab planningId={planning.id} storyboards={planning.storyboards} />
      )}

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

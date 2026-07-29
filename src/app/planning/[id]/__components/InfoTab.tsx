"use client"

import { useState } from "react"
import { Save, Plus, Trash2, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RichEditor } from "./RichEditor"

interface Client {
  id: string
  name: string
  email?: string
}

interface InfoTabProps {
  planning: {
    id: string
    title: string
    description: string
    targetAudience: string
    goals: string
    notes: string
    status: string
    clientId: string | null
  }
  clients: Client[]
  onUpdate: (updates: Record<string, unknown>) => void
}

export function InfoTab({ planning, clients: initialClients, onUpdate }: InfoTabProps) {
  const [title, setTitle] = useState(planning.title)
  const [description, setDescription] = useState(planning.description)
  const [targetAudience, setTargetAudience] = useState(planning.targetAudience)
  const [goals, setGoals] = useState(planning.goals)
  const [notes, setNotes] = useState(planning.notes)
  const [clientId, setClientId] = useState(planning.clientId ?? "")
  const [status, setStatus] = useState(planning.status)
  const [saving, setSaving] = useState(false)
  const [clients, setClients] = useState(initialClients)
  const [showNewClient, setShowNewClient] = useState(false)
  const [newClientName, setNewClientName] = useState("")
  const [newClientEmail, setNewClientEmail] = useState("")

  const handleSave = async () => {
    setSaving(true)
    const res = await fetch(`/api/plannings/${planning.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, targetAudience, goals, notes, clientId: clientId || null, status }),
    })
    if (res.ok) {
      onUpdate({ title, description, targetAudience, goals, notes, clientId: clientId || null, status } as Record<string, unknown>)
    }
    setSaving(false)
  }

  const addClient = async () => {
    if (!newClientName.trim()) return
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newClientName, email: newClientEmail }),
    })
    if (res.ok) {
      const client = await res.json()
      setClients((prev) => [...prev, client])
      setClientId(client.id)
      setNewClientName(""); setNewClientEmail(""); setShowNewClient(false)
    }
  }

  const deleteClient = async (id: string) => {
    await fetch(`/api/clients/${id}`, { method: "DELETE" })
    setClients((prev) => prev.filter((c) => c.id !== id))
    if (clientId === id) setClientId("")
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-medium">Título</label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Descripción</label>
        <RichEditor value={description} onChange={setDescription} placeholder="Descripción del proyecto..." />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Audiencia Objetivo</label>
        <RichEditor value={targetAudience} onChange={setTargetAudience} placeholder="¿A quién está dirigido este contenido?" />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Objetivos</label>
        <RichEditor value={goals} onChange={setGoals} placeholder="¿Qué querés lograr con este contenido?" />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Notas</label>
        <RichEditor value={notes} onChange={setNotes} placeholder="Notas adicionales..." />
      </div>

      <div className="flex gap-4">
        <div className="flex-1 space-y-2">
          <label className="text-sm font-medium">Estado</label>
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="DRAFT">Borrador</option>
            <option value="IN_PROGRESS">En Progreso</option>
            <option value="REVIEW">Revisión</option>
            <option value="APPROVED">Aprobado</option>
            <option value="PUBLISHED">Publicado</option>
          </select>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Users className="h-4 w-4" /> Clientes
          </h3>
          <Button size="sm" variant="outline" onClick={() => setShowNewClient(!showNewClient)}>
            <Plus className="h-3 w-3" /> Agregar
          </Button>
        </div>

        {showNewClient && (
          <div className="flex flex-col gap-2 sm:flex-row">
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
            <Button size="sm" onClick={addClient}>Crear</Button>
          </div>
        )}

        <div className="space-y-1">
          <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground">
            <span className="flex-1">Asignar a planificación:</span>
          </div>
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          >
            <option value="">Sin cliente</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {clients.length > 0 && (
          <div className="space-y-1">
            {clients.map((c) => (
              <div key={c.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <div className="flex-1">
                  <span className="font-medium">{c.name}</span>
                  {c.email && <span className="ml-2 text-muted-foreground">{c.email}</span>}
                </div>
                <button type="button" onClick={() => deleteClient(c.id)}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Button onClick={handleSave} disabled={saving}>
        <Save className="h-4 w-4" /> {saving ? "Guardando..." : "Guardar cambios"}
      </Button>
    </div>
  )
}

"use client"

import { useState, useRef } from "react"
import { Save, Plus, Trash2, Users, Camera, Pencil, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RichEditor } from "./RichEditor"
import { ClientLogo } from "@/components/ClientLogo"
import { compressAvatar } from "@/lib/compress-image"

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
  const [newClientLogo, setNewClientLogo] = useState<string | null>(null)
  const logoRef = useRef<HTMLInputElement>(null)
  // Fuerza a recargar el avatar servido por URL después de cambiarlo.
  const [logoVersions, setLogoVersions] = useState<Record<string, number>>({})

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
      body: JSON.stringify({ name: newClientName, email: newClientEmail, logo: newClientLogo }),
    })
    if (res.ok) {
      const client = await res.json()
      setClients((prev) => [...prev, client])
      setClientId(client.id)
      setNewClientName(""); setNewClientEmail(""); setNewClientLogo(null); setShowNewClient(false)
    }
  }

  const updateClientLogo = async (clientId: string, logo: string) => {
    const client = clients.find((c) => c.id === clientId)
    if (!client) return
    const res = await fetch(`/api/clients/${clientId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: client.name, email: client.email, logo }),
    })
    if (!res.ok) return
    setLogoVersions((prev) => ({ ...prev, [clientId]: Date.now() }))
  }

  const deleteClient = async (id: string) => {
    const client = clients.find((c) => c.id === id)
    if (!confirm(`¿Eliminar el cliente ${client?.name ?? ""}?`)) return
    await fetch(`/api/clients/${id}`, { method: "DELETE" })
    setClients((prev) => prev.filter((c) => c.id !== id))
    if (clientId === id) setClientId("")
  }

  // Editar nombre y correo de un cliente ya creado (ej.: agregarle el email
  // para que le lleguen los recibos de pago).
  const [editingClientId, setEditingClientId] = useState<string | null>(null)
  const [clientDraft, setClientDraft] = useState({ name: "", email: "" })
  const [savingClient, setSavingClient] = useState(false)

  const startClientEdit = (c: Client) => {
    setEditingClientId(c.id)
    setClientDraft({ name: c.name, email: c.email ?? "" })
  }

  const saveClientEdit = async () => {
    if (!editingClientId || !clientDraft.name.trim()) return
    setSavingClient(true)
    const res = await fetch(`/api/clients/${editingClientId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: clientDraft.name.trim(), email: clientDraft.email.trim() }),
    })
    setSavingClient(false)
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      toast.error(data?.error ?? "No se pudo actualizar el cliente")
      return
    }
    setClients((prev) =>
      prev.map((c) => (c.id === editingClientId ? { ...c, name: clientDraft.name.trim(), email: clientDraft.email.trim() } : c)),
    )
    setEditingClientId(null)
    toast.success("Cliente actualizado")
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-400">Título</label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-400">Descripción</label>
        <RichEditor value={description} onChange={setDescription} placeholder="Descripción del proyecto..." />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-400">Audiencia Objetivo</label>
        <RichEditor value={targetAudience} onChange={setTargetAudience} placeholder="¿A quién está dirigido este contenido?" />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-400">Objetivos</label>
        <RichEditor value={goals} onChange={setGoals} placeholder="¿Qué quieres lograr con este contenido?" />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-400">Notas</label>
        <RichEditor value={notes} onChange={setNotes} placeholder="Notas adicionales..." />
      </div>

      <div className="flex gap-4">
        <div className="flex-1 space-y-2">
          <label className="text-sm font-medium text-zinc-400">Estado</label>
          <select
            className="w-full rounded-md border border-white/10 bg-[#18181b] px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-600"
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

      <div className="space-y-3 rounded-lg border border-white/5 bg-[#0c0c0e] p-4">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
            <Users className="h-4 w-4" /> Clientes
          </h3>
          <Button size="sm" variant="outline" onClick={() => setShowNewClient(!showNewClient)}>
            <Plus className="h-3 w-3" /> Agregar
          </Button>
        </div>

        {showNewClient && (
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button type="button" onClick={() => logoRef.current?.click()} className="relative w-10 h-10 shrink-0 rounded-full border border-dashed border-white/10 flex items-center justify-center hover:bg-white/5 overflow-hidden">
                {newClientLogo ? <img src={newClientLogo} alt="" className="w-full h-full object-cover" /> : <Camera size={14} className="text-zinc-500" />}
              </button>
              <input
                ref={logoRef}
                type="file"
                accept="image/*"
                className="sr-only"
                aria-label="Logo del nuevo cliente"
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
              className="h-10 w-full sm:h-9 sm:min-w-[10rem] sm:flex-1"
            />
            <Input
              placeholder="Email (opcional)"
              value={newClientEmail}
              onChange={(e) => setNewClientEmail(e.target.value)}
              className="h-10 w-full sm:h-9 sm:min-w-[10rem] sm:flex-1"
            />
            <Button className="h-10 w-full sm:h-9 sm:w-auto" onClick={addClient}>Crear</Button>
          </div>
        )}

        <div className="space-y-1">
          <div className="flex items-center gap-2 rounded-md bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-zinc-400">
            <span className="flex-1">Asignar a planificación:</span>
          </div>
          <select
            className="w-full rounded-md border border-white/10 bg-[#18181b] px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-600"
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
            {clients.map((c) =>
              editingClientId === c.id ? (
                <div key={c.id} className="space-y-2 rounded-md border border-white/15 bg-white/[0.04] px-3 py-2.5">
                  <Input
                    value={clientDraft.name}
                    onChange={(e) => setClientDraft((d) => ({ ...d, name: e.target.value }))}
                    placeholder="Nombre del cliente"
                    aria-label="Nombre del cliente"
                    className="h-9"
                  />
                  <Input
                    value={clientDraft.email}
                    onChange={(e) => setClientDraft((d) => ({ ...d, email: e.target.value }))}
                    placeholder="Correo para recibir recibos (opcional)"
                    inputMode="email"
                    aria-label="Correo del cliente"
                    className="h-9"
                  />
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" className="h-8 text-zinc-400 hover:text-zinc-100" onClick={() => setEditingClientId(null)}>
                      <X className="mr-1 h-3 w-3" /> Cancelar
                    </Button>
                    <Button size="sm" className="h-8" onClick={saveClientEdit} disabled={savingClient || !clientDraft.name.trim()}>
                      <Save className="mr-1 h-3 w-3" /> {savingClient ? "Guardando..." : "Guardar"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div key={c.id} className="group flex items-center gap-2 rounded-md border border-white/5 px-3 py-2 text-sm">
                  <button type="button" onClick={() => document.getElementById(`logo-input-${c.id}`)?.click()} className="relative w-8 h-8 shrink-0 rounded-full overflow-hidden bg-white/5 hover:bg-white/10 flex items-center justify-center">
                    <ClientLogo clientId={c.id} name={c.name} size={32} version={logoVersions[c.id]} />
                  </button>
                  <input
                    id={`logo-input-${c.id}`}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    aria-label={`Cambiar el logo de ${c.name}`}
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      e.target.value = ""
                      if (file) updateClientLogo(c.id, await compressAvatar(file))
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-zinc-200 truncate">{c.name}</span>
                    {c.email ? (
                      <span className="ml-2 text-zinc-400 text-xs truncate">{c.email}</span>
                    ) : (
                      <span className="ml-2 text-xs text-amber-400/70">sin correo</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => startClientEdit(c)}
                    aria-label={`Editar el cliente ${c.name}`}
                    title="Editar nombre y correo"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-100"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteClient(c.id)}
                    aria-label={`Eliminar el cliente ${c.name}`}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-rose-500/10 hover:text-rose-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ),
            )}
          </div>
        )}
      </div>

      <Button className="h-10 w-full sm:w-auto" onClick={handleSave} disabled={saving}>
        <Save className="h-4 w-4" /> {saving ? "Guardando..." : "Guardar cambios"}
      </Button>
    </div>
  )
}

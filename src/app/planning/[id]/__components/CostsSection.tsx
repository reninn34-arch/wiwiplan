"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatMoney, parseAmountToCents } from "@/lib/payments"
import {
  costCategories,
  costCategoryHints,
  costCategoryLabels,
  isCostCategory,
  summarizeMargin,
  type CostCategory,
} from "@/lib/margin"

export interface PlanningCostRow {
  id: string
  label: string
  amountCents: number
  category: string
  /** Se le recobra al cliente: entra al valor del mes y sale en la factura. */
  billable: boolean
  order: number
}

export interface PlanningItemRowLike {
  id: string
  label: string
  amountCents: number
  order: number
}

interface Props {
  planningId: string
  /** Valor del mes: la otra mitad de la resta. Ya incluye lo recobrable. */
  valueCents: number
  costs: PlanningCostRow[]
  /**
   * El servidor recalcula valor y costo juntos —un costo recobrable mueve los
   * dos—, así que la respuesta trae ambos y la interfaz aplica todo de una.
   */
  onChange: (updates: {
    priceCents: number
    costCents: number
    items: PlanningItemRowLike[]
    costs: PlanningCostRow[]
  }) => void
}

const fieldClass =
  "h-9 w-full rounded-md border border-white/10 bg-[#18181b] px-3 text-sm text-zinc-200 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500 disabled:opacity-50"

export function CostsSection({ planningId, valueCents, costs, onChange }: Props) {
  const [formOpen, setFormOpen] = useState(false)
  const [label, setLabel] = useState("")
  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState<CostCategory>("TEAM")
  const [billable, setBillable] = useState(false)
  const [saving, setSaving] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState("")
  const [editAmount, setEditAmount] = useState("")
  const [editCategory, setEditCategory] = useState<CostCategory>("TEAM")

  const margin = useMemo(() => summarizeMargin(valueCents, costs), [valueCents, costs])

  const apply = (data: Parameters<typeof onChange>[0]) => onChange(data)

  const openForm = () => {
    setLabel("")
    setAmount("")
    setCategory("TEAM")
    setBillable(false)
    setFormOpen(true)
  }

  /** Marcar o desmarcar recobrable mueve el valor del mes: se guarda al toque. */
  const toggleBillable = async (cost: PlanningCostRow) => {
    const res = await fetch(`/api/plannings/${planningId}/costs/${cost.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ billable: !cost.billable }),
    })
    if (!res.ok) {
      toast.error("No se pudo cambiar el costo")
      return
    }
    apply(await res.json())
    toast.success(
      cost.billable
        ? "Ya no se le recobra: sale de la factura y del valor del mes"
        : "Se le recobra al cliente: entra al valor del mes y sale en la factura",
    )
  }

  const addCost = async () => {
    const cents = parseAmountToCents(amount)
    if (cents === null || cents <= 0) {
      toast.error("Escribe un monto, por ejemplo 250")
      return
    }
    setSaving(true)
    const res = await fetch(`/api/plannings/${planningId}/costs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: label.trim(), amountCents: cents, category, billable }),
    })
    setSaving(false)
    if (!res.ok) {
      toast.error("No se pudo agregar el costo")
      return
    }
    apply(await res.json())
    setFormOpen(false)
    setLabel("")
    setAmount("")
  }

  const startEdit = (cost: PlanningCostRow) => {
    setEditingId(cost.id)
    setEditLabel(cost.label)
    setEditAmount((cost.amountCents / 100).toFixed(2))
    setEditCategory(isCostCategory(cost.category) ? cost.category : "OTHER")
  }

  const saveEdit = async () => {
    if (!editingId) return
    const cents = parseAmountToCents(editAmount)
    if (cents === null || cents <= 0) {
      toast.error("Escribe un monto válido")
      return
    }
    setSaving(true)
    const res = await fetch(`/api/plannings/${planningId}/costs/${editingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: editLabel.trim(), amountCents: cents, category: editCategory }),
    })
    setSaving(false)
    if (!res.ok) {
      toast.error("No se pudo guardar el costo")
      return
    }
    apply(await res.json())
    setEditingId(null)
  }

  const removeCost = async (cost: PlanningCostRow) => {
    if (!confirm(`¿Quitar "${cost.label || "este costo"}" del mes?`)) return
    const res = await fetch(`/api/plannings/${planningId}/costs/${cost.id}`, { method: "DELETE" })
    if (!res.ok) {
      toast.error("No se pudo quitar el costo")
      return
    }
    apply(await res.json())
  }

  const billableTotal = costs.reduce((sum, c) => sum + (c.billable ? c.amountCents : 0), 0)
  const positive = margin.marginCents >= 0
  const usedCategories = costCategories.filter((c) => margin.byCategory[c] > 0)

  return (
    <section className="rounded-xl border border-white/5 bg-[#0c0c0e] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight text-zinc-200">Costos y margen</h2>
        {costs.length > 0 && !formOpen && (
          <button
            type="button"
            onClick={openForm}
            className="inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-xs text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500"
          >
            <Plus className="h-3.5 w-3.5" /> Agregar costo
          </button>
        )}
      </div>

      {costs.length === 0 && !formOpen ? (
        <div className="flex flex-col items-start gap-3 py-2">
          <p className="mt-2 max-w-md text-sm text-zinc-400">
            Carga lo que te costó producir el mes —el editor, la pauta, el fotógrafo, la música— y vas
            a ver cuánto queda del valor después de pagar todo. Eso es lo que decide si subes la
            tarifa o sueltas la cuenta.
          </p>
          <Button size="sm" onClick={openForm}>
            Cargar el primer costo
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span
              className={`text-3xl font-semibold tabular-nums tracking-tight ${
                positive ? "text-white" : "text-red-300"
              }`}
            >
              {formatMoney(margin.marginCents)}
            </span>
            <span className="text-sm text-zinc-400">
              de margen
              {margin.marginPercent !== null && (
                <>
                  {" "}
                  <span className={positive ? "text-emerald-300" : "text-red-300"}>
                    ({margin.marginPercent}%)
                  </span>
                </>
              )}
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500 tabular-nums">
            Valor {formatMoney(margin.valueCents)} − costos {formatMoney(margin.costCents)}
          </p>
          {billableTotal > 0 && (
            <p className="mt-1 text-xs text-zinc-500">
              De esos costos, <span className="tabular-nums text-sky-300">{formatMoney(billableTotal)}</span>{" "}
              se le recobran al cliente y ya están sumados al valor.
            </p>
          )}
          {!positive && (
            <p className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300 ring-1 ring-inset ring-red-400/25">
              Este mes cuesta más de lo que vale.
            </p>
          )}

          {usedCategories.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {usedCategories.map((c) => (
                <span
                  key={c}
                  className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] tabular-nums text-zinc-300"
                >
                  {costCategoryLabels[c]} {formatMoney(margin.byCategory[c])}
                </span>
              ))}
            </div>
          )}
        </>
      )}

      {costs.length > 0 && (
        <ul className="mt-4 divide-y divide-white/5 border-t border-white/5 pt-2">
          {costs.map((cost) => (
            <li key={cost.id} className="py-2">
              {editingId === cost.id ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    placeholder="Concepto"
                    aria-label="Concepto del costo"
                    className="h-9 min-w-0 flex-1 border-white/10 bg-[#18181b] text-zinc-100"
                  />
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value as CostCategory)}
                    aria-label="Categoría del costo"
                    className={`${fieldClass} w-36`}
                  >
                    {costCategories.map((c) => (
                      <option key={c} value={c}>
                        {costCategoryLabels[c]}
                      </option>
                    ))}
                  </select>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400">
                      $
                    </span>
                    <Input
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit()
                        if (e.key === "Escape") setEditingId(null)
                      }}
                      inputMode="decimal"
                      autoFocus
                      aria-label="Monto del costo"
                      className="h-9 w-28 border-white/10 bg-[#18181b] pl-7 tabular-nums text-zinc-100"
                    />
                  </div>
                  <Button size="sm" onClick={saveEdit} disabled={saving}>
                    {saving ? "Guardando..." : "Guardar"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-zinc-400 hover:text-zinc-100"
                    onClick={() => setEditingId(null)}
                  >
                    Cancelar
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm text-zinc-300">
                    {cost.label || "Sin concepto"}
                    <span className="ml-2 text-xs text-zinc-500">
                      {costCategoryLabels[
                        isCostCategory(cost.category) ? cost.category : "OTHER"
                      ]}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleBillable(cost)}
                    aria-pressed={cost.billable}
                    title={
                      cost.billable
                        ? "Se le recobra al cliente: sale en la factura. Tócalo para dejar de recobrarlo."
                        : "No sale en la factura. Tócalo para recobrárselo al cliente."
                    }
                    className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-medium transition-colors ${
                      cost.billable
                        ? "bg-sky-500/15 text-sky-300 ring-1 ring-inset ring-sky-400/30"
                        : "text-zinc-600 hover:bg-white/5 hover:text-zinc-400"
                    }`}
                  >
                    {cost.billable ? "En la factura" : "Solo tuyo"}
                  </button>
                  <span className="shrink-0 text-sm tabular-nums text-zinc-200">
                    − {formatMoney(cost.amountCents)}
                  </span>
                  <button
                    type="button"
                    onClick={() => startEdit(cost)}
                    aria-label={`Editar ${cost.label || "costo"}`}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeCost(cost)}
                    aria-label={`Quitar ${cost.label || "costo"}`}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white/5 hover:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {formOpen && (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Concepto (ej.: Edición, Pauta de agosto)"
              aria-label="Concepto del costo nuevo"
              className="h-9 min-w-0 flex-1 border-white/10 bg-[#18181b] text-zinc-100"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as CostCategory)}
              aria-label="Categoría del costo nuevo"
              className={`${fieldClass} w-36`}
            >
              {costCategories.map((c) => (
                <option key={c} value={c}>
                  {costCategoryLabels[c]}
                </option>
              ))}
            </select>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400">
                $
              </span>
              <Input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addCost()
                  if (e.key === "Escape") setFormOpen(false)
                }}
                inputMode="decimal"
                placeholder="250.00"
                autoFocus
                aria-label="Monto del costo nuevo"
                className="h-9 w-28 border-white/10 bg-[#18181b] pl-7 tabular-nums text-zinc-100"
              />
            </div>
            <Button size="sm" onClick={addCost} disabled={saving}>
              {saving ? "Guardando..." : "Agregar"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-zinc-400 hover:text-zinc-100"
              onClick={() => setFormOpen(false)}
            >
              Cancelar
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setBillable(!billable)}
              aria-pressed={billable}
              className={`rounded-full px-2.5 py-1.5 text-xs transition-colors ${
                billable
                  ? "bg-sky-500/15 text-sky-300 ring-1 ring-inset ring-sky-400/30"
                  : "text-zinc-500 ring-1 ring-inset ring-white/10 hover:text-zinc-300"
              }`}
            >
              {billable ? "✓ Se le recobra al cliente" : "Se le recobra al cliente"}
            </button>
            <p className="text-xs text-zinc-500">
              {billable
                ? "Entra al valor del mes y sale en la factura como línea propia."
                : costCategoryHints[category]}
            </p>
          </div>
        </div>
      )}

      <p className="mt-3 text-xs text-zinc-500">
        Marca <span className="text-sky-300">En la factura</span> lo que le recobras al cliente —la
        pauta, típicamente—: suma al valor del mes y aparece en el recibo. Entra y sale, así que el
        margen no se mueve. Lo demás no sale nunca del lado del cliente.
      </p>
    </section>
  )
}

"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { CheckCheck, Pencil, Plus, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PaymentAccountHeader, type PaymentRecord } from "@/components/payments/PaymentStatus"
import {
  formatMoney,
  formatPaymentDate,
  parseAmountToCents,
  paymentMethodLabels,
  paymentMethods,
  summarizePayments,
} from "@/lib/payments"

interface Props {
  planningId: string
  priceCents: number
  payments: PaymentRecord[]
  onChange: (updates: { priceCents?: number; payments?: PaymentRecord[] }) => void
}

function todayInputValue() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

function dateInputValue(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return todayInputValue()
  const offset = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - offset).toISOString().slice(0, 10)
}

function byDate(a: PaymentRecord, b: PaymentRecord) {
  return new Date(a.paidAt).getTime() - new Date(b.paidAt).getTime()
}

const fieldClass =
  "h-9 w-full rounded-md border border-white/10 bg-[#18181b] px-3 text-sm text-zinc-200 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500 disabled:opacity-50"

export function PaymentsTab({ planningId, priceCents, payments, onChange }: Props) {
  const [editingPrice, setEditingPrice] = useState(false)
  const [priceDraft, setPriceDraft] = useState("")
  const [savingPrice, setSavingPrice] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [amount, setAmount] = useState("")
  const [paidAt, setPaidAt] = useState(todayInputValue())
  const [method, setMethod] = useState("TRANSFER")
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState("")
  const [editPaidAt, setEditPaidAt] = useState("")
  const [editMethod, setEditMethod] = useState("TRANSFER")
  const [editNote, setEditNote] = useState("")
  const [savingEdit, setSavingEdit] = useState(false)

  const summary = useMemo(() => summarizePayments(priceCents, payments), [priceCents, payments])

  const openPriceEditor = () => {
    setPriceDraft(priceCents > 0 ? (priceCents / 100).toFixed(2) : "")
    setEditingPrice(true)
  }

  const savePrice = async () => {
    const cents = parseAmountToCents(priceDraft)
    if (cents === null || cents < 0) {
      toast.error("Escribí un precio válido, por ejemplo 1200")
      return
    }
    setSavingPrice(true)
    const res = await fetch(`/api/plannings/${planningId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceCents: cents }),
    })
    setSavingPrice(false)
    if (!res.ok) {
      toast.error("No se pudo guardar el precio")
      return
    }
    onChange({ priceCents: cents })
    setEditingPrice(false)
    toast.success(`Precio del plan: ${formatMoney(cents)}`)
  }

  const openForm = (prefillCents?: number) => {
    setAmount(prefillCents && prefillCents > 0 ? (prefillCents / 100).toFixed(2) : "")
    setPaidAt(todayInputValue())
    setMethod("TRANSFER")
    setNote("")
    setFormOpen(true)
  }

  const registerPayment = async () => {
    const cents = parseAmountToCents(amount)
    if (cents === null || cents <= 0) {
      toast.error("El monto tiene que ser mayor a cero")
      return
    }
    setSaving(true)
    const res = await fetch(`/api/plannings/${planningId}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amountCents: cents,
        method,
        note: note.trim(),
        paidAt: new Date(`${paidAt}T12:00:00`).toISOString(),
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? "No se pudo registrar el cobro")
      return
    }
    const created = (await res.json()) as PaymentRecord
    const next = [...payments, created].sort(byDate)
    onChange({ payments: next })
    setFormOpen(false)

    const after = summarizePayments(priceCents, next)
    toast.success(
      priceCents > 0 && after.dueCents === 0
        ? `${formatMoney(cents)} cobrado. El plan queda saldado.`
        : priceCents > 0
          ? `${formatMoney(cents)} cobrado. Quedan ${formatMoney(after.dueCents)}.`
          : `${formatMoney(cents)} cobrado.`,
    )
  }

  const startEdit = (payment: PaymentRecord) => {
    setEditingId(payment.id)
    setEditAmount((payment.amountCents / 100).toFixed(2))
    setEditPaidAt(dateInputValue(payment.paidAt))
    setEditMethod(payment.method)
    setEditNote(payment.note)
  }

  const saveEdit = async (paymentId: string) => {
    const cents = parseAmountToCents(editAmount)
    if (cents === null || cents <= 0) {
      toast.error("El monto tiene que ser mayor a cero")
      return
    }
    setSavingEdit(true)
    const res = await fetch(`/api/plannings/${planningId}/payments/${paymentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amountCents: cents,
        method: editMethod,
        note: editNote.trim(),
        paidAt: new Date(`${editPaidAt}T12:00:00`).toISOString(),
      }),
    })
    setSavingEdit(false)
    if (!res.ok) {
      toast.error("No se pudo actualizar el cobro")
      return
    }
    const updated = (await res.json()) as PaymentRecord
    onChange({ payments: payments.map((p) => (p.id === paymentId ? updated : p)).sort(byDate) })
    setEditingId(null)
  }

  const removePayment = async (payment: PaymentRecord) => {
    if (!confirm(`¿Borrar el cobro de ${formatMoney(payment.amountCents)}?`)) return
    const res = await fetch(`/api/plannings/${planningId}/payments/${payment.id}`, {
      method: "DELETE",
    })
    if (!res.ok) {
      toast.error("No se pudo borrar el cobro")
      return
    }
    onChange({ payments: payments.filter((p) => p.id !== payment.id) })
    toast.success("Cobro eliminado")
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-white/5 bg-[#0c0c0e] p-5">
        {editingPrice ? (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold tracking-tight text-zinc-200">Precio acordado</h2>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400">
                  $
                </span>
                <Input
                  value={priceDraft}
                  onChange={(e) => setPriceDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") savePrice()
                    if (e.key === "Escape") setEditingPrice(false)
                  }}
                  inputMode="decimal"
                  placeholder="1200.00"
                  autoFocus
                  aria-label="Precio acordado del plan"
                  className="h-9 w-36 border-white/10 bg-[#18181b] pl-7 tabular-nums text-zinc-100"
                />
              </div>
              <Button size="sm" onClick={savePrice} disabled={savingPrice}>
                {savingPrice ? "Guardando..." : "Guardar"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-zinc-400 hover:text-zinc-100"
                onClick={() => setEditingPrice(false)}
              >
                Cancelar
              </Button>
            </div>
            <p className="text-xs text-zinc-400">Los montos van en dólares (USD).</p>
          </div>
        ) : summary.state === "UNPRICED" ? (
          <div className="flex flex-col items-start gap-3 py-2">
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-zinc-100">
                Poné el precio de este plan
              </h2>
              <p className="mt-1 max-w-md text-sm text-zinc-400">
                Con el precio cargado registrás cada cobro, ves el saldo al instante y el cliente
                puede seguir cuánto lleva pagado desde el enlace que le compartís.
              </p>
            </div>
            <Button size="sm" onClick={openPriceEditor}>
              Definir precio
            </Button>
          </div>
        ) : (
          <PaymentAccountHeader
            summary={summary}
            payments={payments}
            action={
              <button
                type="button"
                onClick={openPriceEditor}
                className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500"
              >
                <Pencil className="h-3 w-3" /> Precio
              </button>
            }
          />
        )}
      </section>

      <section className="rounded-xl border border-white/5 bg-[#0c0c0e]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 px-5 py-3">
          <h2 className="text-sm font-semibold tracking-tight text-zinc-200">Cobros recibidos</h2>
          <div className="flex items-center gap-2">
            {summary.dueCents > 0 && payments.length > 0 && !formOpen && (
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 text-emerald-300 hover:bg-emerald-500/10 hover:text-emerald-200"
                onClick={() => openForm(summary.dueCents)}
              >
                <CheckCheck className="h-3.5 w-3.5" /> Saldar {formatMoney(summary.dueCents)}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => openForm()}
              disabled={formOpen}
            >
              <Plus className="h-3.5 w-3.5" /> Registrar cobro
            </Button>
          </div>
        </div>

        {formOpen && (
          <div className="border-b border-white/5 bg-white/[0.02] px-5 py-4">
            <div className="grid gap-2 sm:grid-cols-[9rem_10rem_1fr]">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400">
                  $
                </span>
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && registerPayment()}
                  inputMode="decimal"
                  placeholder="0.00"
                  autoFocus
                  aria-label="Monto cobrado"
                  className={`${fieldClass} pl-7 tabular-nums`}
                />
              </div>
              <input
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
                aria-label="Fecha del cobro"
                className={`${fieldClass} [color-scheme:dark]`}
              />
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                aria-label="Medio de pago"
                className={fieldClass}
              >
                {paymentMethods.map((m) => (
                  <option key={m} value={m}>
                    {paymentMethodLabels[m]}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && registerPayment()}
                placeholder="Nota (seña, primera cuota, etc.)"
                aria-label="Nota del cobro"
                className={`${fieldClass} min-w-[12rem] flex-1`}
              />
              <Button size="sm" onClick={registerPayment} disabled={saving}>
                {saving ? "Registrando..." : "Registrar"}
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

            {summary.dueCents > 0 && (
              <p className="mt-2 text-xs text-zinc-400">
                Saldo actual{" "}
                <button
                  type="button"
                  onClick={() => setAmount((summary.dueCents / 100).toFixed(2))}
                  className="-my-1 rounded px-0.5 py-1 font-medium tabular-nums text-amber-300 underline decoration-amber-300/30 underline-offset-4 transition-colors hover:decoration-amber-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-300/50"
                >
                  {formatMoney(summary.dueCents)}
                </button>
                . Tocalo para completar el monto.
              </p>
            )}
          </div>
        )}

        {payments.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-zinc-300">Todavía no registraste ningún cobro</p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-zinc-400">
              Cargá cada pago que vayas recibiendo, de una vez o en cuotas. El cliente ve el avance
              en el enlace compartido.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {payments.map((payment) => (
              <li key={payment.id} className="group px-5 py-3">
                {editingId === payment.id ? (
                  <div className="space-y-2">
                    <div className="grid gap-2 sm:grid-cols-[9rem_10rem_1fr]">
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400">
                          $
                        </span>
                        <input
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          inputMode="decimal"
                          autoFocus
                          aria-label="Monto cobrado"
                          className={`${fieldClass} pl-7 tabular-nums`}
                        />
                      </div>
                      <input
                        type="date"
                        value={editPaidAt}
                        onChange={(e) => setEditPaidAt(e.target.value)}
                        aria-label="Fecha del cobro"
                        className={`${fieldClass} [color-scheme:dark]`}
                      />
                      <select
                        value={editMethod}
                        onChange={(e) => setEditMethod(e.target.value)}
                        aria-label="Medio de pago"
                        className={fieldClass}
                      >
                        {paymentMethods.map((m) => (
                          <option key={m} value={m}>
                            {paymentMethodLabels[m]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        value={editNote}
                        onChange={(e) => setEditNote(e.target.value)}
                        placeholder="Nota"
                        aria-label="Nota del cobro"
                        className={`${fieldClass} min-w-[12rem] flex-1`}
                      />
                      <Button size="sm" onClick={() => saveEdit(payment.id)} disabled={savingEdit}>
                        {savingEdit ? "Guardando..." : "Guardar"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-zinc-400 hover:text-zinc-100"
                        onClick={() => setEditingId(null)}
                        aria-label="Cancelar edición"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                    <div className="min-w-0">
                      <p className="text-sm text-zinc-200">
                        {formatPaymentDate(payment.paidAt)}
                        <span className="text-zinc-400">
                          {" · "}
                          {paymentMethodLabels[payment.method] ?? payment.method}
                        </span>
                      </p>
                      {payment.note && (
                        <p className="truncate text-xs text-zinc-400">{payment.note}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-medium tabular-nums text-emerald-300">
                        + {formatMoney(payment.amountCents)}
                      </span>
                      <button
                        type="button"
                        onClick={() => startEdit(payment)}
                        aria-label={`Editar el cobro de ${formatMoney(payment.amountCents)}`}
                        className="ml-2 flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 opacity-0 transition-all hover:bg-white/5 hover:text-zinc-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500 group-hover:opacity-100 max-sm:opacity-100"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removePayment(payment)}
                        aria-label={`Borrar el cobro de ${formatMoney(payment.amountCents)}`}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 opacity-0 transition-all hover:bg-red-500/10 hover:text-red-300 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500 group-hover:opacity-100 max-sm:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

"use client"

import { useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { CheckCheck, FileText, Mail, Pencil, Plus, Printer, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PaymentAccountHeader, type PaymentRecord } from "@/components/payments/PaymentStatus"
import {
  formatMoney,
  formatPaymentDate,
  isPaymentKind,
  parseAmountToCents,
  paymentKindHints,
  paymentKindLabels,
  paymentKinds,
  paymentMethodLabels,
  paymentMethods,
  summarizePayments,
  type PaymentKind,
} from "@/lib/payments"
import { buildReceiptHtml, receiptLines, receiptNumberFromId } from "@/lib/receipt"
import { CostsSection, type PlanningCostRow } from "./CostsSection"

export interface PlanningItemRow {
  id: string
  label: string
  amountCents: number
  order: number
}

interface Props {
  planningId: string
  priceCents: number
  /** Líneas que componen el valor del mes. `priceCents` es su suma. */
  items: PlanningItemRow[]
  /** Lo que costó producir el mes: la otra mitad del dinero. */
  costs: PlanningCostRow[]
  payments: PaymentRecord[]
  installments: Array<{ id: string; label: string; amountCents: number; dueDate: string }>
  onChange: (updates: { priceCents?: number; items?: PlanningItemRow[]; costCents?: number; costs?: PlanningCostRow[]; payments?: PaymentRecord[]; installments?: Array<{ id: string; label: string; amountCents: number; dueDate: string }> }) => void
  client: { name: string; email: string } | null
  periodLabel: string
  planTitle?: string
  businessName?: string
  businessEmail?: string | null
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

/** Una retención o un ajuste cierran saldo, pero no son plata que entró. */
function isCashEntry(record: PaymentRecord) {
  return record.kind !== "WITHHOLDING" && record.kind !== "ADJUSTMENT"
}

function byDate(a: PaymentRecord, b: PaymentRecord) {
  return new Date(a.paidAt).getTime() - new Date(b.paidAt).getTime()
}

const fieldClass =
  "h-9 w-full rounded-md border border-white/10 bg-[#18181b] px-3 text-sm text-zinc-200 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500 disabled:opacity-50"

export function PaymentsTab({
  planningId,
  priceCents,
  items,
  costs,
  payments,
  installments,
  onChange,
  client,
  periodLabel,
  planTitle,
  businessName,
  businessEmail,
}: Props) {
  // Valor del mes: se edita línea por línea, nunca como un total suelto.
  const [itemFormOpen, setItemFormOpen] = useState(false)
  const [itemLabel, setItemLabel] = useState("")
  const [itemAmount, setItemAmount] = useState("")
  const [savingItem, setSavingItem] = useState(false)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editItemLabel, setEditItemLabel] = useState("")
  const [editItemAmount, setEditItemAmount] = useState("")

  const [formOpen, setFormOpen] = useState(false)
  const [amount, setAmount] = useState("")
  const [paidAt, setPaidAt] = useState(todayInputValue())
  const [method, setMethod] = useState("TRANSFER")
  // Naturaleza del movimiento: no todo lo que cierra saldo es plata que entró.
  const [kind, setKind] = useState<PaymentKind>("PAYMENT")
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState("")
  const [editPaidAt, setEditPaidAt] = useState("")
  const [editMethod, setEditMethod] = useState("TRANSFER")
  const [editNote, setEditNote] = useState("")
  const [savingEdit, setSavingEdit] = useState(false)

  // Recibo: vista previa editable antes de mandar el email.
  const [receiptFor, setReceiptFor] = useState<PaymentRecord | null>(null)
  const [receiptTo, setReceiptTo] = useState("")
  const [receiptDetail, setReceiptDetail] = useState("")
  const [sendingReceipt, setSendingReceipt] = useState(false)
  const receiptFrameRef = useRef<HTMLIFrameElement>(null)

  // Fechas de cobro: cuotas esperadas que alimentan el recordatorio automático.
  const [instFormOpen, setInstFormOpen] = useState(false)
  const [instLabel, setInstLabel] = useState("")
  const [instDate, setInstDate] = useState(todayInputValue())
  const [instAmount, setInstAmount] = useState("")
  const [savingInst, setSavingInst] = useState(false)

  const summary = useMemo(() => summarizePayments(priceCents, payments), [priceCents, payments])

  /** El preview usa el estado local; el server recalcula con la base al enviar. */
  const receiptHtml = useMemo(() => {
    if (!receiptFor) return ""
    return buildReceiptHtml({
      businessName: businessName ?? "Recibos",
      businessEmail: businessEmail ?? null,
      clientName: client?.name ?? "Cliente",
      periodLabel,
      planTitle: planTitle ?? "",
      receiptNumber: receiptNumberFromId(receiptFor.id),
      priceCents,
      items: receiptLines(items, costs),
      paidCents: payments.reduce((sum, p) => sum + p.amountCents, 0),
      dueCents: Math.max(0, priceCents - payments.reduce((sum, p) => sum + p.amountCents, 0)),
      payment: {
        dateLabel: formatPaymentDate(receiptFor.paidAt),
        amountCents: receiptFor.amountCents,
        methodLabel: paymentMethodLabels[receiptFor.method] ?? receiptFor.method,
        note: receiptFor.note,
      },
      detail: receiptDetail,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receiptFor, receiptDetail, items, costs, priceCents])

  const openReceipt = (payment: PaymentRecord) => {
    setReceiptFor(payment)
    setReceiptDetail(payment.note)
    setReceiptTo(client?.email ?? "")
    setSendingReceipt(false)
  }

  const sendReceipt = async () => {
    if (!receiptFor) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(receiptTo.trim())) {
      toast.error("Escribe un email de destino válido")
      return
    }
    setSendingReceipt(true)
    const res = await fetch(`/api/plannings/${planningId}/receipts/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId: receiptFor.id, to: receiptTo.trim(), detail: receiptDetail }),
    })
    setSendingReceipt(false)
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      toast.error(data?.error ?? "No se pudo enviar el recibo")
      return
    }
    toast.success(`Recibo enviado a ${receiptTo.trim()}`)
    setReceiptFor(null)
  }

  const printReceipt = () => {
    const frame = receiptFrameRef.current
    if (!frame?.contentWindow) return
    frame.contentWindow.focus()
    frame.contentWindow.print()
  }

  // ── Fechas de cobro ──
  const sortedInstallments = [...installments].sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
  )
  const paidCentsTotal = payments.reduce((sum, p) => sum + p.amountCents, 0)
  const todayIso = todayInputValue()

  const addInstallment = async () => {
    const cents = parseAmountToCents(instAmount)
    if (cents === null || cents <= 0) {
      toast.error("El monto de la cuota tiene que ser mayor a cero")
      return
    }
    setSavingInst(true)
    const res = await fetch(`/api/plannings/${planningId}/installments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: instLabel.trim(), amountCents: cents, dueDate: instDate }),
    })
    setSavingInst(false)
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      toast.error(data?.error ?? "No se pudo agregar la fecha de cobro")
      return
    }
    const created = await res.json()
    onChange({
      installments: [...installments, created].sort(
        (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
      ),
    })
    setInstFormOpen(false)
    setInstLabel("")
    setInstAmount("")
  }

  const removeInstallment = async (installmentId: string) => {
    const res = await fetch(`/api/plannings/${planningId}/installments/${installmentId}`, {
      method: "DELETE",
    })
    if (!res.ok) {
      toast.error("No se pudo quitar la fecha de cobro")
      return
    }
    onChange({ installments: installments.filter((i) => i.id !== installmentId) })
  }

  /** El servidor devuelve el total recalculado: la interfaz no lo suma sola. */
  const applyItems = (data: { priceCents: number; items: PlanningItemRow[] }) => {
    onChange({ priceCents: data.priceCents, items: data.items })
  }

  const openItemForm = () => {
    setItemLabel("")
    setItemAmount("")
    setItemFormOpen(true)
  }

  const addItem = async () => {
    const cents = parseAmountToCents(itemAmount)
    if (cents === null || cents === 0) {
      toast.error("Escribe un monto, por ejemplo 600")
      return
    }
    setSavingItem(true)
    const res = await fetch(`/api/plannings/${planningId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: itemLabel.trim(), amountCents: cents }),
    })
    setSavingItem(false)
    if (!res.ok) {
      toast.error("No se pudo agregar la línea")
      return
    }
    applyItems(await res.json())
    setItemFormOpen(false)
    setItemLabel("")
    setItemAmount("")
  }

  const startEditItem = (item: PlanningItemRow) => {
    setEditingItemId(item.id)
    setEditItemLabel(item.label)
    setEditItemAmount((item.amountCents / 100).toFixed(2))
  }

  const saveItem = async () => {
    if (!editingItemId) return
    const cents = parseAmountToCents(editItemAmount)
    if (cents === null || cents === 0) {
      toast.error("Escribe un monto válido")
      return
    }
    setSavingItem(true)
    const res = await fetch(`/api/plannings/${planningId}/items/${editingItemId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: editItemLabel.trim(), amountCents: cents }),
    })
    setSavingItem(false)
    if (!res.ok) {
      toast.error("No se pudo guardar la línea")
      return
    }
    applyItems(await res.json())
    setEditingItemId(null)
  }

  const removeItem = async (item: PlanningItemRow) => {
    if (!confirm(`¿Quitar "${item.label || "esta línea"}" del valor del mes?`)) return
    const res = await fetch(`/api/plannings/${planningId}/items/${item.id}`, { method: "DELETE" })
    if (!res.ok) {
      toast.error("No se pudo quitar la línea")
      return
    }
    applyItems(await res.json())
  }

  const openForm = (prefillCents?: number) => {
    setAmount(prefillCents && prefillCents > 0 ? (prefillCents / 100).toFixed(2) : "")
    setPaidAt(todayInputValue())
    setMethod("TRANSFER")
    setKind("PAYMENT")
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
        kind,
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
    const verb = kind === "PAYMENT" ? "cobrado" : `registrado como ${paymentKindLabels[kind].toLowerCase()}`
    toast.success(
      priceCents > 0 && after.dueCents === 0
        ? `${formatMoney(cents)} ${verb}. El mes queda saldado.`
        : priceCents > 0
          ? `${formatMoney(cents)} ${verb}. Quedan ${formatMoney(after.dueCents)}.`
          : `${formatMoney(cents)} ${verb}.`,
    )

    // El recibo se ofrece apenas registrado: lo revisas antes de mandar nada.
    openReceipt(created)
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
        {summary.state === "UNPRICED" && items.length === 0 ? (
          <div className="flex flex-col items-start gap-3 py-2">
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-zinc-100">
                Pon el valor de este mes
              </h2>
              <p className="mt-1 max-w-md text-sm text-zinc-400">
                Cárgalo línea por línea —el plan y los extras que se acordaron— y así en tres meses
                vas a saber de dónde salió el total. Con el valor puesto registras cada cobro, ves el
                saldo al instante y el cliente lo sigue desde el enlace que le compartes.
              </p>
            </div>
            <Button size="sm" onClick={openItemForm}>
              Definir valor del mes
            </Button>
          </div>
        ) : (
          <PaymentAccountHeader summary={summary} payments={payments} />
        )}

        {items.length > 0 && (
          <div className="mt-4 border-t border-white/5 pt-4">
            <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              Valor del mes
            </h3>
            <ul className="divide-y divide-white/5">
              {items.map((item) => (
                <li key={item.id} className="py-2">
                  {editingItemId === item.id ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        value={editItemLabel}
                        onChange={(e) => setEditItemLabel(e.target.value)}
                        placeholder="Concepto"
                        aria-label="Concepto de la línea"
                        className="h-9 min-w-0 flex-1 border-white/10 bg-[#18181b] text-zinc-100"
                      />
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400">$</span>
                        <Input
                          value={editItemAmount}
                          onChange={(e) => setEditItemAmount(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveItem()
                            if (e.key === "Escape") setEditingItemId(null)
                          }}
                          inputMode="decimal"
                          autoFocus
                          aria-label="Monto de la línea"
                          className="h-9 w-28 border-white/10 bg-[#18181b] pl-7 tabular-nums text-zinc-100"
                        />
                      </div>
                      <Button size="sm" onClick={saveItem} disabled={savingItem}>
                        {savingItem ? "Guardando..." : "Guardar"}
                      </Button>
                      <Button size="sm" variant="ghost" className="text-zinc-400 hover:text-zinc-100" onClick={() => setEditingItemId(null)}>
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm text-zinc-300">
                        {item.label || "Sin concepto"}
                      </span>
                      <span className="shrink-0 text-sm tabular-nums text-zinc-200">
                        {formatMoney(item.amountCents)}
                      </span>
                      <button
                        type="button"
                        onClick={() => startEditItem(item)}
                        aria-label={`Editar ${item.label || "línea"}`}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeItem(item)}
                        aria-label={`Quitar ${item.label || "línea"}`}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white/5 hover:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {items.length > 1 && (
              <div className="flex items-center justify-between border-t border-white/10 pt-2 text-sm">
                <span className="text-zinc-400">Total</span>
                <span className="font-semibold tabular-nums text-zinc-100">{formatMoney(priceCents)}</span>
              </div>
            )}
          </div>
        )}

        {itemFormOpen ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Input
              value={itemLabel}
              onChange={(e) => setItemLabel(e.target.value)}
              placeholder="Concepto (ej.: Plan mensual, Sesión de fotos)"
              aria-label="Concepto de la línea nueva"
              className="h-9 min-w-0 flex-1 border-white/10 bg-[#18181b] text-zinc-100"
            />
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400">$</span>
              <Input
                value={itemAmount}
                onChange={(e) => setItemAmount(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addItem()
                  if (e.key === "Escape") setItemFormOpen(false)
                }}
                inputMode="decimal"
                placeholder="600.00"
                autoFocus
                aria-label="Monto de la línea nueva"
                className="h-9 w-28 border-white/10 bg-[#18181b] pl-7 tabular-nums text-zinc-100"
              />
            </div>
            <Button size="sm" onClick={addItem} disabled={savingItem}>
              {savingItem ? "Guardando..." : "Agregar"}
            </Button>
            <Button size="sm" variant="ghost" className="text-zinc-400 hover:text-zinc-100" onClick={() => setItemFormOpen(false)}>
              Cancelar
            </Button>
          </div>
        ) : (
          items.length > 0 && (
            <button
              type="button"
              onClick={openItemForm}
              className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-xs text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500"
            >
              <Plus className="h-3.5 w-3.5" /> Agregar línea
            </button>
          )
        )}
        <p className="mt-3 text-xs text-zinc-500">
          Los montos van en dólares (USD). Un descuento se carga como línea en negativo.
        </p>
      </section>

      <CostsSection
        planningId={planningId}
        valueCents={priceCents}
        costs={costs}
        onChange={onChange}
      />

      {/* Fechas de cobro: cuotas esperadas que disparan el recordatorio automático */}
      <section className="rounded-xl border border-white/5 bg-[#0c0c0e]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold tracking-tight text-zinc-200">Fechas de cobro</h2>
            <p className="mt-0.5 max-w-md text-xs text-zinc-500">
              Cuotas esperadas del plan. Cuando una queda vencida con saldo, el cliente recibe un
              recordatorio automático (máximo uno cada 3 días).
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setInstFormOpen((v) => !v)}
            disabled={instFormOpen}
          >
            <Plus className="h-3.5 w-3.5" /> Agregar fecha
          </Button>
        </div>

        {instFormOpen && (
          <div className="border-b border-white/5 bg-white/[0.02] px-4 py-4 sm:px-5">
            <div className="grid gap-2 sm:grid-cols-[1fr_10rem_9rem]">
              <input
                value={instLabel}
                onChange={(e) => setInstLabel(e.target.value)}
                placeholder="Etiqueta (ej.: Semana 1)"
                aria-label="Etiqueta de la cuota"
                className={`${fieldClass}`}
              />
              <input
                type="date"
                value={instDate}
                onChange={(e) => setInstDate(e.target.value)}
                aria-label="Fecha de vencimiento"
                className={`${fieldClass} [color-scheme:dark]`}
              />
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400">$</span>
                <input
                  value={instAmount}
                  onChange={(e) => setInstAmount(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addInstallment()}
                  inputMode="decimal"
                  placeholder={summary.dueCents > 0 ? (summary.dueCents / 100).toFixed(2) : "0.00"}
                  aria-label="Monto de la cuota"
                  className={`${fieldClass} pl-7 tabular-nums`}
                />
              </div>
            </div>
            <div className="mt-2 flex justify-end gap-2">
              <Button size="sm" variant="ghost" className="text-zinc-400 hover:text-zinc-100" onClick={() => setInstFormOpen(false)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={addInstallment} disabled={savingInst}>
                {savingInst ? "Agregando..." : "Agregar"}
              </Button>
            </div>
          </div>
        )}

        {sortedInstallments.length === 0 ? (
          <p className="px-4 py-6 text-xs text-zinc-500 sm:px-5">
            Sin fechas cargadas. Agrega las cuotas acordadas (ej.: semana por semana) para que el
            cliente reciba recordatorios automáticos.
          </p>
        ) : (
          <ul className="divide-y divide-white/5">
            {(() => {
              let accumulated = 0
              return sortedInstallments.map((installment) => {
                accumulated += installment.amountCents
                const covered = paidCentsTotal >= accumulated
                const isOverdue =
                  !covered && installment.dueDate.slice(0, 10) <= todayIso && priceCents > 0
                const chipClass = covered
                  ? "bg-emerald-500/10 text-emerald-300 ring-emerald-400/25"
                  : isOverdue
                    ? "bg-rose-500/10 text-rose-300 ring-rose-400/25"
                    : "bg-white/5 text-zinc-400 ring-white/10"
                return (
                  <li key={installment.id} className="group flex items-center gap-3 px-4 py-2.5 sm:px-5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-zinc-200">
                        {installment.label || "Cuota"}
                        <span className="ml-2 text-xs font-normal text-zinc-500">
                          vence {formatPaymentDate(installment.dueDate)}
                        </span>
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${chipClass}`}>
                      {covered ? "cubierta" : isOverdue ? "vencida" : "pendiente"}
                    </span>
                    <span className="w-20 shrink-0 text-right text-sm font-medium tabular-nums text-zinc-200">
                      {formatMoney(installment.amountCents)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeInstallment(installment.id)}
                      aria-label={`Quitar ${installment.label || "cuota"}`}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-zinc-500 opacity-0 transition-all hover:bg-red-500/10 hover:text-red-300 group-hover:opacity-100 focus-visible:opacity-100 max-sm:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                )
              })
            })()}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-white/5 bg-[#0c0c0e]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 px-4 py-3 sm:px-5">
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
          <div className="border-b border-white/5 bg-white/[0.02] px-4 py-4 sm:px-5">
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
                value={kind === "PAYMENT" ? method : kind}
                onChange={(e) => {
                  const value = e.target.value
                  // Un solo desplegable: los medios de pago son cobros, y las
                  // retenciones y ajustes no tienen medio porque no hay plata.
                  if (isPaymentKind(value) && value !== "PAYMENT") {
                    setKind(value)
                  } else {
                    setKind("PAYMENT")
                    setMethod(value)
                  }
                }}
                aria-label="Medio de pago o tipo de movimiento"
                className={fieldClass}
              >
                <optgroup label="Cobro">
                  {paymentMethods.map((m) => (
                    <option key={m} value={m}>
                      {paymentMethodLabels[m]}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="No es plata que entra">
                  {paymentKinds
                    .filter((k) => k !== "PAYMENT")
                    .map((k) => (
                      <option key={k} value={k}>
                        {paymentKindLabels[k]}
                      </option>
                    ))}
                </optgroup>
              </select>
            </div>

            {kind !== "PAYMENT" && (
              <p className="mt-2 text-xs text-sky-300/80">{paymentKindHints[kind]}</p>
            )}

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
                . Tócalo para completar el monto.
              </p>
            )}
          </div>
        )}

        {payments.length === 0 ? (
          <div className="px-4 py-10 text-center sm:px-5">
            <p className="text-sm text-zinc-300">Todavía no registraste ningún cobro</p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-zinc-400">
              Carga cada pago que vayas recibiendo, de una vez o en cuotas. El cliente ve el avance
              en el enlace compartido.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {payments.map((payment) => (
              <li key={payment.id} className="group px-4 py-3 sm:px-5">
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
                          {isCashEntry(payment)
                            ? paymentMethodLabels[payment.method] ?? payment.method
                            : isPaymentKind(payment.kind)
                              ? paymentKindLabels[payment.kind]
                              : payment.kind}
                        </span>
                      </p>
                      {payment.note && (
                        <p className="truncate text-xs text-zinc-400">{payment.note}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <span
                        className={`text-sm font-medium tabular-nums ${
                          isCashEntry(payment) ? "text-emerald-300" : "text-sky-300"
                        }`}
                      >
                        {isCashEntry(payment) ? "+" : "−"} {formatMoney(payment.amountCents)}
                      </span>
                      {/* Sólo lo que se cobró genera recibo: no se le manda un
                          comprobante de pago a alguien por una retención suya. */}
                      {isCashEntry(payment) && (
                        <button
                          type="button"
                          onClick={() => openReceipt(payment)}
                          aria-label={`Recibo del cobro de ${formatMoney(payment.amountCents)}`}
                          title="Ver recibo"
                          className="ml-2 flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 opacity-0 transition-all hover:bg-white/5 hover:text-zinc-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500 group-hover:opacity-100 max-sm:h-9 max-sm:w-9 max-sm:opacity-100"
                        >
                          <FileText className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => startEdit(payment)}
                        aria-label={`Editar el cobro de ${formatMoney(payment.amountCents)}`}
                        className="ml-2 flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 opacity-0 transition-all hover:bg-white/5 hover:text-zinc-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500 group-hover:opacity-100 max-sm:h-9 max-sm:w-9 max-sm:opacity-100"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removePayment(payment)}
                        aria-label={`Borrar el cobro de ${formatMoney(payment.amountCents)}`}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 opacity-0 transition-all hover:bg-red-500/10 hover:text-red-300 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500 group-hover:opacity-100 max-sm:h-9 max-sm:w-9 max-sm:opacity-100"
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

      {receiptFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-6" onClick={() => setReceiptFor(null)}>
          <div
            className="flex max-h-full w-full max-w-xl flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0c0c0e] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-3.5">
              <h2 className="text-base font-semibold text-zinc-100">Recibo de pago</h2>
              <button type="button" onClick={() => setReceiptFor(null)} className="rounded-md p-1 text-zinc-400 hover:bg-white/5 hover:text-zinc-100" aria-label="Cerrar recibo">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
              <iframe
                ref={receiptFrameRef}
                title="Vista previa del recibo"
                srcDoc={receiptHtml}
                className="h-[34rem] w-full rounded-lg border border-white/10 bg-white"
              />

              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-400" htmlFor="receipt-to">
                  Enviar a
                </label>
                <Input
                  id="receipt-to"
                  value={receiptTo}
                  onChange={(e) => setReceiptTo(e.target.value)}
                  placeholder="cliente@email.com"
                  inputMode="email"
                  autoComplete="off"
                  className="border-white/10 bg-[#18181b]"
                />
                {!client?.email && (
                  <p className="text-xs text-zinc-500">
                    Este cliente no tiene email guardado: escribilo acá (y cargalo en el cliente para la próxima).
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-400" htmlFor="receipt-detail">
                  Detalle del documento
                </label>
                <textarea
                  id="receipt-detail"
                  value={receiptDetail}
                  onChange={(e) => setReceiptDetail(e.target.value)}
                  rows={3}
                  placeholder="Ej.: Incluye $75 de deuda anterior de julio + mensualidad de septiembre..."
                  className="w-full rounded-md border border-white/10 bg-[#18181b] px-3 py-2 text-sm text-zinc-200 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500"
                />
                <p className="text-xs text-zinc-500">
                  Lo que escribas sale como párrafo de «Detalle» en el recibo, debajo del concepto del cobro.
                </p>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-white/10 px-5 py-3.5">
              <Button variant="ghost" className="gap-1.5 text-zinc-400 hover:text-zinc-100" onClick={printReceipt}>
                <Printer className="h-3.5 w-3.5" /> Imprimir / PDF
              </Button>
              <Button className="gap-1.5 bg-brand text-white hover:bg-[#d0424a]" onClick={sendReceipt} disabled={sendingReceipt}>
                <Mail className="h-3.5 w-3.5" /> {sendingReceipt ? "Enviando..." : `Enviar a ${client?.name ?? "cliente"}`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

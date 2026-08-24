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
  parseAmountToCents,
  paymentMethodLabels,
  paymentMethods,
  summarizePayments,
} from "@/lib/payments"
import { buildReceiptHtml, receiptNumberFromId } from "@/lib/receipt"

interface Props {
  planningId: string
  priceCents: number
  payments: PaymentRecord[]
  installments: Array<{ id: string; label: string; amountCents: number; dueDate: string }>
  onChange: (updates: { priceCents?: number; payments?: PaymentRecord[]; installments?: Array<{ id: string; label: string; amountCents: number; dueDate: string }> }) => void
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

function byDate(a: PaymentRecord, b: PaymentRecord) {
  return new Date(a.paidAt).getTime() - new Date(b.paidAt).getTime()
}

const fieldClass =
  "h-9 w-full rounded-md border border-white/10 bg-[#18181b] px-3 text-sm text-zinc-200 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500 disabled:opacity-50"

export function PaymentsTab({
  planningId,
  priceCents,
  payments,
  installments,
  onChange,
  client,
  periodLabel,
  planTitle,
  businessName,
  businessEmail,
}: Props) {
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
  }, [receiptFor, receiptDetail])

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

  const openPriceEditor = () => {
    setPriceDraft(priceCents > 0 ? (priceCents / 100).toFixed(2) : "")
    setEditingPrice(true)
  }

  const savePrice = async () => {
    const cents = parseAmountToCents(priceDraft)
    if (cents === null || cents < 0) {
      toast.error("Escribe un precio válido, por ejemplo 1200")
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
                Pon el precio de este plan
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
                        onClick={() => openReceipt(payment)}
                        aria-label={`Recibo del cobro de ${formatMoney(payment.amountCents)}`}
                        title="Ver recibo"
                        className="ml-2 flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 opacity-0 transition-all hover:bg-white/5 hover:text-zinc-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500 group-hover:opacity-100 max-sm:h-9 max-sm:w-9 max-sm:opacity-100"
                      >
                        <FileText className="h-3.5 w-3.5" />
                      </button>
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

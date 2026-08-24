"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Lightbulb, Pencil } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ClientLogo } from "@/components/ClientLogo"
import { NotificationBell } from "@/components/NotificationBell"
import { GlobalSearch } from "@/components/GlobalSearch"
import { PaymentLedger, paymentDotStyles, type PaymentRecord } from "@/components/payments/PaymentStatus"
import { formatMoney, formatPaymentDate, parseAmountToCents } from "@/lib/payments"
import { formatPeriodLabel } from "@/lib/planning-period"
import type { ClientAccount } from "@/lib/client-account"

interface Props {
  client: { id: string; name: string; email: string; planName: string; rateCents: number }
  account: ClientAccount
  ideaCounts: Record<string, number>
  recentEntries: Array<PaymentRecord & { planningId: string; period: string }>
}

const planStatusLabels: Record<string, string> = {
  DRAFT: "Borrador",
  IN_PROGRESS: "En Progreso",
  REVIEW: "Revisión",
  APPROVED: "Aprobado",
  PUBLISHED: "Publicado",
}

const statusColors: Record<string, string> = {
  DRAFT: "bg-white/5 text-zinc-400",
  IN_PROGRESS: "bg-blue-500/10 text-blue-400",
  REVIEW: "bg-yellow-500/10 text-yellow-400",
  APPROVED: "bg-green-500/10 text-green-400",
  PUBLISHED: "bg-purple-500/10 text-purple-400",
}

export function ClientDetailClient({ client, account, ideaCounts, recentEntries }: Props) {
  const router = useRouter()
  const [editingPlan, setEditingPlan] = useState(false)
  const [planName, setPlanName] = useState(client.planName)
  const [rate, setRate] = useState(client.rateCents > 0 ? (client.rateCents / 100).toFixed(2) : "")
  const [savingPlan, setSavingPlan] = useState(false)
  const [plan, setPlan] = useState({ name: client.planName, rateCents: client.rateCents })

  const savePlan = async () => {
    const rateCents = rate.trim() ? parseAmountToCents(rate) : 0
    if (rateCents === null || rateCents < 0) {
      toast.error("Escribe una tarifa válida, por ejemplo 600")
      return
    }
    setSavingPlan(true)
    const res = await fetch(`/api/clients/${client.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: client.name,
        email: client.email,
        planName: planName.trim(),
        rateCents,
      }),
    })
    setSavingPlan(false)
    if (!res.ok) {
      toast.error("No se pudo guardar el plan")
      return
    }
    setPlan({ name: planName.trim(), rateCents })
    setEditingPlan(false)
    toast.success(
      rateCents > 0 ? `Tarifa guardada: ${formatMoney(rateCents)} al mes` : "Cliente sin tarifa fija",
    )
    router.refresh()
  }

  const metricClass = "rounded-lg border border-white/5 bg-[#0c0c0e] px-4 py-3"

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-300">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-white/5 bg-[#09090b]/95 px-3 pt-[env(safe-area-inset-top)] backdrop-blur sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-1 py-2 sm:gap-2">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            aria-label="Volver al workspace"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex min-w-0 items-center gap-2">
            <ClientLogo clientId={client.id} name={client.name} size={22} />
            <span className="truncate text-sm font-medium text-zinc-200">{client.name}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 py-2 sm:gap-2">
          <GlobalSearch />
          <NotificationBell />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pb-[max(3rem,env(safe-area-inset-bottom))] pt-6 sm:px-6">
        {/* El plan contratado: la tarifa es el contrato. */}
        <section className="mb-6 rounded-xl border border-white/5 bg-[#0c0c0e] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight text-zinc-100">{client.name}</h1>
              {client.email && <p className="mt-0.5 truncate text-sm text-zinc-400">{client.email}</p>}
            </div>
            {!editingPlan && (
              <button
                type="button"
                onClick={() => setEditingPlan(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-xs text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500"
              >
                <Pencil className="h-3.5 w-3.5" /> Plan
              </button>
            )}
          </div>

          {editingPlan ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Input
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                placeholder="Nombre del plan (ej.: Plan Crecimiento)"
                aria-label="Nombre del plan"
                className="h-9 min-w-0 flex-1 border-white/10 bg-[#18181b] text-zinc-100"
              />
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400">
                  $
                </span>
                <Input
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") savePlan()
                    if (e.key === "Escape") setEditingPlan(false)
                  }}
                  inputMode="decimal"
                  placeholder="600.00"
                  aria-label="Tarifa mensual"
                  className="h-9 w-28 border-white/10 bg-[#18181b] pl-7 tabular-nums text-zinc-100"
                />
              </div>
              <Button size="sm" onClick={savePlan} disabled={savingPlan}>
                {savingPlan ? "Guardando..." : "Guardar"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-zinc-400 hover:text-zinc-100"
                onClick={() => setEditingPlan(false)}
              >
                Cancelar
              </Button>
              <p className="w-full text-xs text-zinc-500">
                Cada mes nuevo de este cliente va a nacer con esta tarifa puesta.
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-zinc-300">
              {plan.rateCents > 0 ? (
                <>
                  <span className="font-medium text-zinc-100">{plan.name || "Plan mensual"}</span>
                  {" — "}
                  <span className="tabular-nums">{formatMoney(plan.rateCents)}</span> al mes
                </>
              ) : (
                <span className="text-zinc-500">
                  Sin tarifa fija. Si la cargas, cada mes nuevo nace con ese valor puesto.
                </span>
              )}
            </p>
          )}
        </section>

        {/* Estado de cuenta: la deuda es del cliente, no del mes. */}
        <section className="mb-6">
          <h2 className="mb-3 text-sm font-semibold tracking-tight text-zinc-200">Estado de cuenta</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className={metricClass}>
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">Facturado</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-zinc-100">
                {formatMoney(account.valueCents)}
              </p>
            </div>
            <div className={metricClass}>
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">Cobrado</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-emerald-300">
                {formatMoney(account.paidCents)}
              </p>
            </div>
            <div className={metricClass}>
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">Retenido o ajustado</p>
              <p
                className={`mt-1 text-lg font-bold tabular-nums ${
                  account.offsetCents > 0 ? "text-sky-300" : "text-zinc-100"
                }`}
              >
                {formatMoney(account.offsetCents)}
              </p>
            </div>
            <div className={metricClass}>
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">Saldo</p>
              <p
                className={`mt-1 text-lg font-bold tabular-nums ${
                  account.dueCents > 0 ? "text-amber-300" : "text-zinc-100"
                }`}
              >
                {formatMoney(account.dueCents)}
              </p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className={metricClass}>
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">Costos</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-zinc-100">
                {formatMoney(account.margin.costCents)}
              </p>
            </div>
            <div className={`${metricClass} sm:col-span-3`}>
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">Margen acumulado</p>
              <p
                className={`mt-1 text-lg font-bold tabular-nums ${
                  account.margin.marginCents >= 0 ? "text-emerald-300" : "text-red-300"
                }`}
              >
                {formatMoney(account.margin.marginCents)}
                {account.margin.marginPercent !== null && (
                  <span className="ml-2 text-sm font-normal text-zinc-400">
                    ({account.margin.marginPercent}%)
                  </span>
                )}
                {account.margin.costCents === 0 && (
                  <span className="ml-2 text-xs font-normal text-zinc-500">
                    — sin costos cargados todavía
                  </span>
                )}
              </p>
            </div>
          </div>

          {account.margin.marginCents < 0 && (
            <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300 ring-1 ring-inset ring-red-400/25">
              Este cliente cuesta más de lo que factura.
            </p>
          )}

          {account.dueCents > 0 && (
            <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-300 ring-1 ring-inset ring-amber-400/25">
              Debe {formatMoney(account.dueCents)} repartidos en{" "}
              {account.monthsWithDebt === 1 ? "1 mes" : `${account.monthsWithDebt} meses`}
              {account.oldestDebtPeriod ? (
                <> — el más viejo es {formatPeriodLabel(account.oldestDebtPeriod)}.</>
              ) : (
                "."
              )}
            </p>
          )}
          {account.offsetCents > 0 && (
            <p className="mt-2 text-xs text-zinc-500">
              Los {formatMoney(account.offsetCents)} retenidos o ajustados cerraron saldo, pero nunca
              entraron a la cuenta.
            </p>
          )}
        </section>

        {/* Cada mes conserva su propio saldo. */}
        <section className="mb-6">
          <h2 className="mb-3 text-sm font-semibold tracking-tight text-zinc-200">
            Meses <span className="font-normal text-zinc-500">({account.months.length})</span>
          </h2>
          {account.months.length === 0 ? (
            <p className="rounded-lg border border-dashed border-white/10 py-10 text-center text-sm text-zinc-400">
              Este cliente todavía no tiene meses planificados.
            </p>
          ) : (
            <ul className="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/5 bg-[#0c0c0e]">
              {account.months.map((month) => (
                <li key={month.id}>
                  <button
                    type="button"
                    onClick={() => router.push(`/planning/${month.id}`)}
                    className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 text-left transition-colors hover:bg-white/[0.02]"
                  >
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-zinc-200">
                        {formatPeriodLabel(month.period) || month.title || "Sin período"}
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] ${statusColors[month.status] ?? ""}`}
                        >
                          {planStatusLabels[month.status] ?? month.status}
                        </span>
                      </p>
                      <p className="mt-0.5 flex items-center gap-3 text-[11px] text-zinc-500">
                        <span className="flex items-center gap-1">
                          <Lightbulb className="h-3 w-3" /> {ideaCounts[month.id] ?? 0} ideas
                        </span>
                        <span className="tabular-nums">Valor {formatMoney(month.priceCents)}</span>
                        {month.costCents > 0 && (
                          <span
                            className={`tabular-nums ${
                              month.priceCents - month.costCents >= 0 ? "text-emerald-400/80" : "text-red-400/80"
                            }`}
                          >
                            Margen {formatMoney(month.priceCents - month.costCents)}
                          </span>
                        )}
                      </p>
                    </div>
                    <span className="flex shrink-0 items-center gap-1.5 text-sm tabular-nums">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          month.priceCents === 0
                            ? paymentDotStyles.UNPRICED
                            : month.dueCents > 0
                              ? paymentDotStyles.PARTIAL
                              : paymentDotStyles.PAID
                        }`}
                        aria-hidden
                      />
                      {month.priceCents === 0 ? (
                        <span className="text-zinc-500">Sin valor</span>
                      ) : month.dueCents > 0 ? (
                        <span className="text-amber-300">debe {formatMoney(month.dueCents)}</span>
                      ) : (
                        <span className="text-emerald-300">saldado</span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Todos los meses juntos: responde "¿cuándo me pagó por última vez?". */}
        <section>
          <h2 className="mb-3 text-sm font-semibold tracking-tight text-zinc-200">Últimos movimientos</h2>
          <div className="rounded-xl border border-white/5 bg-[#0c0c0e] p-5">
            {recentEntries.length === 0 ? (
              <p className="py-6 text-center text-sm text-zinc-400">
                Todavía no hay cobros ni ajustes registrados para este cliente.
              </p>
            ) : (
              <>
                <PaymentLedger payments={recentEntries} />
                <p className="mt-3 text-xs text-zinc-500">
                  Último movimiento: {formatPaymentDate(recentEntries[0].paidAt)}.
                </p>
              </>
            )}
          </div>
        </section>

        <p className="mt-8 text-center text-xs text-zinc-600">
          El saldo suma todos los meses. Cada mes conserva lo suyo, así que nada se cobra dos veces.
        </p>
      </main>
    </div>
  )
}

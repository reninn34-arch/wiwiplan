"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { BarChart3, Bookmark, Eye, Heart, MessageCircle, RefreshCw, Share2, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { networkColors, networkLabels, type SocialNetwork } from "@/lib/social"

/**
 * Cómo le fue a lo que ya salió.
 *
 * Un guion y no un cero cuando falta un dato. Es la regla de toda la pantalla:
 * "no lo sabemos" y "no lo vio nadie" se ven distinto, porque enseñarle a un
 * cliente un alcance de cero por un permiso que falta es peor que no enseñarle
 * nada.
 */

interface Row {
  ideaId: string
  accountId: string
  publishedAt: string | null
  externalPostId: string | null
  reach: number | null
  likes: number | null
  commentCount: number | null
  saves: number | null
  shares: number | null
  views: number | null
  metricsAt: string | null
  idea: { title: string; postType: string }
  account: { network: string; handle: string }
}

const numero = (n: number | null) => (n === null ? "—" : n.toLocaleString("es-EC"))

/** Suma sólo lo que existe. Devuelve nulo si no había ni un dato que sumar. */
function suma(rows: Row[], campo: keyof Row): number | null {
  const valores = rows.map((r) => r[campo]).filter((v): v is number => typeof v === "number")
  return valores.length === 0 ? null : valores.reduce((a, b) => a + b, 0)
}

function Metrica({
  icono: Icono,
  etiqueta,
  valor,
}: {
  icono: typeof Heart
  etiqueta: string
  valor: number | null
}) {
  return (
    <span className="flex items-center gap-1" title={etiqueta}>
      <Icono className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />
      <span className={`tabular-nums ${valor === null ? "text-zinc-600" : "text-zinc-300"}`}>
        {numero(valor)}
      </span>
      <span className="sr-only">{etiqueta}</span>
    </span>
  )
}

export function ResultsTab({ planningId }: { planningId: string }) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const cargar = useCallback(async () => {
    const res = await fetch(`/api/plannings/${planningId}/metrics`)
    if (!res.ok) {
      toast.error("No se pudieron cargar los resultados")
      setRows([])
      return
    }
    setRows((await res.json()) as Row[])
  }, [planningId])

  // La carga va encadenada y no llamando a `cargar()` a secas: hacerlo de
  // forma sincrónica dentro del efecto encadena renders. El indicador de
  // cancelado evita escribir estado si la pestaña se cerró mientras tanto.
  useEffect(() => {
    let cancelado = false
    fetch(`/api/plannings/${planningId}/metrics`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("no se pudo"))))
      .then((data) => {
        if (!cancelado) setRows(data as Row[])
      })
      .catch(() => {
        if (cancelado) return
        setRows([])
        toast.error("No se pudieron cargar los resultados")
      })
    return () => {
      cancelado = true
    }
  }, [planningId])

  const actualizar = async () => {
    setRefreshing(true)
    const res = await fetch(`/api/plannings/${planningId}/metrics`, { method: "POST" })
    const data = await res.json().catch(() => ({}))
    setRefreshing(false)

    if (!res.ok) {
      toast.error(data.error ?? "No se pudieron traer los números")
      return
    }
    await cargar()

    // Se dice qué pasó con las que no se pudieron actualizar, en vez de un
    // "listo" que dejaría pensando por qué siguen vacías.
    const partes: string[] = []
    if (data.actualizadas) partes.push(`${data.actualizadas} actualizadas`)
    if (data.sinDatos) partes.push(`${data.sinDatos} sin datos todavía`)
    if (data.sinId) partes.push(`${data.sinId} publicadas a mano`)
    if (data.sinConexion) partes.push(`${data.sinConexion} con la conexión caída`)
    toast.success(partes.length > 0 ? partes.join(" · ") : "No hay nada publicado todavía")
  }

  if (rows === null) {
    return <p className="py-10 text-center text-sm text-zinc-500">Cargando resultados…</p>
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 p-10 text-center">
        <BarChart3 className="mx-auto mb-3 h-6 w-6 text-zinc-600" aria-hidden />
        <p className="text-sm text-zinc-400">
          Todavía no salió nada este mes. Cuando una pieza se publique, acá aparece cómo le fue.
        </p>
      </div>
    )
  }

  const nuncaConsultado = rows.every((r) => r.metricsAt === null)
  const ultima = rows
    .map((r) => r.metricsAt)
    .filter((d): d is string => Boolean(d))
    .sort()
    .at(-1)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-zinc-200">
            {rows.length} {rows.length === 1 ? "publicación" : "publicaciones"} este mes
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            {ultima
              ? `Números al ${new Date(ultima).toLocaleString("es-EC", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}`
              : "Sin consultar todavía"}
          </p>
        </div>
        <Button size="sm" className="h-10 text-xs" onClick={actualizar} disabled={refreshing}>
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Trayendo…" : "Actualizar"}
        </Button>
      </div>

      {nuncaConsultado && (
        <p className="rounded-lg bg-white/[0.04] px-3 py-2 text-xs text-zinc-400">
          Los números no se traen solos al abrir la pestaña, para no gastar cuota de la API cada
          vez. Toca <span className="text-zinc-200">Actualizar</span>.
        </p>
      )}

      {/* El total del mes. Es lo que se le enseña al cliente antes del detalle. */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {(
          [
            { icono: Users, etiqueta: "Alcance", campo: "reach" },
            { icono: Eye, etiqueta: "Reproducciones", campo: "views" },
            { icono: Heart, etiqueta: "Me gusta", campo: "likes" },
            { icono: MessageCircle, etiqueta: "Comentarios", campo: "commentCount" },
            { icono: Bookmark, etiqueta: "Guardados", campo: "saves" },
            { icono: Share2, etiqueta: "Compartidos", campo: "shares" },
          ] as const
        ).map(({ icono: Icono, etiqueta, campo }) => {
          const total = suma(rows, campo)
          return (
            <div key={campo} className="rounded-xl border border-white/5 bg-[#0c0c0e] p-3">
              <span className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                <Icono className="h-3.5 w-3.5" aria-hidden />
                {etiqueta}
              </span>
              <span
                className={`mt-1 block text-xl font-semibold tabular-nums ${
                  total === null ? "text-zinc-600" : "text-zinc-100"
                }`}
              >
                {numero(total)}
              </span>
            </div>
          )
        })}
      </div>

      <div className="space-y-2">
        {rows.map((row) => {
          const network = row.account.network as SocialNetwork
          return (
            <div
              key={`${row.ideaId}-${row.accountId}`}
              className="rounded-xl border border-white/5 bg-[#0c0c0e] p-3"
            >
              <div className="flex items-start gap-2">
                <span
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: networkColors[network] ?? "#52525b" }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-zinc-200">
                    {row.idea.title || "Sin título"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-zinc-500">
                    {networkLabels[network] ?? row.account.network}
                    {row.account.handle && ` · @${row.account.handle}`}
                    {row.publishedAt &&
                      ` · ${new Date(row.publishedAt).toLocaleDateString("es-EC", {
                        day: "numeric",
                        month: "short",
                      })}`}
                  </p>
                </div>
              </div>

              {row.externalPostId === null ? (
                <p className="mt-2 pl-4 text-[11px] text-zinc-500">
                  Marcada a mano como publicada, así que no sabemos cuál es en la red y no hay
                  números que traer.
                </p>
              ) : (
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 pl-4 text-xs">
                  <Metrica icono={Users} etiqueta="Alcance" valor={row.reach} />
                  {row.views !== null && (
                    <Metrica icono={Eye} etiqueta="Reproducciones" valor={row.views} />
                  )}
                  <Metrica icono={Heart} etiqueta="Me gusta" valor={row.likes} />
                  <Metrica icono={MessageCircle} etiqueta="Comentarios" valor={row.commentCount} />
                  <Metrica icono={Bookmark} etiqueta="Guardados" valor={row.saves} />
                  <Metrica icono={Share2} etiqueta="Compartidos" valor={row.shares} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

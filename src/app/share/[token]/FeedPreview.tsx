"use client"

import { useEffect, useMemo, useState } from "react"
import { Copy, Film, Images, Play, X } from "lucide-react"
import { formatPeriodLabel } from "@/lib/planning-period"

/**
 * Cómo va a quedar el feed.
 *
 * Es la pregunta que hace todo cliente y que una lista de tarjetas no puede
 * responder: una parrilla se lee pieza por pieza, y un feed se ve entero. Acá
 * el mes se mira como se va a ver en el perfil.
 *
 * Se imita la rejilla de Instagram —tres columnas, cuadradas, sin separación—
 * y sus insignias de carrusel y reel, porque son las que dan la lectura. No se
 * imitan su logotipo, su barra de navegación ni recuentos de me gusta: números
 * inventados en algo que se le entrega a un cliente se vuelven en contra.
 */

export interface FeedIdea {
  id: string
  title: string
  description: string
  caption: string
  postType: string
  dueDate: string | null
  media: Array<{ id: string; url: string; kind: string; order: number }>
  images: Array<{ id: string }>
}

interface Props {
  ideas: FeedIdea[]
  clientName: string
  /** La foto de perfil real de Instagram. Manda sobre el logo guardado. */
  avatarUrl: string | null
  clientLogo: string | null
  handle: string
  /** Seguidores reales de la cuenta, si se pudieron leer. */
  followers: number | null
  period: string
  /** Las referencias no son públicas por URL: van por una ruta que comprueba
   *  que el enlace compartido siga vivo. */
  referenceUrl: (imageId: string) => string
}

/** Las que no van al feed del perfil, sino arriba en círculos. */
const ES_HISTORIA = (postType: string) => postType === "STORY"

/** Instagram recorta el feed a 1:1, así que la celda hace el mismo recorte. */
function Celda({
  idea,
  referenceUrl,
  onOpen,
}: {
  idea: FeedIdea
  referenceUrl: (id: string) => string
  onOpen: () => void
}) {
  const archivo = idea.media[0]
  const referencia = idea.images[0]
  const esVideo = archivo?.kind === "VIDEO"
  const carrusel = idea.media.length > 1
  const fuente = archivo?.url ?? (referencia ? referenceUrl(referencia.id) : null)

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative aspect-square overflow-hidden bg-[#101013] transition-opacity hover:opacity-90"
    >
      {fuente ? (
        esVideo ? (
          <video
            src={fuente}
            className="h-full w-full object-cover"
            muted
            playsInline
            preload="metadata"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fuente} alt={idea.title} loading="lazy" className="h-full w-full object-cover" />
        )
      ) : (
        // Una pieza sin archivo no deja un hueco gris: dice qué va a ir ahí.
        // Es honesto, y de paso le enseña al cliente lo que falta por producir.
        <span className="flex h-full w-full flex-col items-center justify-center gap-1 bg-white/[0.03] p-2 text-center">
          <span className="line-clamp-3 text-[10px] leading-tight text-zinc-400">
            {idea.title || "Sin título"}
          </span>
          <span className="text-[9px] uppercase tracking-wider text-zinc-600">Por producir</span>
        </span>
      )}

      {/* Las insignias de Instagram: dicen de un vistazo qué es cada celda. */}
      {(carrusel || esVideo) && (
        <span className="absolute right-1.5 top-1.5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
          {carrusel ? (
            <Images className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <Film className="h-3.5 w-3.5" aria-hidden />
          )}
        </span>
      )}
    </button>
  )
}

export function FeedPreview({
  ideas,
  clientName,
  avatarUrl,
  clientLogo,
  handle,
  followers,
  period,
  referenceUrl,
}: Props) {
  const [nuevoArriba, setNuevoArriba] = useState(true)
  const [abierta, setAbierta] = useState<FeedIdea | null>(null)
  const [copiado, setCopiado] = useState(false)

  const historias = useMemo(() => ideas.filter((i) => ES_HISTORIA(i.postType)), [ideas])


  // El orden se contradice y hay que elegir: Instagram pone lo más nuevo arriba
  // a la izquierda, y un plan se lee del 1 al 31. Manda Instagram por defecto,
  // porque la pregunta es "cómo va a quedar", no "qué hago primero".
  const enRejilla = useMemo(() => {
    const feed = ideas.filter((i) => !ES_HISTORIA(i.postType))
    const conFecha = [...feed].sort((a, b) => {
      const x = a.dueDate ?? ""
      const y = b.dueDate ?? ""
      return x === y ? 0 : x < y ? -1 : 1
    })
    return nuevoArriba ? conFecha.reverse() : conFecha
  }, [ideas, nuevoArriba])

  const reels = enRejilla.filter((i) => i.media[0]?.kind === "VIDEO").length
  const conArchivo = enRejilla.filter((i) => i.media.length > 0).length

  // Escape cierra, como cualquier ventana de este tipo. Sin esto sólo queda la
  // X o tocar fuera, y en el celular lo segundo se hace sin querer.
  useEffect(() => {
    if (!abierta) return
    const salir = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierta(null)
    }
    window.addEventListener("keydown", salir)
    return () => window.removeEventListener("keydown", salir)
  }, [abierta])

  const copiar = async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1600)
    } catch {
      /* sin portapapeles: el texto está a la vista igual */
    }
  }

  return (
    // En el celular la tarjeta sangra hasta los bordes: entre su margen y el
    // de la página se perdían 66 de los 375 píxeles de pantalla, y las celdas
    // quedaban en 102 en vez de los ~125 que mide una del feed real. El texto
    // conserva su margen por dentro; sólo la rejilla llega al borde.
    <div className="-mx-4 border-y border-white/5 bg-[#0c0c0e] py-4 sm:mx-0 sm:rounded-2xl sm:border sm:p-5">
      {/* ── Cabecera de perfil ── */}
      <div className="flex items-center gap-4 px-4 sm:px-0">
        {/* El aro de Instagram, con sus colores y su hueco: el degradado no
            toca la foto, entre medias va una franja del fondo. Sin ese
            respiro el aro parece un borde y no el anillo que la gente
            reconoce. */}
        <span
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full p-[3px] sm:h-20 sm:w-20"
          style={{
            background:
              "conic-gradient(from 215deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888, #f09433)",
          }}
        >
          <span className="flex h-full w-full items-center justify-center rounded-full bg-[#0c0c0e] p-[2px]">
            <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-[#101013]">
            {avatarUrl ? (
              // La foto real de Instagram: cuadrada y ya pensada para un
              // círculo, así que se recorta sin perder nada.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
            ) : clientLogo ? (
              // El logo guardado suele ser el del manual de marca —vertical y
              // con el nombre debajo—, así que `contain`: recortándolo se
              // perdía justo lo que lo hace reconocible.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={clientLogo} alt="" className="max-h-full max-w-full object-contain p-1.5" />
            ) : (
              <span className="text-lg font-semibold text-zinc-300">
                {clientName.trim().charAt(0).toUpperCase()}
              </span>
            )}
            </span>
          </span>
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-zinc-100">
            {handle ? `@${handle}` : clientName}
          </p>
          <p className="mt-0.5 truncate text-xs text-zinc-500">{clientName}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
            {followers !== null && (
              <span>
                <strong className="text-zinc-200">{followers.toLocaleString("es-EC")}</strong>{" "}
                seguidores
              </span>
            )}
            <span>
              <strong className="text-zinc-200">{enRejilla.length}</strong> piezas
            </span>
            {reels > 0 && (
              <span>
                <strong className="text-zinc-200">{reels}</strong> video
              </span>
            )}
            {historias.length > 0 && (
              <span>
                <strong className="text-zinc-200">{historias.length}</strong> historias
              </span>
            )}
          </div>
        </div>
      </div>

      <p className="mt-3 px-4 text-xs text-zinc-500 sm:px-0">
        Así se vería el feed con lo propuesto para {formatPeriodLabel(period) || period}. Es una simulación: los archivos son los
        que se van a publicar.
      </p>

      {/* ── Historias: no van al feed, van arriba ── */}
      {historias.length > 0 && (
        <div className="mt-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:px-0">
          {historias.map((idea) => {
            const fuente =
              idea.media[0]?.url ?? (idea.images[0] ? referenceUrl(idea.images[0].id) : null)
            return (
              <button
                key={idea.id}
                type="button"
                onClick={() => setAbierta(idea)}
                className="flex w-16 shrink-0 flex-col items-center gap-1"
              >
                <span className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-tr from-amber-400 via-brand to-fuchsia-600 p-[2px]">
                  <span className="h-full w-full overflow-hidden rounded-full bg-[#101013]">
                    {fuente ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={fuente} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </span>
                </span>
                <span className="w-full truncate text-center text-[10px] text-zinc-500">
                  {idea.title || "Historia"}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* ── La rejilla ── */}
      <div className="mt-4 flex items-center justify-between px-4 sm:px-0">
        <span className="text-[11px] uppercase tracking-wider text-zinc-500">Feed</span>
        <button
          type="button"
          onClick={() => setNuevoArriba((v) => !v)}
          className="min-h-9 rounded-md px-2 text-xs text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200"
        >
          {nuevoArriba ? "Ver del 1 al 31" : "Ver como Instagram"}
        </button>
      </div>

      {enRejilla.length === 0 ? (
        <p className="mx-4 mt-3 rounded-lg border border-dashed border-white/10 p-8 text-center text-xs text-zinc-500 sm:mx-0">
          Todavía no hay piezas de feed en este mes.
        </p>
      ) : (
        <div className="mt-2 grid grid-cols-3 gap-0.5 overflow-hidden sm:rounded-lg">
          {enRejilla.map((idea) => (
            <Celda
              key={idea.id}
              idea={idea}
              referenceUrl={referenceUrl}
              onOpen={() => setAbierta(idea)}
            />
          ))}
        </div>
      )}

      {conArchivo < enRejilla.length && (
        <p className="mt-2 px-4 text-[11px] text-zinc-500 sm:px-0">
          {enRejilla.length - conArchivo} de {enRejilla.length} todavía sin archivo: esas celdas
          muestran el título.
        </p>
      )}

      {/* ── La pieza abierta ── */}
      {abierta && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-0 sm:items-center sm:p-6"
          onClick={() => setAbierta(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-white/10 bg-[#0c0c0e] sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 border-b border-white/5 px-4 py-3">
              <p className="min-w-0 truncate text-sm font-medium text-zinc-100">
                {abierta.title || "Sin título"}
              </p>
              <button
                type="button"
                onClick={() => setAbierta(null)}
                aria-label="Cerrar"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Todos los archivos, no sólo la portada: un carrusel se aprueba
                entero o no se aprueba. */}
            {abierta.media.length > 0 ? (
              <div className="flex snap-x snap-mandatory gap-1 overflow-x-auto bg-black">
                {abierta.media.map((m) =>
                  m.kind === "VIDEO" ? (
                    <video
                      key={m.id}
                      src={m.url}
                      controls
                      playsInline
                      className="max-h-[55vh] w-full shrink-0 snap-center object-contain"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={m.id}
                      src={m.url}
                      alt=""
                      className="max-h-[55vh] w-full shrink-0 snap-center object-contain"
                    />
                  ),
                )}
              </div>
            ) : abierta.images.length > 0 ? (
              <div className="flex gap-1 overflow-x-auto bg-black">
                {abierta.images.map((img) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={img.id}
                    src={referenceUrl(img.id)}
                    alt=""
                    className="max-h-[55vh] w-full shrink-0 object-contain"
                  />
                ))}
              </div>
            ) : (
              <p className="flex items-center justify-center gap-2 bg-white/[0.02] py-10 text-xs text-zinc-500">
                <Play className="h-3.5 w-3.5" aria-hidden /> Todavía por producir
              </p>
            )}

            <div className="space-y-3 px-4 py-3">
              {abierta.dueDate && (
                <p className="text-xs text-zinc-500">
                  {new Date(abierta.dueDate).toLocaleDateString("es-EC", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </p>
              )}
              {abierta.description && (
                <p className="text-sm text-zinc-400">{abierta.description}</p>
              )}
              {abierta.caption && (
                <div className="rounded-lg bg-white/[0.04] p-3">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="text-[11px] uppercase tracking-wider text-zinc-500">
                      Texto de la publicación
                    </span>
                    <button
                      type="button"
                      onClick={() => copiar(abierta.caption)}
                      className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-xs text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                    >
                      <Copy className="h-3 w-3" /> {copiado ? "Copiado" : "Copiar"}
                    </button>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-zinc-200">{abierta.caption}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

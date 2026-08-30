"use client"

import { useEffect, useState } from "react"
import {
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Clock,
  Copy,
  ExternalLink,
  Hash,
  ImageOff,
  ImagePlus,
  MessageSquare,
  Maximize2,
  Send,
  X,
} from "lucide-react"
import { detectEmbed, platformLabel, postTypeLabel } from "@/lib/embeds"
import { ideaImageUrl, panelImageUrl } from "@/lib/media"

/**
 * Una idea, como se la mira el cliente.
 *
 * Reemplaza a la tabla que había en escritorio. Una tabla sirve para comparar
 * filas, y acá nadie compara: se mira idea por idea. Encima obligaba a
 * mantener dos diseños y el de escritorio era el peor de los dos.
 *
 * Trae tres cosas que el cliente no veía y son justo las que necesita para
 * opinar: **cuándo sale**, **qué va a decir** y **el archivo de verdad** —hasta
 * ahora sólo veía las referencias de inspiración—.
 */

export interface Comment {
  id: string
  authorName: string
  text: string
  createdAt: string
}

export interface CardIdea {
  id: string
  title: string
  description: string
  caption: string
  pilar: string
  postType: string
  platform: string
  referenceUrl: string
  referenceEmbed: string
  status: string
  dueDate: string | null
  media: Array<{ id: string; url: string; kind: string; order: number }>
  images: Array<{ id: string }>
  contentIdeaTags: Array<{ tag: { id: string; name: string; color: string } }>
  comments: Comment[]
  storyboard: {
    id: string
    title: string
    panels: Array<{
      id: string
      hasImage: boolean
      description: string
      duration: string
      notes: string
    }>
  } | null
}

const estadoEtiqueta: Record<string, string> = {
  IDEA: "Idea",
  SELECTED: "Seleccionada",
  IN_PRODUCTION: "En producción",
  DONE: "Lista",
}

function fecha(iso: string | null): string {
  if (!iso) return "Sin fecha"
  return new Date(iso).toLocaleDateString("es-EC", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
}

export function IdeaCard({
  idea,
  onPreviewImage,
}: {
  idea: CardIdea
  onPreviewImage: (url: string) => void
}) {
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [comentarios, setComentarios] = useState(idea.comments)
  const [copyEntero, setCopyEntero] = useState(false)
  const [copiado, setCopiado] = useState(false)
  /** Qué escena está abierta en el visor, o `null`. */
  const [escena, setEscena] = useState<number | null>(null)
  /** Dónde empezó el arrastre del dedo, para saber hacia dónde fue. */
  const [tocado, setTocado] = useState<number | null>(null)

  const escenas = idea.storyboard?.panels ?? []

  // Flechas y Escape: si el visor se pasa escena por escena, el teclado tiene
  // que poder hacerlo igual que el dedo.
  useEffect(() => {
    if (escena === null) return
    const teclas = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEscena(null)
      if (e.key === "ArrowRight") setEscena((n) => (n === null ? n : Math.min(n + 1, escenas.length - 1)))
      if (e.key === "ArrowLeft") setEscena((n) => (n === null ? n : Math.max(n - 1, 0)))
    }
    window.addEventListener("keydown", teclas)
    return () => window.removeEventListener("keydown", teclas)
  }, [escena, escenas.length])

  const comentar = async () => {
    const msg = texto.trim()
    if (!msg || enviando) return
    setEnviando(true)
    setTexto("")
    const res = await fetch(`/api/ideas/${idea.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: msg, authorName: "Cliente" }),
    })
    if (res.ok) {
      const nuevo = await res.json()
      setComentarios((prev) => [...prev, nuevo])
    }
    setEnviando(false)
  }

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(idea.caption)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1600)
    } catch {
      /* sin portapapeles: el texto está a la vista igual */
    }
  }

  // El archivo real manda sobre las referencias. Si no hay, se enseña la
  // inspiración, que es lo único que había antes.
  const archivos = idea.media
  const referencias = idea.images
  // La referencia: el TikTok o el video en el que se inspiró la pieza. El
  // ayudante ya calculaba estos enlaces y se guardaban, pero sólo se dibujaban
  // los de YouTube y Vimeo; los demás salían como un enlace suelto y el cliente
  // tenía que abrirlos fuera para entender la idea.
  //
  // Si la incrustación guardada está vacía se recalcula acá. Las piezas viejas
  // se guardaron cuando el detector no reconocía `/reels/`, y recalcular las
  // arregla sin tener que tocar la base.
  const detectado = !idea.referenceEmbed && idea.referenceUrl ? detectEmbed(idea.referenceUrl) : null
  const embed = idea.referenceEmbed || detectado?.embedUrl || ""
  const red = idea.referenceEmbed ? idea.platform : detectado?.platform ?? idea.platform

  const INCRUSTABLES = ["YOUTUBE", "VIMEO", "TIKTOK", "FACEBOOK", "INSTAGRAM"]
  const incrusta = embed && INCRUSTABLES.includes(red) ? embed : null
  const imagenSuelta = embed && red === "IMAGE" ? embed : null
  const enlaceSuelto = !incrusta && !imagenSuelta && idea.referenceUrl ? idea.referenceUrl : null
  const hayAlgoQueVer =
    archivos.length > 0 ||
    referencias.length > 0 ||
    Boolean(incrusta) ||
    Boolean(imagenSuelta) ||
    Boolean(enlaceSuelto)

  /** Cada red trae su forma: el vertical de TikTok no es el 16:9 de YouTube. */
  const proporcion =
    red === "TIKTOK" ? "aspect-[9/16]" : red === "INSTAGRAM" ? "aspect-[3/4]" : "aspect-video"

  return (
    <article className="overflow-hidden rounded-xl border border-white/5 bg-[#0c0c0e]">
      {/* ── Lo que se ve ──
          Todas las tarjetas abren con un bloque del mismo alto, tengan archivo
          o no. Antes, las piezas sin producir empezaban directo en texto y la
          rejilla quedaba desigual y difícil de leer. */}
      <div
        className={`relative overflow-hidden bg-black ${
          // Con archivo propio, el alto de Instagram. Con referencia, la forma
          // que tenga esa red. Sin nada que enseñar, una franja corta: un
          // bloque de 4:5 vacío se comía una pantalla entera del celular antes
          // de llegar al texto, que es lo único que había.
          !hayAlgoQueVer
            ? "h-20"
            : archivos.length > 0 || referencias.length > 0 || imagenSuelta
              ? "aspect-[4/5]"
              : incrusta
                ? proporcion
                : "h-28"
        }`}
      >
        {archivos.length > 0 ? (
          <div className="flex h-full snap-x snap-mandatory overflow-x-auto">
            {archivos.map((m) => (
              <div key={m.id} className="relative h-full w-full shrink-0 snap-center">
                {m.kind === "VIDEO" ? (
                  <video
                    src={m.url}
                    controls
                    playsInline
                    preload="metadata"
                    className="relative h-full w-full object-contain"
                  />
                ) : (
                  <>
                    {/* El mismo archivo, desenfocado, rellenando el fondo. La
                        pieza se ve entera —sin recortar, que acá se aprueba—
                        pero sin las franjas negras muertas a los lados. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={m.url}
                      alt=""
                      aria-hidden
                      loading="lazy"
                      className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-xl"
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={m.url}
                      alt=""
                      loading="lazy"
                      onClick={() => onPreviewImage(m.url)}
                      className="relative h-full w-full cursor-zoom-in object-contain"
                    />
                  </>
                )}
              </div>
            ))}
          </div>
        ) : incrusta ? (
          <iframe
            src={incrusta}
            loading="lazy"
            // Fondo blanco: es el de estas incrustaciones. Sobre el negro de
            // la tarjeta, una que tarde en cargar —o una publicación borrada,
            // que Instagram avisa en su propia página— se veía como un hueco
            // vacío y parecía que la app estaba rota.
            className="h-full w-full border-0 bg-white"
            allowFullScreen
            title={`Referencia de ${idea.title}`}
          />
        ) : imagenSuelta ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imagenSuelta}
              alt=""
              aria-hidden
              loading="lazy"
              className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-xl"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imagenSuelta}
              alt=""
              loading="lazy"
              onClick={() => onPreviewImage(imagenSuelta)}
              className="relative h-full w-full cursor-zoom-in object-contain"
            />
          </>
        ) : enlaceSuelto ? (
          // Instagram y todo lo que no se deja incrustar. Se dice qué es y se
          // ofrece abrirlo, en vez de un iframe que no va a pintar nada.
          <a
            href={enlaceSuelto}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-full w-full items-center justify-between gap-3 px-4 transition-opacity hover:opacity-90"
            style={
              red === "INSTAGRAM"
                ? {
                    background:
                      "linear-gradient(120deg, rgba(240,148,51,.25), rgba(220,39,67,.25), rgba(188,24,136,.25))",
                  }
                : undefined
            }
          >
            <span className="min-w-0">
              <span className="block text-[10px] uppercase tracking-wider text-zinc-400">
                Referencia
              </span>
              <span className="block truncate text-sm text-zinc-100">
                Verla en {platformLabel(red)}
              </span>
            </span>
            <ExternalLink className="h-4 w-4 shrink-0 text-zinc-300" aria-hidden />
          </a>
        ) : referencias.length > 0 ? (
          <div className="flex h-full snap-x snap-mandatory overflow-x-auto">
            {referencias.map((img) => (
              <div key={img.id} className="relative h-full w-full shrink-0 snap-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={ideaImageUrl(img.id)}
                  alt=""
                  aria-hidden
                  loading="lazy"
                  className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-xl"
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={ideaImageUrl(img.id)}
                  alt=""
                  loading="lazy"
                  onClick={() => onPreviewImage(ideaImageUrl(img.id))}
                  className="relative h-full w-full cursor-zoom-in object-contain"
                />
              </div>
            ))}
          </div>
        ) : (
          <span className="flex h-full w-full items-center justify-center gap-2 bg-white/[0.02] text-center">
            <ImageOff className="h-4 w-4 text-zinc-700" aria-hidden />
            <span className="text-xs text-zinc-500">Todavía por producir</span>
          </span>
        )}

        {archivos.length > 1 && (
          <span className="absolute right-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-zinc-200">
            {archivos.length} archivos
          </span>
        )}
      </div>

      {/* La incrustación se sirve **sin sesión iniciada**, así que Instagram la
          trata como visitante anónimo. Si esa cuenta limitó su audiencia —lo
          habitual es una restricción de edad— la bloquea, y encima lo reporta
          como "el enlace está dañado", que hace pensar que le pasamos algo
          roto. Al abrirla con sesión se ve sin problema.

          Comprobado con seis referencias: cuatro cargan y dos no, y esas dos
          fallan por `/p/`, `/reel/` y `/reels/` por igual, así que no es la
          ruta ni el tipo. No se puede detectar desde fuera —el iframe es de
          otro origen y no se deja leer—, de ahí que sólo se avise. */}
      {incrusta && red === "INSTAGRAM" && (
        <p className="px-4 pt-2 text-[11px] leading-relaxed text-zinc-600">
          Si acá dice que el enlace está dañado, la publicación existe: esa cuenta limitó quién
          puede ver su contenido y la vista previa entra sin sesión. Ábrela con el botón de abajo.
        </p>
      )}

      <div className="space-y-3 p-4">
        {/* ── Cuándo y qué es ── */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-zinc-400">
            {fecha(idea.dueDate)}
            {postTypeLabel(idea.postType) && (
              <span className="text-zinc-600">· {postTypeLabel(idea.postType)}</span>
            )}
            {/* En la línea de datos y no encima de la imagen: flotando tapaba
                el nombre de la cuenta en la cabecera de la incrustación. Y hace
                falta decirlo: un TikTok ajeno dentro de la tarjeta se lee como
                si fuera el contenido que le vamos a publicar. */}
            {archivos.length === 0 && hayAlgoQueVer && (
              <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-zinc-500">
                Lo de arriba es la referencia
              </span>
            )}
          </span>
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-zinc-300">
            {estadoEtiqueta[idea.status] ?? idea.status}
          </span>
        </div>

        <div>
          <h3 className="text-base font-semibold leading-snug text-zinc-100">
            {idea.title || "Sin título"}
          </h3>
          {idea.description && (
            <p className="mt-1 text-sm leading-relaxed text-zinc-400">{idea.description}</p>
          )}
        </div>

        {/* ── El copy: es lo que más se aprueba o se devuelve ── */}
        {idea.caption && (
          <div className="rounded-lg bg-white/[0.04] p-3">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-[11px] uppercase tracking-wider text-zinc-500">
                Texto de la publicación
              </span>
              <button
                type="button"
                onClick={copiar}
                className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-xs text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200"
              >
                <Copy className="h-3 w-3" /> {copiado ? "Copiado" : "Copiar"}
              </button>
            </div>
            <p
              className={`whitespace-pre-wrap text-sm leading-relaxed text-zinc-200 ${
                copyEntero ? "" : "line-clamp-4"
              }`}
            >
              {idea.caption}
            </p>
            {idea.caption.length > 180 && (
              <button
                type="button"
                onClick={() => setCopyEntero((v) => !v)}
                className="mt-1 text-xs text-zinc-400 underline underline-offset-2 hover:text-zinc-200"
              >
                {copyEntero ? "Ver menos" : "Ver más"}
              </button>
            )}
          </div>
        )}

        {/* ── El storyboard, acá y no en otra sección ──
            Estaba al final de la página y había que ir a buscarlo con un
            botón: el cliente leía la idea en un sitio y sus escenas en otro.

            Se enseña **sólo la primera escena**. Un storyboard se mira escena
            por escena, no de un vistazo: desplegar la tira entera dentro de la
            tarjeta llenaba de miniaturas ilegibles y empujaba hacia abajo lo
            demás. Se toca y se pasan dentro. */}
        {escenas.length > 0 && (
          <button
            type="button"
            onClick={() => setEscena(0)}
            className="group relative block w-full overflow-hidden rounded-lg border border-white/10 bg-black text-left"
          >
            <span className="flex aspect-video items-center justify-center">
              {escenas[0].hasImage ? (
                // Sin carga diferida: es la portada del storyboard y se ve de
                // entrada, así que esperar a que el navegador decida no aporta.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={panelImageUrl(escenas[0].id)}
                  alt={`${idea.storyboard?.title || "Storyboard"}, escena 1`}
                  className="h-full w-full object-cover transition-opacity group-hover:opacity-90"
                />
              ) : (
                <ImagePlus className="h-6 w-6 text-zinc-700" aria-hidden />
              )}
            </span>

            {/* Un velo abajo para que el texto se lea sobre cualquier foto. */}
            <span className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/85 to-transparent px-3 pb-2 pt-6">
              <Clapperboard className="h-3.5 w-3.5 shrink-0 text-zinc-300" aria-hidden />
              <span className="min-w-0 truncate text-xs text-zinc-100">
                {idea.storyboard?.title || "Storyboard"}
              </span>
              <span className="ml-auto shrink-0 rounded-full bg-white/15 px-2 py-0.5 text-[11px] text-white">
                {escenas.length} {escenas.length === 1 ? "escena" : "escenas"}
              </span>
            </span>

            <span className="absolute inset-0 flex items-center justify-center">
              <span className="rounded-full bg-black/50 p-2.5 opacity-90">
                <Maximize2 className="h-4 w-4 text-white" aria-hidden />
              </span>
            </span>
          </button>
        )}

        {/* ── Contexto: pilar, etiquetas, referencia ── */}
        {(idea.pilar || idea.contentIdeaTags.length > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {idea.pilar && (
              <span className="inline-flex items-center gap-1 rounded bg-white/5 px-1.5 py-0.5 text-xs text-zinc-400">
                <Hash size={10} /> {idea.pilar}
              </span>
            )}
            {idea.contentIdeaTags.map(({ tag }) => (
              <span
                key={tag.id}
                className="rounded px-1.5 py-0.5 text-xs"
                style={{ backgroundColor: `${tag.color}22`, color: tag.color }}
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}

        {/* El enlace de abajo sólo cuando arriba no se está mostrando ya:
            repetido dos veces en la misma tarjeta confunde más que ayuda. */}
        {idea.referenceUrl && !enlaceSuelto && (
          <div className="flex flex-wrap gap-2 text-xs">
            {idea.referenceUrl && !enlaceSuelto && (
              <a
                href={idea.referenceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-white/5 px-2.5 text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
              >
                <ExternalLink className="h-3.5 w-3.5" /> {platformLabel(idea.platform)}
              </a>
            )}

          </div>
        )}

        {/* ── Comentarios ── */}
        <div className="border-t border-white/5 pt-1">
          <button
            type="button"
            onClick={() => setAbierto(!abierto)}
            aria-expanded={abierto}
            className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm text-zinc-300 transition-colors hover:bg-white/5 hover:text-white"
          >
            <MessageSquare className="h-4 w-4" />
            {comentarios.length}{" "}
            {comentarios.length === 1 ? "comentario" : "comentarios"}
          </button>

          {abierto && (
            <div className="space-y-2 pt-1">
              {comentarios.length === 0 && (
                <p className="text-xs text-zinc-500">
                  Sin comentarios. Escribe lo que quieras cambiar de esta pieza.
                </p>
              )}
              {comentarios.map((c) => (
                <div key={c.id} className="rounded-lg border border-white/5 px-3 py-2">
                  <p className="text-xs font-medium text-zinc-300">{c.authorName}</p>
                  <p className="text-sm text-zinc-200">{c.text}</p>
                  <p className="text-[10px] text-zinc-500">
                    {new Date(c.createdAt).toLocaleString("es-EC")}
                  </p>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  className="h-10 min-w-0 flex-1 rounded-md border border-white/10 bg-[#18181b] px-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600 disabled:opacity-50"
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      comentar()
                    }
                  }}
                  placeholder="Escribe un comentario…"
                  disabled={enviando}
                />
                <button
                  type="button"
                  onClick={comentar}
                  disabled={enviando}
                  aria-label="Enviar comentario"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand text-white disabled:opacity-50"
                >
                  <Send className={`h-3.5 w-3.5 ${enviando ? "animate-pulse" : ""}`} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── El visor de escenas ──
          Se abre en la escena que se tocó y se pasa de una a otra sin salir:
          antes había que volver a la tira y acertarle a la miniatura de al
          lado, que en el celular es un blanco de 36 píxeles. */}
      {escena !== null && escenas[escena] && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-center bg-black"
          onClick={() => setEscena(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="flex items-center justify-between px-4 py-3 text-sm text-zinc-300"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="min-w-0 truncate">
              {idea.storyboard?.title || "Storyboard"}
              <span className="text-zinc-500">
                {" "}
                · Escena {escena + 1} de {escenas.length}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setEscena(null)}
              aria-label="Cerrar"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-zinc-400 hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div
            className="relative flex flex-1 items-center justify-center px-2"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => setTocado(e.touches[0].clientX)}
            onTouchEnd={(e) => {
              // 50px de umbral: por debajo de eso suele ser un toque con la
              // mano temblando, no una intención de pasar de escena.
              if (tocado === null) return
              const recorrido = e.changedTouches[0].clientX - tocado
              setTocado(null)
              if (recorrido < -50) setEscena((n) => (n === null ? n : Math.min(n + 1, escenas.length - 1)))
              if (recorrido > 50) setEscena((n) => (n === null ? n : Math.max(n - 1, 0)))
            }}
          >
            {escenas[escena].hasImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={panelImageUrl(escenas[escena].id)}
                alt={`Escena ${escena + 1}`}
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <ImagePlus className="h-10 w-10 text-zinc-700" aria-hidden />
            )}

            {escena > 0 && (
              <button
                type="button"
                onClick={() => setEscena(escena - 1)}
                aria-label="Escena anterior"
                className="absolute left-2 flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            )}
            {escena < escenas.length - 1 && (
              <button
                type="button"
                onClick={() => setEscena(escena + 1)}
                aria-label="Escena siguiente"
                className="absolute right-2 flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            )}
          </div>

          <div
            className="space-y-1 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            {escenas[escena].duration && (
              <p className="flex items-center gap-1 text-xs text-zinc-500">
                <Clock className="h-3 w-3" /> {escenas[escena].duration}
              </p>
            )}
            {escenas[escena].description && (
              <div
                className="prose prose-sm dark:prose-invert max-w-none text-sm text-zinc-300"
                dangerouslySetInnerHTML={{ __html: escenas[escena].description }}
              />
            )}
            {escenas[escena].notes && (
              <div
                className="prose prose-xs dark:prose-invert max-w-none text-xs text-zinc-500"
                dangerouslySetInnerHTML={{ __html: escenas[escena].notes }}
              />
            )}

            {/* Puntos de posición y una salida escrita. La X arriba, la tecla
                Escape y tocar el fondo también cierran, pero ninguna de las
                tres se ve: en el celular hay que poder salir sin adivinar. */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <span className="flex gap-1.5">
                {escenas.map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setEscena(i)}
                    aria-label={`Ir a la escena ${i + 1}`}
                    className={`h-1.5 rounded-full transition-all ${
                      i === escena ? "w-5 bg-zinc-200" : "w-1.5 bg-zinc-600 hover:bg-zinc-400"
                    }`}
                  />
                ))}
              </span>
              <button
                type="button"
                onClick={() => setEscena(null)}
                className="min-h-10 rounded-md px-3 text-xs text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-100"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  )
}

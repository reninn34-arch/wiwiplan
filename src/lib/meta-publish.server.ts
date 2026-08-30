import "server-only"

/**
 * Publicar en Instagram.
 *
 * No es una llamada: es una máquina de estados, y por tres razones que no se
 * pueden evitar.
 *
 * 1. Meta **descarga** el archivo de una URL pública en vez de recibirlo, así
 *    que primero hay que crear un "contenedor" apuntando a esa URL.
 * 2. El video **se procesa** del lado de Meta y eso tarda. Hay que preguntar
 *    hasta que termine, y puede pasarse del tiempo que dura una función sin
 *    servidor: por eso el contenedor se guarda y la corrida siguiente retoma.
 * 3. El carrusel necesita un contenedor **por archivo** más uno que los agrupa.
 *
 * Los cuatro formatos —imagen, carrusel, reel e historia— son cuatro caminos
 * distintos por eso, no por capricho.
 */

const GRAPH = "https://graph.facebook.com/v21.0"

/** Cuántas veces preguntar por el procesado dentro de una misma corrida. */
const POLL_TRIES = 5
const POLL_WAIT_MS = 3000

export type PublishKind = "IMAGE" | "CAROUSEL" | "REEL" | "STORY"

export interface PublishInput {
  instagramId: string
  token: string
  caption: string
  /** URLs públicas, en el orden en que deben salir. */
  mediaUrls: Array<{ url: string; isVideo: boolean }>
  /**
   * Si la pieza va como historia. No se deduce del archivo —una foto sirve
   * igual para el feed que para una historia—, así que viene del tipo elegido
   * en la planificación.
   */
  isStory?: boolean
}

export interface PublishProgress {
  /** Listo: la publicación existe en la red. */
  postId?: string
  /** Todavía procesando; se retoma en la corrida siguiente con este id. */
  containerId?: string
}

/**
 * De quién es la culpa cuando Meta rechaza algo. La distinción no es
 * académica: decide si insistir sirve de algo.
 *
 * - `contenido`: el archivo no le vale —formato, duración, proporción—.
 *   Reintentar lo mismo da lo mismo.
 * - `cuenta`: el token murió, faltan permisos, la cuenta está bloqueada. El
 *   contenido está perfecto; lo que hay que arreglar está fuera de la app.
 * - `temporal`: límite de uso o un tropiezo de Meta. Se pasa solo.
 */
export type PublishFailureKind = "contenido" | "cuenta" | "temporal"

/** Token muerto, permisos que faltan, sesión invalidada. */
const CODIGOS_DE_CUENTA = new Set([3, 10, 102, 190, 200, 463, 467])
/** Límite de uso o error pasajero del lado de Meta. */
const CODIGOS_TEMPORALES = new Set([1, 2, 4, 17, 32, 341, 613])

function clasificar(status: number, code?: number): PublishFailureKind {
  if (typeof code === "number") {
    if (CODIGOS_DE_CUENTA.has(code)) return "cuenta"
    if (CODIGOS_TEMPORALES.has(code)) return "temporal"
  }
  if (status >= 500) return "temporal"
  return "contenido"
}

export class MetaPublishError extends Error {
  readonly kind: PublishFailureKind

  /** `true` cuando reintentar no va a servir: el problema es el contenido. */
  readonly permanent: boolean

  constructor(message: string, kind: PublishFailureKind = "temporal") {
    super(message)
    this.name = "MetaPublishError"
    this.kind = kind
    this.permanent = kind === "contenido"
  }
}

async function post(path: string, params: Record<string, string>): Promise<Record<string, string>> {
  const res = await fetch(`${GRAPH}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
    cache: "no-store",
  })
  const data = await res.json()

  if (!res.ok) {
    const error = data?.error ?? {}
    const message = error.error_user_msg || error.message || `Meta respondió ${res.status}`
    throw new MetaPublishError(message, clasificar(res.status, error.code))
  }
  return data
}

async function get(path: string, params: Record<string, string>): Promise<Record<string, string>> {
  const res = await fetch(`${GRAPH}${path}?${new URLSearchParams(params)}`, { cache: "no-store" })
  const data = await res.json()
  if (!res.ok) {
    throw new MetaPublishError(
      data?.error?.message ?? `Meta respondió ${res.status}`,
      clasificar(res.status, data?.error?.code),
    )
  }
  return data
}

export function kindOf(mediaUrls: PublishInput["mediaUrls"], isStory = false): PublishKind {
  if (isStory) return "STORY"
  if (mediaUrls.length > 1) return "CAROUSEL"
  return mediaUrls[0]?.isVideo ? "REEL" : "IMAGE"
}

/** Crea el contenedor que Meta va a procesar. Devuelve su id. */
async function createContainer(input: PublishInput): Promise<string> {
  const { instagramId, token, caption, mediaUrls } = input
  const kind = kindOf(mediaUrls, input.isStory)

  if (kind === "STORY") {
    // Una historia es un archivo. Si hay varios no se publica el primero en
    // silencio: eso perdería los otros dos sin que nadie se entere. Se dice, y
    // la salida es una pieza por historia, que además es como se planifican.
    if (mediaUrls.length > 1) {
      throw new MetaPublishError(
        "Una historia sale de un solo archivo. Deja uno, o haz una pieza por cada historia.",
        "contenido",
      )
    }
    const archivo = mediaUrls[0]
    // Las historias no llevan pie de foto: Instagram no lo admite y mandarlo
    // hace fallar la llamada. El texto de la pieza sigue guardado para cuando
    // se publique a mano o se reutilice.
    const data = await post(`/${instagramId}/media`, {
      media_type: "STORIES",
      ...(archivo.isVideo ? { video_url: archivo.url } : { image_url: archivo.url }),
      access_token: token,
    })
    return data.id
  }

  if (kind === "IMAGE") {
    const data = await post(`/${instagramId}/media`, {
      image_url: mediaUrls[0].url,
      caption,
      access_token: token,
    })
    return data.id
  }

  if (kind === "REEL") {
    const data = await post(`/${instagramId}/media`, {
      media_type: "REELS",
      video_url: mediaUrls[0].url,
      caption,
      access_token: token,
    })
    return data.id
  }

  // Carrusel: cada archivo es su propio contenedor hijo, y después uno que los
  // agrupa. Meta no acepta más de diez.
  if (mediaUrls.length > 10) {
    throw new MetaPublishError("Un carrusel admite hasta 10 archivos", "contenido")
  }

  const children: string[] = []
  for (const media of mediaUrls) {
    const child = await post(`/${instagramId}/media`, {
      ...(media.isVideo ? { media_type: "VIDEO", video_url: media.url } : { image_url: media.url }),
      is_carousel_item: "true",
      access_token: token,
    })
    children.push(child.id)
  }

  const parent = await post(`/${instagramId}/media`, {
    media_type: "CAROUSEL",
    children: children.join(","),
    caption,
    access_token: token,
  })
  return parent.id
}

/** `true` cuando el contenedor ya está listo para publicarse. */
async function isReady(containerId: string, token: string): Promise<boolean> {
  const data = await get(`/${containerId}`, {
    fields: "status_code,status",
    access_token: token,
  })

  const status = data.status_code
  if (status === "FINISHED") return true
  if (status === "ERROR" || status === "EXPIRED") {
    throw new MetaPublishError(
      data.status || "Meta no pudo procesar el archivo. Revisa formato, duración y proporción.",
      "contenido",
    )
  }
  return false
}

/**
 * Avanza la publicación un paso. Devuelve el `postId` si quedó publicada, o el
 * `containerId` si Meta todavía está procesando y hay que volver más tarde.
 *
 * Recibir un `containerId` existente significa retomar: no se crea otro, para
 * no terminar publicando la misma pieza dos veces.
 */
export async function advancePublish(
  input: PublishInput,
  existingContainer?: string | null,
): Promise<PublishProgress> {
  if (input.mediaUrls.length === 0) {
    throw new MetaPublishError("La pieza no tiene ningún archivo que publicar", "contenido")
  }

  const containerId = existingContainer || (await createContainer(input))

  // La imagen suele estar lista enseguida; el video puede tardar minutos. Se
  // pregunta unas pocas veces y, si no terminó, se deja para la próxima corrida
  // en vez de agotar el tiempo de la función.
  for (let intento = 0; intento < POLL_TRIES; intento += 1) {
    if (await isReady(containerId, input.token)) {
      const published = await post(`/${input.instagramId}/media_publish`, {
        creation_id: containerId,
        access_token: input.token,
      })
      return { postId: published.id }
    }
    if (intento < POLL_TRIES - 1) {
      await new Promise((r) => setTimeout(r, POLL_WAIT_MS))
    }
  }

  return { containerId }
}

/**
 * Publicar en una página de Facebook.
 *
 * Es mucho más simple que Instagram: no hay contenedores ni espera de
 * procesado, la página devuelve el id de la entrada en la misma llamada. Pero
 * son tres caminos igual, porque Facebook trata cada caso por su lado:
 *
 * - Una foto va directa a `/photos`, con su texto como pie.
 * - Varias fotos se suben **sin publicar** y después se cuelgan de una entrada.
 *   Subirlas publicadas dejaría una publicación por foto en vez de un álbum.
 * - El video va a `/videos`, que además no admite mezclarse con fotos.
 */
export interface PagePublishInput {
  pageId: string
  token: string
  message: string
  mediaUrls: PublishInput["mediaUrls"]
  isStory?: boolean
}

export async function publishToPage(input: PagePublishInput): Promise<string> {
  const { pageId, token, message, mediaUrls } = input
  if (mediaUrls.length === 0) {
    throw new MetaPublishError("La pieza no tiene ningún archivo que publicar", "contenido")
  }

  if (input.isStory) {
    if (mediaUrls.length > 1) {
      throw new MetaPublishError(
        "Una historia sale de un solo archivo. Deja uno, o haz una pieza por cada historia.",
        "contenido",
      )
    }
    const archivo = mediaUrls[0]
    if (archivo.isVideo) {
      // El video de historia exige la subida por tramos de Meta, que es otro
      // protocolo entero. Decirlo es mejor que fallar con un error suyo que no
      // explica nada; en Instagram sí sale, y en Facebook queda asistida.
      throw new MetaPublishError(
        "Las historias de video en Facebook todavía no salen solas. Ponla en «Te avisamos».",
        "contenido",
      )
    }
    // Dos pasos: la foto se sube sin publicar y después se convierte en
    // historia. Subirla publicada dejaría además una entrada en el muro.
    const foto = await post(`/${pageId}/photos`, {
      url: archivo.url,
      published: "false",
      access_token: token,
    })
    const historia = await post(`/${pageId}/photo_stories`, {
      photo_id: foto.id,
      access_token: token,
    })
    return historia.post_id || historia.id
  }

  const video = mediaUrls.find((m) => m.isVideo)
  if (video) {
    if (mediaUrls.length > 1) {
      throw new MetaPublishError(
        "Facebook no admite video y fotos en la misma publicación. Deja sólo el video.",
        "contenido",
      )
    }
    const data = await post(`/${pageId}/videos`, {
      file_url: video.url,
      description: message,
      access_token: token,
    })
    return data.id
  }

  if (mediaUrls.length === 1) {
    const data = await post(`/${pageId}/photos`, {
      url: mediaUrls[0].url,
      caption: message,
      access_token: token,
    })
    // `post_id` es la entrada; `id` es la foto suelta. Interesa la entrada,
    // que es lo que la gente ve en la página.
    return data.post_id || data.id
  }

  const subidas: string[] = []
  for (const media of mediaUrls) {
    const foto = await post(`/${pageId}/photos`, {
      url: media.url,
      published: "false",
      access_token: token,
    })
    subidas.push(foto.id)
  }

  const data = await post(`/${pageId}/feed`, {
    message,
    attached_media: JSON.stringify(subidas.map((id) => ({ media_fbid: id }))),
    access_token: token,
  })
  return data.id
}

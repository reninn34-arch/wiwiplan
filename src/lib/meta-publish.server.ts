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
 * Los tres formatos son tres caminos distintos por eso, no por capricho.
 */

const GRAPH = "https://graph.facebook.com/v21.0"

/** Cuántas veces preguntar por el procesado dentro de una misma corrida. */
const POLL_TRIES = 5
const POLL_WAIT_MS = 3000

export type PublishKind = "IMAGE" | "CAROUSEL" | "REEL"

export interface PublishInput {
  instagramId: string
  token: string
  caption: string
  /** URLs públicas, en el orden en que deben salir. */
  mediaUrls: Array<{ url: string; isVideo: boolean }>
}

export interface PublishProgress {
  /** Listo: la publicación existe en la red. */
  postId?: string
  /** Todavía procesando; se retoma en la corrida siguiente con este id. */
  containerId?: string
}

export class MetaPublishError extends Error {
  /** `true` cuando reintentar no va a servir: el problema es el contenido. */
  readonly permanent: boolean

  constructor(message: string, permanent = false) {
    super(message)
    this.name = "MetaPublishError"
    this.permanent = permanent
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
    // Un 4xx que no sea límite de uso es del contenido: el formato, la duración,
    // la proporción. Reintentar lo mismo daría lo mismo.
    const permanent = res.status >= 400 && res.status < 500 && error.code !== 4 && error.code !== 17
    throw new MetaPublishError(message, permanent)
  }
  return data
}

async function get(path: string, params: Record<string, string>): Promise<Record<string, string>> {
  const res = await fetch(`${GRAPH}${path}?${new URLSearchParams(params)}`, { cache: "no-store" })
  const data = await res.json()
  if (!res.ok) {
    throw new MetaPublishError(data?.error?.message ?? `Meta respondió ${res.status}`)
  }
  return data
}

export function kindOf(mediaUrls: PublishInput["mediaUrls"]): PublishKind {
  if (mediaUrls.length > 1) return "CAROUSEL"
  return mediaUrls[0]?.isVideo ? "REEL" : "IMAGE"
}

/** Crea el contenedor que Meta va a procesar. Devuelve su id. */
async function createContainer(input: PublishInput): Promise<string> {
  const { instagramId, token, caption, mediaUrls } = input
  const kind = kindOf(mediaUrls)

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
    throw new MetaPublishError("Un carrusel admite hasta 10 archivos", true)
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
      true,
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
    throw new MetaPublishError("La pieza no tiene ningún archivo que publicar", true)
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

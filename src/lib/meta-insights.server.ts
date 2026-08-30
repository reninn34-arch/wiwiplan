import "server-only"

/**
 * Cómo le fue a una publicación, preguntándoselo a la red.
 *
 * La regla que ordena todo este archivo: **nunca devolver un cero inventado**.
 * Un dato que no vino se queda en `null`, y quien lo muestre dirá "—" en vez de
 * "0". Enseñarle a un cliente un alcance de cero porque nos faltaba un permiso
 * es peor que no enseñarle nada.
 *
 * De ahí que cada red se consulte en dos tramos: primero lo que se puede leer
 * con los permisos que ya hay —me gusta, comentarios— y después lo que exige
 * permiso de estadísticas. Si el segundo falla, el primero se conserva.
 */

const GRAPH = "https://graph.facebook.com/v21.0"

export interface PostMetrics {
  reach: number | null
  likes: number | null
  commentCount: number | null
  saves: number | null
  shares: number | null
  views: number | null
}

const VACIO: PostMetrics = {
  reach: null,
  likes: null,
  commentCount: null,
  saves: null,
  shares: null,
  views: null,
}

/** Lo que devuelve `/insights`: una lista de métricas con su valor. */
interface RespuestaInsights {
  data?: Array<{ name?: string; values?: Array<{ value?: unknown }> }>
}

/** Los campos sueltos de una publicación, según la red. */
interface CamposPublicacion {
  like_count?: number
  comments_count?: number
  media_product_type?: string
  likes?: { summary?: { total_count?: number } }
  comments?: { summary?: { total_count?: number } }
  shares?: { count?: number }
}

async function pedir<T>(path: string, params: Record<string, string>): Promise<T | null> {
  try {
    const res = await fetch(`${GRAPH}${path}?${new URLSearchParams(params)}`, {
      cache: "no-store",
    })
    const data = await res.json()
    if (!res.ok) {
      // No se lanza: que falte una mitad no puede tirar la otra. Se anota en
      // los registros porque un permiso ausente es invisible de otro modo.
      console.warn(`[insights] ${path}: ${data?.error?.message ?? res.status}`)
      return null
    }
    return data as T
  } catch (error) {
    console.warn(`[insights] ${path} no respondió:`, error)
    return null
  }
}

/** Convierte la lista de métricas de Meta en un objeto plano por nombre. */
function porNombre(data: RespuestaInsights): Record<string, number> {
  const salida: Record<string, number> = {}
  for (const fila of data?.data ?? []) {
    const valor = fila?.values?.[0]?.value
    if (fila?.name && typeof valor === "number") salida[fila.name] = valor
  }
  return salida
}

/**
 * Instagram. Los "me gusta" y comentarios son campos normales de la
 * publicación y no necesitan permiso de estadísticas; el alcance, los
 * guardados y las reproducciones sí.
 */
export async function instagramMetrics(mediaId: string, token: string): Promise<PostMetrics> {
  const metrics = { ...VACIO }

  const campos = await pedir<CamposPublicacion>(`/${mediaId}`, {
    fields: "like_count,comments_count,media_product_type",
    access_token: token,
  })
  if (campos) {
    if (typeof campos.like_count === "number") metrics.likes = campos.like_count
    if (typeof campos.comments_count === "number") metrics.commentCount = campos.comments_count
  }

  // `views` sólo existe en video; pedirla en una foto hace fallar la llamada
  // entera, así que la lista depende del tipo. Por eso se leyó antes.
  const esVideo = campos?.media_product_type === "REELS"
  const lista = ["reach", "saved", "shares", ...(esVideo ? ["views"] : [])]

  const stats = await pedir<RespuestaInsights>(`/${mediaId}/insights`, {
    metric: lista.join(","),
    access_token: token,
  })
  if (stats) {
    const v = porNombre(stats)
    if ("reach" in v) metrics.reach = v.reach
    if ("saved" in v) metrics.saves = v.saved
    if ("shares" in v) metrics.shares = v.shares
    if ("views" in v) metrics.views = v.views
  }

  return metrics
}

/**
 * Facebook. Los recuentos vienen de las propias aristas de la entrada y sólo
 * piden `pages_read_engagement`, que ya se tiene para publicar. El alcance
 * exige `read_insights`; si no está, se queda en nulo y lo demás sobrevive.
 */
export async function facebookMetrics(postId: string, token: string): Promise<PostMetrics> {
  const metrics = { ...VACIO }

  const campos = await pedir<CamposPublicacion>(`/${postId}`, {
    fields: "likes.summary(true).limit(0),comments.summary(true).limit(0),shares",
    access_token: token,
  })
  if (campos) {
    const likes = campos.likes?.summary?.total_count
    const comentarios = campos.comments?.summary?.total_count
    if (typeof likes === "number") metrics.likes = likes
    if (typeof comentarios === "number") metrics.commentCount = comentarios
    if (typeof campos.shares?.count === "number") metrics.shares = campos.shares.count
  }

  const stats = await pedir<RespuestaInsights>(`/${postId}/insights`, {
    metric: "post_impressions_unique",
    access_token: token,
  })
  if (stats) {
    const v = porNombre(stats)
    if ("post_impressions_unique" in v) metrics.reach = v.post_impressions_unique
  }

  return metrics
}

/** `true` si vino al menos un número: sirve para no pisar datos buenos con nada. */
export function tieneAlgo(m: PostMetrics): boolean {
  return Object.values(m).some((v) => v !== null)
}

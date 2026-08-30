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
    fields: "like_count,comments_count",
    access_token: token,
  })
  if (campos) {
    if (typeof campos.like_count === "number") metrics.likes = campos.like_count
    if (typeof campos.comments_count === "number") metrics.commentCount = campos.comments_count
  }

  // Se pide todo junto y, si Meta rechaza el conjunto, se reintenta sin
  // `views`. Antes se decidía por el tipo —sólo los reels la pedían— y era
  // falso: un carrusel del feed devolvió 746 reproducciones. Adivinar dejaba
  // fuera un dato que sí estaba.
  let stats = await pedir<RespuestaInsights>(`/${mediaId}/insights`, {
    metric: "reach,saved,shares,views",
    access_token: token,
  })
  if (!stats) {
    stats = await pedir<RespuestaInsights>(`/${mediaId}/insights`, {
      metric: "reach,saved,shares",
      access_token: token,
    })
  }
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
 * Facebook, que da bastante menos que Instagram y conviene saber por qué.
 *
 * Lo comprobado contra la API, no lo que dice la documentación:
 *
 * - `likes.summary` y `comments.summary` se rechazan con un error 10 aunque el
 *   token tenga `pages_read_engagement`; los recuentos de una entrada piden
 *   además `pages_read_user_content`, que no se pide para publicar.
 * - `post_impressions` y `post_impressions_unique` ya no son métricas válidas.
 *   **No hay alcance de entrada disponible**, y por eso se queda en nulo en vez
 *   de intentarlo y llenar los registros de avisos en cada actualización.
 * - Sí valen `post_reactions_by_type_total`, `post_clicks` y
 *   `post_video_views_organic`.
 */
export async function facebookMetrics(postId: string, token: string): Promise<PostMetrics> {
  const metrics = { ...VACIO }

  // `shares` viene como campo suelto y no da error; simplemente no aparece
  // cuando la entrada no tiene ninguno, que es lo mismo que cero.
  const campos = await pedir<CamposPublicacion>(`/${postId}`, {
    fields: "shares",
    access_token: token,
  })
  if (campos) {
    metrics.shares = typeof campos.shares?.count === "number" ? campos.shares.count : 0
  }

  const stats = await pedir<RespuestaInsights>(`/${postId}/insights`, {
    metric: "post_reactions_by_type_total,post_video_views_organic",
    access_token: token,
  })
  if (stats) {
    for (const fila of stats.data ?? []) {
      const valor = fila?.values?.[0]?.value
      // Las reacciones vienen desglosadas por tipo —me gusta, me encanta— y
      // lo que interesa es el total, así que se suman.
      if (fila?.name === "post_reactions_by_type_total" && valor && typeof valor === "object") {
        const total = Object.values(valor as Record<string, unknown>).filter(
          (n): n is number => typeof n === "number",
        )
        if (total.length > 0) metrics.likes = total.reduce((a, b) => a + b, 0)
      }
      if (fila?.name === "post_video_views_organic" && typeof valor === "number") {
        metrics.views = valor
      }
    }
  }

  return metrics
}

/** `true` si vino al menos un número: sirve para no pisar datos buenos con nada. */
export function tieneAlgo(m: PostMetrics): boolean {
  return Object.values(m).some((v) => v !== null)
}

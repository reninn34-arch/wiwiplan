import "server-only"
import { createHmac, timingSafeEqual } from "crypto"
import { publicAppUrl } from "@/lib/app-url"

/**
 * Conexión con Meta: autorizar una cuenta y averiguar con qué se publica.
 *
 * El modelo es una sola app —la de la agencia— y muchas cuentas conectadas,
 * como Metricool o Later. Nadie crea una app por cliente: el cliente sólo
 * autoriza desde su teléfono y guardamos su token.
 *
 * Y hay un límite que no depende de nosotros: **Instagram sólo publica por API
 * en cuentas Business o Creator**. En las personales no existe forma legítima,
 * y por eso el carril asistido no se va a poder retirar nunca del todo.
 */

const GRAPH = "https://graph.facebook.com/v21.0"

/**
 * Los permisos que se piden al autorizar. Lo mínimo para publicar: pedir de más
 * es la causa más común de que Meta rechace la revisión.
 *
 * Configurable por `META_SCOPES` a propósito. Meta tiene dos caminos vivos con
 * nombres distintos —el clásico por página de Facebook y el nuevo de Instagram
 * directo— y cuál acepta tu app depende de los productos que le agregaste. Un
 * "Invalid Scopes" no se arregla con código, se arregla probando el juego
 * correcto, y eso no debería costar un despliegue cada vez.
 */
const SCOPES_POR_DEFECTO = [
  "instagram_basic",
  "instagram_content_publish",
  "pages_show_list",
  "pages_read_engagement",
]

export const META_SCOPES = (process.env.META_SCOPES || SCOPES_POR_DEFECTO.join(","))
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
  .join(",")

export function metaConfigured(): boolean {
  return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET)
}

export function metaRedirectUri(): string {
  const base = publicAppUrl() ?? "http://localhost:3000"
  return `${base}/api/meta/callback`
}

/**
 * El `state` viaja hasta Meta y vuelve, así que va firmado: sin firma
 * cualquiera podría hacernos conectar una cuenta a la ficha equivocada.
 */
export function signState(payload: { accountId: string; userId: string }): string {
  const secret = process.env.AUTH_SECRET ?? ""
  const body = Buffer.from(
    JSON.stringify({ ...payload, exp: Date.now() + 10 * 60 * 1000 }),
  ).toString("base64url")
  const mac = createHmac("sha256", secret).update(body).digest("base64url")
  return `${body}.${mac}`
}

export function verifyState(state: string): { accountId: string; userId: string } | null {
  const [body, mac] = state.split(".")
  if (!body || !mac) return null

  const secret = process.env.AUTH_SECRET ?? ""
  const expected = createHmac("sha256", secret).update(body).digest("base64url")
  const a = Buffer.from(mac)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"))
    // Diez minutos: lo que tarda alguien en autorizar, no más. Un `state`
    // viejo reutilizado sería una autorización que nadie pidió ahora.
    if (typeof parsed?.exp !== "number" || parsed.exp < Date.now()) return null
    return { accountId: String(parsed.accountId), userId: String(parsed.userId) }
  } catch {
    return null
  }
}

/**
 * La URL a la que se manda a autorizar.
 *
 * Meta tiene dos formas y no son intercambiables:
 *
 * - **Inicio de sesión con Facebook para empresas** no acepta permisos sueltos.
 *   Espera el id de una *configuración* que se arma en el panel, con los
 *   permisos y los activos ya elegidos ahí dentro. Mandarle `scope` devuelve
 *   "Invalid Scopes" aunque los nombres sean correctos.
 * - **Inicio de sesión clásico** sí recibe la lista de permisos.
 *
 * Se elige por `META_CONFIG_ID`: si está, manda la configuración; si no, los
 * permisos. Cuál te toca depende de cómo quedó creada la app, y no hay forma de
 * saberlo desde el código.
 */
export function authorizeUrl(state: string): string {
  const configId = process.env.META_CONFIG_ID

  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID ?? "",
    redirect_uri: metaRedirectUri(),
    response_type: "code",
    state,
    ...(configId ? { config_id: configId } : { scope: META_SCOPES }),
  })
  return `https://www.facebook.com/v21.0/dialog/oauth?${params}`
}

async function graph<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = `${GRAPH}${path}?${new URLSearchParams(params)}`
  const res = await fetch(url, { cache: "no-store" })
  const data = await res.json()
  if (!res.ok) {
    const message = data?.error?.message ?? `Meta respondió ${res.status}`
    throw new Error(message)
  }
  return data as T
}

/** Cambia el código de la autorización por un token de corta duración. */
export async function exchangeCode(code: string): Promise<string> {
  const data = await graph<{ access_token: string }>("/oauth/access_token", {
    client_id: process.env.META_APP_ID ?? "",
    client_secret: process.env.META_APP_SECRET ?? "",
    redirect_uri: metaRedirectUri(),
    code,
  })
  return data.access_token
}

/**
 * Convierte el token corto en uno largo (~60 días). El corto dura horas: sin
 * este paso, la conexión se caería el mismo día y nadie sabría por qué.
 */
export async function longLivedToken(
  shortToken: string,
): Promise<{ token: string; expiresAt: Date | null }> {
  const data = await graph<{ access_token: string; expires_in?: number }>(
    "/oauth/access_token",
    {
      grant_type: "fb_exchange_token",
      client_id: process.env.META_APP_ID ?? "",
      client_secret: process.env.META_APP_SECRET ?? "",
      fb_exchange_token: shortToken,
    },
  )
  return {
    token: data.access_token,
    expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
  }
}

export interface ConnectableAccount {
  /** Id de la cuenta de Instagram Business: con esto se publica. */
  instagramId: string
  username: string
  pageId: string
  pageName: string
  /** El token de la página, que es el que sirve para publicar. */
  pageToken: string
}

/**
 * Las cuentas de Instagram que la persona que autorizó puede manejar.
 *
 * Devuelve varias a propósito: una agencia suele administrar las páginas de
 * todos sus clientes desde su propio Facebook, así que una sola autorización
 * puede traer seis cuentas y hay que elegir cuál es la de este cliente.
 */
export async function listConnectableAccounts(userToken: string): Promise<ConnectableAccount[]> {
  const data = await graph<{
    data: Array<{
      id: string
      name: string
      access_token: string
      instagram_business_account?: { id: string; username?: string }
    }>
  }>("/me/accounts", {
    access_token: userToken,
    fields: "id,name,access_token,instagram_business_account{id,username}",
    limit: "100",
  })

  return data.data
    .filter((page) => page.instagram_business_account?.id)
    .map((page) => ({
      instagramId: page.instagram_business_account!.id,
      username: page.instagram_business_account!.username ?? "",
      pageId: page.id,
      pageName: page.name,
      pageToken: page.access_token,
    }))
}

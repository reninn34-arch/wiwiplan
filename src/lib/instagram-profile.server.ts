import "server-only"
import { unseal } from "@/lib/secret-box.server"

/**
 * El perfil real de la cuenta, para que la simulación del feed no se parezca
 * al perfil del cliente: **sea** su perfil.
 *
 * El logo guardado en la app no sirve para esto. Suele ser el archivo del
 * manual de marca —vertical, con el nombre debajo, sobre su propio fondo— y
 * dentro de un círculo se ve como un rectángulo metido a la fuerza. La foto de
 * perfil de Instagram ya viene recortada por ellos y es la que la gente asocia
 * con la cuenta.
 */

export interface InstagramProfile {
  username: string
  name: string
  pictureUrl: string | null
  followers: number | null
  mediaCount: number | null
}

export async function fetchInstagramProfile(
  externalId: string,
  sealedToken: string | null,
): Promise<InstagramProfile | null> {
  const token = unseal(sealedToken)
  if (!token) return null

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${externalId}?` +
        new URLSearchParams({
          fields: "username,name,profile_picture_url,followers_count,media_count",
          access_token: token,
        }),
      // Una hora de caché: el enlace se abre muchas veces y el perfil no cambia
      // de un minuto a otro. Sin esto, cada visita del cliente sería una
      // llamada a Meta.
      { next: { revalidate: 3600 } },
    )
    const data = await res.json()
    if (!res.ok) {
      console.warn(`[perfil] ${externalId}: ${data?.error?.message ?? res.status}`)
      return null
    }

    return {
      username: data.username ?? "",
      name: data.name ?? "",
      // La URL viene firmada y caduca, así que no se guarda: se pide al
      // dibujar la página y se deja caducar con la caché.
      pictureUrl: data.profile_picture_url ?? null,
      followers: typeof data.followers_count === "number" ? data.followers_count : null,
      mediaCount: typeof data.media_count === "number" ? data.media_count : null,
    }
  } catch (error) {
    // Nunca lanza: que Meta no conteste no puede dejar al cliente sin ver su
    // parrilla. Se cae al logo guardado y ya.
    console.warn(`[perfil] ${externalId} no respondió:`, error)
    return null
  }
}

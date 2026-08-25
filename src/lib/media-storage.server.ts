import "server-only"
import { del } from "@vercel/blob"

/**
 * Dónde vive el archivo que se publica.
 *
 * Todo el trato con el almacenamiento pasa por acá a propósito: hoy es Vercel
 * Blob, pero R2 o S3 sirven igual y cambiar de proveedor tiene que ser tocar
 * este archivo, no media aplicación.
 *
 * La subida **no pasa por la API**: una función sin servidor de Vercel acepta
 * cuerpos de unos 4.5MB, así que un reel de 80MB por ahí es imposible. El
 * navegador sube directo al almacenamiento con un permiso firmado que emite el
 * servidor, y sólo el registro vuelve por la API.
 */

export const MEDIA_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const
export const MEDIA_VIDEO_TYPES = ["video/mp4", "video/quicktime"] as const

export const MEDIA_ALLOWED_TYPES: string[] = [...MEDIA_IMAGE_TYPES, ...MEDIA_VIDEO_TYPES]

/** Topes de cordura. Instagram acepta más, pero esto ya cubre cualquier pieza. */
export const MEDIA_MAX_IMAGE_BYTES = 15 * 1024 * 1024
export const MEDIA_MAX_VIDEO_BYTES = 300 * 1024 * 1024

export type MediaKind = "IMAGE" | "VIDEO"

export function kindOfContentType(contentType: string): MediaKind | null {
  if ((MEDIA_IMAGE_TYPES as readonly string[]).includes(contentType)) return "IMAGE"
  if ((MEDIA_VIDEO_TYPES as readonly string[]).includes(contentType)) return "VIDEO"
  return null
}

export function maxBytesFor(kind: MediaKind): number {
  return kind === "VIDEO" ? MEDIA_MAX_VIDEO_BYTES : MEDIA_MAX_IMAGE_BYTES
}

/** Prefijo por pieza: agrupa los archivos y permite validar de quién es cada uno. */
export function mediaPrefix(ideaId: string): string {
  return `ideas/${ideaId}/`
}

/**
 * Comprueba que la ruta sea de esta pieza. El navegador manda la ruta al
 * registrar, así que sin esto podría apuntar a un archivo ajeno.
 */
export function belongsToIdea(pathname: string, ideaId: string): boolean {
  return pathname.startsWith(mediaPrefix(ideaId))
}

/** Borra el archivo del almacenamiento. Nunca lanza: la fila ya se fue. */
export async function deleteStoredMedia(url: string): Promise<void> {
  try {
    const token = blobToken()
    await del(url, token ? { token } : undefined)
  } catch (error) {
    // Un archivo huérfano cuesta centavos; romper el borrado de la pieza por
    // eso cuesta más. Queda en el log para poder limpiarlo si se acumula.
    console.error("[media] No se pudo borrar del almacenamiento:", error)
  }
}

/**
 * El permiso de escritura del almacenamiento.
 *
 * Lo normal es `BLOB_READ_WRITE_TOKEN`, pero Vercel le pone prefijo cuando hay
 * más de un store —`MISTIENDA_READ_WRITE_TOKEN`— y entonces el nombre estándar
 * no existe. Buscar por el sufijo evita que todo falle por cómo se llame.
 */
export function blobToken(): string | undefined {
  if (process.env.BLOB_READ_WRITE_TOKEN) return process.env.BLOB_READ_WRITE_TOKEN

  for (const [name, value] of Object.entries(process.env)) {
    if (name.endsWith("_READ_WRITE_TOKEN") && value) return value
  }
  return undefined
}

/**
 * Si hay alguna posibilidad de que el almacenamiento funcione.
 *
 * No exige el token: la integración nueva de Vercel deja al SDK autenticarse
 * solo, y ahí sólo aparecen `BLOB_STORE_ID` y la llave del webhook. Comprobar
 * el token de más bloqueaba una configuración perfectamente válida.
 *
 * La regla que aprendimos: adivinar si algo va a fallar sale peor que dejarlo
 * fallar y contar bien el error. Sólo se corta cuando no hay **ninguna** señal
 * de almacenamiento configurado.
 */
export function storageConfigured(): boolean {
  return Boolean(blobToken() || process.env.BLOB_STORE_ID || process.env.VERCEL)
}

/**
 * Los **nombres** de las variables que parecen del almacenamiento. Sin valores:
 * sirve para decirle a quien configura si el token está con otro nombre, en vez
 * de dejarlo adivinando por qué no funciona.
 */
export function blobEnvNames(): string[] {
  return Object.keys(process.env).filter(
    (name) => name.includes("BLOB") || name.endsWith("_READ_WRITE_TOKEN"),
  )
}

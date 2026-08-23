import "server-only"
import sharp from "sharp"

/** Tope de lo que aceptamos recibir, antes de intentar procesarlo. */
const MAX_INPUT_BYTES = 25 * 1024 * 1024

/** Un SVG chico se guarda tal cual: rasterizarlo lo empeoraría. */
const MAX_SVG_BYTES = 200 * 1024

export class ImageError extends Error {}

export interface NormalizeOptions {
  /** Lado mayor en px. La imagen nunca se agranda. */
  maxSize?: number
  quality?: number
}

/**
 * Deja lista para guardar cualquier imagen que llegue: la escala y la reencoda
 * en WebP. El navegador ya comprime antes de subir, pero esto es la garantía:
 * nada pesado entra a la base aunque el cliente no haya podido comprimir.
 *
 * Los valores que no son data URL (por ejemplo el embed de un video) pasan sin
 * tocarse, y un string vacío significa "sin imagen".
 */
export async function normalizeImageDataUrl(
  value: string,
  { maxSize = 1600, quality = 82 }: NormalizeOptions = {},
): Promise<string> {
  if (!value || !value.startsWith("data:")) return value

  const match = /^data:([^;,]+);base64,([\s\S]*)$/.exec(value)
  if (!match) throw new ImageError("El formato de la imagen no es válido")

  const [, mime, base64] = match
  if (!mime.startsWith("image/")) throw new ImageError("El archivo no es una imagen")

  const input = Buffer.from(base64, "base64")
  if (input.byteLength > MAX_INPUT_BYTES) {
    throw new ImageError("La imagen es demasiado grande. Probá con uno menor a 25 MB")
  }

  if (mime === "image/svg+xml") {
    if (input.byteLength > MAX_SVG_BYTES) {
      throw new ImageError("Ese SVG es demasiado pesado")
    }
    return value
  }

  const resize = () =>
    sharp(input, { animated: true })
      .rotate() // respeta el EXIF del celular
      .resize({ width: maxSize, height: maxSize, fit: "inside", withoutEnlargement: true })

  let output: Buffer
  let outputMime = "image/webp"
  let oversized: boolean

  try {
    const { width = 0, height = 0, hasAlpha } = await sharp(input).metadata()
    oversized = width > maxSize || height > maxSize

    output = await resize().webp({ quality }).toBuffer()

    // Las imágenes muy texturizadas (pasto, arena, ruido) a veces pesan más en
    // WebP que en el formato original. Ahí gana JPEG, si no hay transparencia.
    if (output.byteLength > input.byteLength && !hasAlpha) {
      const jpeg = await resize().jpeg({ quality, mozjpeg: true }).toBuffer()
      if (jpeg.byteLength < output.byteLength) {
        output = jpeg
        outputMime = "image/jpeg"
      }
    }
  } catch {
    throw new ImageError("No pudimos procesar esa imagen. Probá con otro archivo")
  }

  // Una imagen fuera de medida siempre se reemplaza, aunque el reencodeo no
  // ahorre bytes: lo que no queremos guardar son 4000px para mostrar 400.
  // Si ya entraba en medida y encima era más liviana, se deja como estaba.
  if (!oversized && output.byteLength >= input.byteLength) return value

  return `data:${outputMime};base64,${output.toString("base64")}`
}

/** Igual que `normalizeImageDataUrl`, con el tamaño justo para un avatar. */
export function normalizeAvatarDataUrl(value: string): Promise<string> {
  return normalizeImageDataUrl(value, { maxSize: 256, quality: 85 })
}

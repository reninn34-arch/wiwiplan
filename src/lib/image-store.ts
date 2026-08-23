import { createHash } from "crypto"

export interface DecodedImage {
  mime: string
  buffer: Buffer
}

/** Convierte un data URL guardado en la base a bytes servibles. */
export function decodeDataUrl(value: string | null | undefined): DecodedImage | null {
  if (!value) return null

  const match = /^data:([^;,]+);base64,([\s\S]*)$/.exec(value)
  if (!match) return null

  try {
    return { mime: match[1], buffer: Buffer.from(match[2], "base64") }
  } catch {
    return null
  }
}

/**
 * Responde una imagen con ETag y revalidación. El navegador la guarda, pero
 * pregunta antes de usarla: si no cambió recibe un 304 vacío, y si el usuario
 * la reemplazó ve la nueva enseguida.
 */
export function imageResponse(image: DecodedImage, ifNoneMatch: string | null): Response {
  const etag = `"${createHash("sha1").update(image.buffer).digest("base64url")}"`

  if (ifNoneMatch === etag) {
    return new Response(null, {
      status: 304,
      headers: { ETag: etag, "Cache-Control": "private, no-cache" },
    })
  }

  return new Response(new Uint8Array(image.buffer), {
    status: 200,
    headers: {
      "Content-Type": image.mime,
      "Content-Length": String(image.buffer.byteLength),
      ETag: etag,
      "Cache-Control": "private, no-cache",
    },
  })
}

export function imageNotFound(): Response {
  return new Response(null, { status: 404 })
}

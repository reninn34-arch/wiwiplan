const DEFAULT_MAX_SIZE = 1600
const DEFAULT_QUALITY = 0.82

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result)
      else reject(new Error("No se pudo leer la imagen"))
    }
    reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer la imagen"))
    reader.readAsDataURL(file)
  })
}

/**
 * Reduce una imagen antes de guardarla: la escala a `maxSize` px de lado mayor
 * y la reencoda en WebP. Una foto de cámara pasa de varios MB a unos cientos de
 * KB, que es la diferencia entre un storyboard que abre al instante y uno que
 * tarda. Los formatos que no conviene reencodar (SVG, GIF animado) se dejan
 * como están.
 */
export async function compressImage(
  file: File,
  { maxSize = DEFAULT_MAX_SIZE, quality = DEFAULT_QUALITY } = {},
): Promise<string> {
  if (file.type === "image/svg+xml" || file.type === "image/gif") {
    return readAsDataUrl(file)
  }

  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext("2d")
    if (!ctx) return readAsDataUrl(file)

    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    const encoded = canvas.toDataURL("image/webp", quality)
    if (!encoded.startsWith("data:image/webp")) {
      return canvas.toDataURL("image/jpeg", quality)
    }
    return encoded
  } catch {
    return readAsDataUrl(file)
  }
}

/** Igual que `compressImage`, pero con el tamaño justo para un avatar. */
export function compressAvatar(file: File): Promise<string> {
  return compressImage(file, { maxSize: 256, quality: 0.85 })
}

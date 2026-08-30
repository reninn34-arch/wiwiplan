"use client"

import { useRef, useState } from "react"
import { upload } from "@vercel/blob/client"
import { toast } from "sonner"
import { Film, ImageIcon, Trash2, Upload } from "lucide-react"

/**
 * El archivo que se va a publicar de verdad.
 *
 * Sube **directo** al almacenamiento, sin pasar por la API: una función sin
 * servidor acepta unos 4.5MB de cuerpo y un reel nunca cabría. El servidor sólo
 * firma el permiso; los bytes viajan del navegador al almacenamiento.
 *
 * Es distinto de las imágenes de referencia de la pieza: aquellas sirven para
 * reconocerla, esto es lo que sale al aire.
 */

export interface MediaAssetRow {
  id: string
  url: string
  kind: string
  contentType: string
  sizeBytes: number
  order: number
}

interface Props {
  ideaId: string
  media: MediaAssetRow[]
  onChange: (media: MediaAssetRow[]) => void
}

const ACCEPT = "image/jpeg,image/png,image/webp,video/mp4,video/quicktime"

/**
 * El techo de imagen que aceptan las dos redes. Instagram admite 8 MB y
 * Facebook 10, así que 8 es el común: por encima, una red publica y la otra
 * no, que es exactamente lo que pasó —tres fotos salieron en Instagram y
 * Facebook rechazó el lote entero porque una pesaba 10.04 MB—.
 */
const MAX_IMAGE_BYTES = 8 * 1024 * 1024

/** Ninguna red muestra más lado que esto; de ahí para arriba son bytes tirados. */
const MAX_LADO = 2048

/**
 * Encoge una imagen sólo si se pasa del techo. Por debajo devuelve el archivo
 * intacto: no se toca el trabajo de nadie mientras se pueda publicar tal cual.
 *
 * Si el navegador no sabe hacerlo, devuelve el original y que sea la red quien
 * lo rechace: subir algo es mejor que perderlo por un fallo del canvas.
 */
async function encogerSiHaceFalta(file: File): Promise<{ file: File; encogida: boolean }> {
  if (!file.type.startsWith("image/") || file.size <= MAX_IMAGE_BYTES) {
    return { file, encogida: false }
  }

  try {
    const bitmap = await createImageBitmap(file)
    const escala = Math.min(1, MAX_LADO / Math.max(bitmap.width, bitmap.height))
    const ancho = Math.round(bitmap.width * escala)
    const alto = Math.round(bitmap.height * escala)

    const canvas = document.createElement("canvas")
    canvas.width = ancho
    canvas.height = alto
    const ctx = canvas.getContext("2d")
    if (!ctx) return { file, encogida: false }
    ctx.drawImage(bitmap, 0, 0, ancho, alto)
    bitmap.close()

    // Se baja la calidad por pasos y se para en cuanto entra: así la primera
    // que quepa es la mejor que cabía, en vez de comprimir de más por si acaso.
    for (const calidad of [0.92, 0.85, 0.75, 0.65]) {
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", calidad))
      if (blob && blob.size <= MAX_IMAGE_BYTES) {
        const nombre = file.name.replace(/\.[^.]+$/, "") + ".jpg"
        return { file: new File([blob], nombre, { type: "image/jpeg" }), encogida: true }
      }
    }
  } catch (error) {
    console.error("[media] No se pudo encoger la imagen:", error)
  }
  return { file, encogida: false }
}

function formatSize(bytes: number): string {
  if (bytes <= 0) return ""
  const mb = bytes / (1024 * 1024)
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export function MediaUploader({ ideaId, media, onChange }: Props) {
  const [progress, setProgress] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const uploading = progress !== null

  const uploadFile = async (original: File) => {
    if (uploading) return
    setProgress(0)
    try {
      const { file, encogida } = await encogerSiHaceFalta(original)
      if (encogida) {
        toast.info(
          `"${original.name}" pesaba ${formatSize(original.size)} y Facebook no admite más de 8 MB. ` +
            `Se guardó una versión de ${formatSize(file.size)}.`,
          { duration: 8000 },
        )
      }
      // La ruta lleva el id de la pieza porque el servidor la usa para
      // comprobar de quién es antes de firmar el permiso.
      const blob = await upload(`ideas/${ideaId}/${file.name}`, file, {
        access: "public",
        handleUploadUrl: "/api/media/upload",
        onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)),
      })

      // El aviso del almacenamiento no llega a localhost, así que el registro
      // se confirma desde acá. Es idempotente: si llegan los dos, no duplica.
      const res = await fetch("/api/media/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ideaId,
          url: blob.url,
          pathname: blob.pathname,
          contentType: file.type,
          sizeBytes: file.size,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error ?? "Se subió pero no se pudo registrar")
        return
      }

      onChange([...media, (await res.json()) as MediaAssetRow])
      toast.success("Archivo listo para publicar.")
    } catch (error) {
      // El mensaje real y no uno genérico: "no se pudo subir" no distingue
      // entre falta de token, tipo rechazado, archivo enorme o red caída, y
      // sin esa diferencia no hay forma de arreglar nada.
      console.error("[media] Falló la subida:", error)
      const detail = error instanceof Error ? error.message : ""

      // El almacenamiento privado rechaza la subida pública con un mensaje que
      // no dice qué hacer. Y tiene que ser público: Meta descarga el archivo de
      // esa URL, así que un store privado hace imposible publicar solo.
      if (detail.includes("private store") || detail.includes("private access")) {
        toast.error(
          "El almacenamiento está configurado como privado. Tiene que ser público para que las redes puedan descargar el archivo.",
        )
        return
      }

      toast.error(detail ? `No se pudo subir: ${detail}` : "No se pudo subir el archivo")
    } finally {
      setProgress(null)
    }
  }

  const remove = async (asset: MediaAssetRow) => {
    if (!confirm("¿Quitar este archivo? Se borra del almacenamiento.")) return
    const res = await fetch(`/api/media/${asset.id}`, { method: "DELETE" })
    if (!res.ok) {
      toast.error("No se pudo quitar")
      return
    }
    onChange(media.filter((m) => m.id !== asset.id))
  }

  return (
    <div>
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
        Archivo que se publica {media.length > 0 && `(${media.length})`}
      </p>

      {media.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {media.map((asset) => (
            <div
              key={asset.id}
              className="group relative h-24 w-24 overflow-hidden rounded-lg ring-1 ring-inset ring-white/10"
            >
              {asset.kind === "VIDEO" ? (
                <video
                  src={asset.url}
                  className="h-full w-full object-cover"
                  muted
                  playsInline
                  preload="metadata"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={asset.url} alt="" className="h-full w-full object-cover" />
              )}

              <span className="absolute left-1 top-1 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[9px] text-zinc-200">
                {asset.kind === "VIDEO" ? (
                  <Film className="h-2.5 w-2.5" aria-hidden />
                ) : (
                  <ImageIcon className="h-2.5 w-2.5" aria-hidden />
                )}
                {formatSize(asset.sizeBytes)}
              </span>

              <button
                type="button"
                onClick={() => remove(asset)}
                aria-label="Quitar el archivo"
                className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-md bg-black/70 text-zinc-300 opacity-0 transition-opacity hover:text-red-300 focus-visible:opacity-100 group-hover:opacity-100 max-sm:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          const file = e.dataTransfer.files?.[0]
          if (file) void uploadFile(file)
        }}
        className={`rounded-lg border border-dashed p-3 transition-colors ${
          dragging ? "border-brand bg-brand/10" : "border-white/10"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ""
            if (file) void uploadFile(file)
          }}
        />

        {uploading ? (
          <div>
            <p className="mb-1.5 text-xs text-zinc-300">Subiendo… {progress}%</p>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-brand transition-[width] duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-zinc-500">
              No cierres esta pantalla hasta que termine.
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex w-full items-center gap-2 text-left text-xs text-zinc-400 transition-colors hover:text-zinc-200"
          >
            <Upload className="h-4 w-4 shrink-0" aria-hidden />
            <span>
              {media.length === 0 ? "Sube el archivo" : "Agregar otro"}
              <span className="ml-1 text-zinc-600">
                — foto o video, arrástralo o tócalo
              </span>
            </span>
          </button>
        )}
      </div>

      {media.length > 1 && (
        <p className="mt-1.5 text-[11px] text-zinc-500">
          Varios archivos salen como carrusel, en el orden en que los subiste.
        </p>
      )}
    </div>
  )
}

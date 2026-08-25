import { NextRequest, NextResponse } from "next/server"
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import {
  MEDIA_ALLOWED_TYPES,
  MEDIA_MAX_VIDEO_BYTES,
  kindOfContentType,
  mediaPrefix,
  storageConfigured,
} from "@/lib/media-storage.server"

/**
 * Permiso para subir el archivo de una pieza.
 *
 * El archivo **no pasa por acá**: una función sin servidor de Vercel acepta
 * cuerpos de unos 4.5MB, así que un reel de 80MB nunca cabría. Esta ruta sólo
 * firma un permiso y el navegador sube directo al almacenamiento; después el
 * archivo se registra con `/api/media/confirm`.
 */
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  if (!storageConfigured()) {
    return NextResponse.json(
      { error: "Falta configurar el almacenamiento de archivos (BLOB_READ_WRITE_TOKEN)" },
      { status: 503 },
    )
  }

  const body = (await request.json()) as HandleUploadBody

  try {
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname) => {
        // `pathname` llega del navegador, así que la pieza se saca de ahí y se
        // comprueba contra la sesión: nadie puede subir al espacio de otro.
        const ideaId = pathname.split("/")[1] ?? ""
        const idea = await prisma.contentIdea.findFirst({
          where: { id: ideaId, planning: { userId: session.user!.id! } },
          select: { id: true },
        })
        if (!idea || !pathname.startsWith(mediaPrefix(ideaId))) {
          throw new Error("Esa pieza no es tuya")
        }

        return {
          allowedContentTypes: MEDIA_ALLOWED_TYPES,
          // El tope fino por tipo se aplica al registrar: acá sólo se corta lo
          // absurdo, porque el tipo real no se conoce hasta que sube.
          maximumSizeInBytes: MEDIA_MAX_VIDEO_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ ideaId }),
        }
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // El almacenamiento avisa cuando termina. En local no llega —no puede
        // alcanzar a localhost—, por eso el navegador confirma igual y el
        // registro es idempotente por `pathname`.
        const { ideaId } = JSON.parse(tokenPayload || "{}") as { ideaId?: string }
        const kind = kindOfContentType(blob.contentType ?? "")
        if (!ideaId || !kind) return

        await prisma.mediaAsset.upsert({
          where: { pathname: blob.pathname },
          update: {},
          create: {
            ideaId,
            url: blob.url,
            pathname: blob.pathname,
            kind,
            contentType: blob.contentType ?? "application/octet-stream",
            sizeBytes: 0,
            order: await prisma.mediaAsset.count({ where: { ideaId } }),
          },
        })
      },
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error al autorizar la subida:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo autorizar la subida" },
      { status: 400 },
    )
  }
}

/** Silencia el aviso de tamaño: el archivo nunca pasa por esta función. */
export const maxDuration = 30

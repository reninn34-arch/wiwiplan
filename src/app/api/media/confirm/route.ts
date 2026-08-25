import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { belongsToIdea, kindOfContentType, maxBytesFor } from "@/lib/media-storage.server"

/**
 * Registra un archivo ya subido. Lo llama el navegador al terminar la subida.
 *
 * Existe además del aviso del almacenamiento porque ese aviso **no llega a
 * localhost**: el almacenamiento no puede alcanzar tu máquina, así que en
 * desarrollo el archivo subiría y nunca quedaría registrado. Los dos caminos
 * son idempotentes por `pathname`, así que da igual si llegan los dos.
 */
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const ideaId = typeof body?.ideaId === "string" ? body.ideaId : ""
    const url = typeof body?.url === "string" ? body.url : ""
    const pathname = typeof body?.pathname === "string" ? body.pathname : ""
    const contentType = typeof body?.contentType === "string" ? body.contentType : ""
    const sizeBytes = Math.max(0, Math.round(Number(body?.sizeBytes) || 0))

    if (!ideaId || !url || !pathname) {
      return NextResponse.json({ error: "Faltan datos del archivo" }, { status: 400 })
    }

    // La ruta la manda el navegador: sin esto podría registrar como suyo un
    // archivo que vive en el espacio de otra pieza.
    if (!belongsToIdea(pathname, ideaId)) {
      return NextResponse.json({ error: "Ese archivo no es de esta pieza" }, { status: 400 })
    }

    const kind = kindOfContentType(contentType)
    if (!kind) {
      return NextResponse.json({ error: "Ese tipo de archivo no se puede publicar" }, { status: 400 })
    }
    if (sizeBytes > maxBytesFor(kind)) {
      const mb = Math.round(maxBytesFor(kind) / (1024 * 1024))
      return NextResponse.json({ error: `El archivo supera los ${mb}MB` }, { status: 400 })
    }

    const idea = await prisma.contentIdea.findFirst({
      where: { id: ideaId, planning: { userId: session.user.id } },
      select: { id: true, _count: { select: { media: true } } },
    })
    if (!idea) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 })
    }

    const asset = await prisma.mediaAsset.upsert({
      where: { pathname },
      // Si el aviso del almacenamiento llegó primero con tamaño 0, esta
      // confirmación lo completa en vez de crear una fila repetida.
      update: { url, contentType, sizeBytes, kind },
      create: {
        ideaId,
        url,
        pathname,
        kind,
        contentType,
        sizeBytes,
        order: idea._count.media,
      },
      select: { id: true, url: true, kind: true, contentType: true, sizeBytes: true, order: true },
    })

    return NextResponse.json(asset, { status: 201 })
  } catch (error) {
    console.error("Error al registrar el archivo:", error)
    return NextResponse.json({ error: "No se pudo registrar el archivo" }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { restoreAttemptsForIdea } from "@/lib/auto-publish.server"
import { auth } from "@/lib/auth"
import { deleteStoredMedia } from "@/lib/media-storage.server"

/** Quita el archivo de la pieza y del almacenamiento. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    const { assetId } = await params
    const asset = await prisma.mediaAsset.findFirst({
      where: { id: assetId, idea: { planning: { userId: session.user.id } } },
      select: { id: true, url: true, ideaId: true },
    })
    if (!asset) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 })
    }

    // Primero la fila: si el borrado del archivo falla, lo peor que queda es un
    // huérfano que cuesta centavos, no una pieza apuntando a algo que ya no está.
    await prisma.mediaAsset.delete({ where: { id: asset.id } })
    await deleteStoredMedia(asset.url)
    // Igual que al añadir: quitar un archivo cambia lo que se va a publicar,
    // así que un rechazo anterior por el contenido deja de aplicar.
    await restoreAttemptsForIdea(asset.ideaId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error al quitar el archivo:", error)
    return NextResponse.json({ error: "No se pudo quitar" }, { status: 500 })
  }
}

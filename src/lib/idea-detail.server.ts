import "server-only"
import type { Prisma } from "@/generated/prisma/client"

/**
 * La forma completa de una idea tal como la usa el mes: la tabla, el tablero y
 * el calendario leen de la misma lista.
 *
 * Existe para que crear, duplicar o pegar ideas devuelva exactamente lo mismo
 * que trae la página al abrirse. Antes el alta respondía la fila pelada, sin
 * `targets` ni `media`, y el calendario —que da por hecho que están— se caía
 * en cuanto se abría después de agregar una idea.
 */
export const ideaDetailInclude = {
  contentIdeaTags: { include: { tag: true } },
  comments: { orderBy: { createdAt: "asc" } },
  images: { orderBy: { order: "asc" }, select: { id: true, order: true } },
  targets: { select: { accountId: true, publishedAt: true } },
  media: {
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: { id: true, url: true, kind: true, contentType: true, sizeBytes: true, order: true },
  },
  storyboard: true,
} satisfies Prisma.ContentIdeaInclude

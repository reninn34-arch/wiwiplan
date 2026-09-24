/**
 * Una idea del mes tal como la usan Contenido, el editor y el calendario.
 */

export interface IdeaTag {
  id: string
  name: string
  color: string
}

export interface IdeaComment {
  id: string
  authorName: string
  text: string
  createdAt: string
  /** Lo escribió quien hizo el plan, respondiendo al cliente. */
  byOwner?: boolean
}

export interface Idea {
  id: string
  title: string
  description: string
  /** El texto que va en la publicación. Distinto de `description`, que es el brief. */
  caption: string
  pilar: string
  postType: string
  platform: string
  referenceUrl: string
  referenceEmbed: string
  status: string
  priority: string
  order: number
  /** El día en que sale. */
  dueDate: string | null
  /** La hora del reloj, "09:00". Vacío quiere decir que aún no tiene hora. */
  publishTime: string
  /** A qué redes del cliente sale, y si ya salió en cada una. */
  targets: Array<{ accountId: string; publishedAt: string | null }>
  /** El archivo que se publica. Distinto de `images`, que son referencias. */
  media: Array<{ id: string; url: string; kind: string; contentType: string; sizeBytes: number; order: number }>
  storyboardId: string | null
  storyboard: { id: string; title: string } | null
  contentIdeaTags: { tag: IdeaTag }[]
  comments: IdeaComment[]
  /** Meta de la galería: los bytes se sirven por URL (/api/idea-images/[id]). */
  images: Array<{ id: string; order: number }>
}

/**
 * Completa lo que una respuesta de la API pueda no traer. Las vistas dan por
 * hecho que las listas existen —el calendario hace `idea.targets.length`— y una
 * sola idea sin ellas tumbaba la pestaña entera.
 */
export function normalizeIdea(raw: Partial<Idea> & { id: string }): Idea {
  return {
    title: "",
    description: "",
    caption: "",
    pilar: "",
    postType: "OTHER",
    platform: "OTHER",
    referenceUrl: "",
    referenceEmbed: "",
    status: "IDEA",
    priority: "MEDIUM",
    order: 0,
    dueDate: null,
    publishTime: "",
    storyboardId: null,
    storyboard: null,
    ...raw,
    targets: raw.targets ?? [],
    media: raw.media ?? [],
    contentIdeaTags: raw.contentIdeaTags ?? [],
    comments: raw.comments ?? [],
    images: raw.images ?? [],
  }
}

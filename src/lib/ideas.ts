/**
 * Ayudantes de las ideas del mes que no tocan la base: se usan en el navegador.
 */

/** El recorrido de producción de una pieza, en orden. */
export const IDEA_STATUS_FLOW = ["IDEA", "SELECTED", "IN_PRODUCTION", "DONE"] as const

export const ideaStatusLabels: Record<string, string> = {
  IDEA: "Idea",
  SELECTED: "Seleccionada",
  IN_PRODUCTION: "En Producción",
  DONE: "Lista",
}

/** El paso siguiente de producción, o `null` si ya está lista. */
export function nextIdeaStatus(status: string): string | null {
  const i = IDEA_STATUS_FLOW.indexOf(status as (typeof IDEA_STATUS_FLOW)[number])
  if (i === -1 || i === IDEA_STATUS_FLOW.length - 1) return null
  return IDEA_STATUS_FLOW[i + 1]
}

/**
 * Minúsculas y sin tildes, para buscar como se escribe con apuro: "promocion"
 * tiene que encontrar "Promoción", y en el celular casi nadie pone la tilde.
 */
export function foldText(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()
}

/**
 * Una idea por línea, tal como vienen de una nota, un chat o una planilla.
 *
 * Se quitan las viñetas y la numeración de lista ("- ", "• ", "3. ", "4) ",
 * "[ ] "), que son formato de la nota y no parte del título. Un número pegado
 * al texto no es numeración: "2x1 los martes" sigue siendo "2x1 los martes".
 */
export function splitPastedIdeas(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/^\s*(?:[-*•·–—]|\d{1,3}[.)-]|\[[ xX]?\])\s+/, "")
        .trim(),
    )
    .filter((line) => line.length > 0)
    .map((line) => line.slice(0, 300))
}

/** Tope de Instagram para el texto de una publicación. */
export const CAPTION_LIMIT = 2200

/** Colores de tag: se reparten por nombre para que el mismo tag salga igual siempre. */
const TAG_PALETTE = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#8b5cf6", "#14b8a6", "#f97316", "#64748b"]

export function tagColorFor(name: string): string {
  let hash = 0
  for (const ch of foldText(name)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return TAG_PALETTE[hash % TAG_PALETTE.length]
}

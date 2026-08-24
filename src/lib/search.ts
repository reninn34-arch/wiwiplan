/**
 * Contrato de la búsqueda global, compartido por la API y el buscador. Vive
 * acá y no en la ruta para que el componente de cliente no importe nada de un
 * módulo de servidor, ni siquiera un tipo.
 */

export const SEARCH_MIN_LENGTH = 2

export interface SearchHit {
  kind: "client" | "planning" | "idea"
  id: string
  title: string
  /** Contexto para desambiguar: cliente, mes, o dónde vive la pieza. */
  subtitle: string
  /** Fragmento del texto que coincidió, si el match no fue en el título. */
  excerpt: string
  href: string
}

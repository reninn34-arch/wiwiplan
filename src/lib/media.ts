/**
 * Rutas y formas de los medios. Sin dependencias de servidor: este módulo lo
 * importan también los componentes cliente.
 */

/**
 * Campos de una escena sin `imageUrl`. La imagen se pide aparte a
 * /api/storyboard-panels/[id]/image, así el JSON no carga megabytes de base64.
 */
export const panelSelect = {
  id: true,
  storyboardId: true,
  sceneNumber: true,
  description: true,
  duration: true,
  notes: true,
  order: true,
} as const

export function panelImageUrl(panelId: string): string {
  return `/api/storyboard-panels/${panelId}/image`
}

export function clientLogoUrl(clientId: string): string {
  return `/api/clients/${clientId}/logo`
}

export function ideaImageUrl(imageId: string): string {
  return `/api/idea-images/${imageId}`
}

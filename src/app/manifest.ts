import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WiwiPlan",
    short_name: "WiwiPlan",
    description: "Crea y comparte planificaciones con tus clientes",
    start_url: "/",
    display: "standalone",
    // Splash de instalación: el mismo negro del icono y de la interfaz. Con el
    // rojo anterior, abrir la app era un salto de rojo a negro en cada arranque.
    background_color: "#09090b",
    theme_color: "#09090b",
    orientation: "portrait",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}

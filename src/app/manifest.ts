import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WiwiPlan",
    short_name: "WiwiPlan",
    description: "Crea y comparte planificaciones con tus clientes",
    start_url: "/",
    display: "standalone",
    // Splash de instalación: fondo del rojo de marca con el logo blanco encima.
    background_color: "#c42c33",
    theme_color: "#09090b",
    orientation: "portrait",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}

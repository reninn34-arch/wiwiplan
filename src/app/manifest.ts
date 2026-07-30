import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WiwiPlan",
    short_name: "WiwiPlan",
    description: "Crea y comparte planificaciones con tus clientes",
    start_url: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#09090b",
    orientation: "portrait",
    icons: [
      { src: "/pwa-icon.svg", sizes: "512x512", type: "image/svg+xml" },
      { src: "/pwa-icon.svg", sizes: "192x192", type: "image/svg+xml" },
      { src: "/pwa-icon.svg", sizes: "512x512", type: "image/svg+xml", purpose: "maskable" },
    ],
  }
}

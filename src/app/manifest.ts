import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WiwiPlan",
    short_name: "WiwiPlan",
    description: "Crea y comparte planificaciones con tus clientes",
    start_url: "/",
    display: "standalone",
    // Splash de instalación: el rojo exacto del arte del icono, tomado del
    // propio archivo. Así el icono no se ve como un recuadro pegado sobre otro
    // fondo, sino fundido con él.
    background_color: "#DB0A1D",
    theme_color: "#09090b",
    orientation: "portrait",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}

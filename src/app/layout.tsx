import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Toaster } from "sonner"
import { publicAppUrl } from "@/lib/app-url"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

const TITULO = "WiwiPlan - Planificaciones"
const OG_IMAGEN = "/icons/og.png?v=2"
const DESCRIPCION = "Crea y comparte planificaciones con tus clientes"

export const metadata: Metadata = {
  // Quien lee el enlace —WhatsApp, Facebook, iMessage— vive fuera y necesita
  // direcciones absolutas. Sin esta base, Next serviría "/icons/og.png" tal
  // cual y ningún lector sabría desde dónde bajarla.
  metadataBase: new URL(publicAppUrl() ?? "http://localhost:3000"),
  title: TITULO,
  description: DESCRIPCION,
  manifest: "/manifest.webmanifest",
  // Sin esto, cada app inventa la vista previa por su cuenta y termina
  // agarrando el icono: cuadrado, con esquinas recortadas, sin llenar el
  // recuadro. og.png es opaca y de 1200x630, la proporción que esperan.
  //
  // El `?v=` no es decoración: WhatsApp y Facebook guardan la previsualización
  // de cada enlace durante días, así que cambiar el archivo no basta para que
  // la vuelvan a bajar. Subir el número les da una dirección que no conocen.
  openGraph: {
    type: "website",
    siteName: "WiwiPlan",
    title: TITULO,
    description: DESCRIPCION,
    locale: "es_EC",
    images: [{ url: OG_IMAGEN, width: 1200, height: 630, alt: "WiwiPlan" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITULO,
    description: DESCRIPCION,
    images: [OG_IMAGEN],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "WiwiPlan",
  },
  icons: {
    icon: [
      { url: "/icons/favicon.ico", sizes: "48x48" },
      { url: "/icons/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
}

export const viewport: Viewport = {
  themeColor: "#09090b",
  // viewportFit cover + env(safe-area-inset-*) para que el header no quede
  // debajo del notch cuando la PWA corre a pantalla completa.
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body className="min-h-full">
        <Toaster richColors />
        {children}
        <script dangerouslySetInnerHTML={{
          __html: `
            if ("serviceWorker" in navigator) {
              window.addEventListener("load", () => {
                navigator.serviceWorker.register("/sw.js")
              })
            }
          `
        }} />
      </body>
    </html>
  )
}

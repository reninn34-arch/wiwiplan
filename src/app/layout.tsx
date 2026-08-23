import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Toaster } from "sonner"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "WiwiPlan - Planificaciones",
  description: "Crea y comparte planificaciones con tus clientes",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "WiwiPlan",
  },
  icons: {
    apple: "/pwa-icon.svg",
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
        <link rel="apple-touch-icon" href="/pwa-icon.svg" />
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

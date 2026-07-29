import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { auth } from "@/lib/auth"
import { NotificationBell } from "@/components/NotificationBell"
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
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const session = await auth()

  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        {session?.user?.id && (
          <div className="fixed right-4 top-4 z-50">
            <NotificationBell />
          </div>
        )}
        {children}
      </body>
    </html>
  )
}

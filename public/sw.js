const CACHE = "wiwiplan-v2"

self.addEventListener("install", () => {
  self.skipWaiting()
})

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      await Promise.all(
        (await caches.keys())
          .filter((k) => k !== CACHE)
          .map((k) => caches.delete(k)),
      )
      await self.clients.claim()
    })(),
  )
})

self.addEventListener("fetch", (e) => {
  const { request } = e

  // Sólo GET del mismo origen: las demás pasan sin interferir.
  if (request.method !== "GET") return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Las APIs jamás se cachean: los datos tienen que ser siempre frescos.
  if (url.pathname.startsWith("/api/")) return

  // Sólo assets estáticos se sirven cache-first; páginas y rutas dinámicas
  // van siempre a la red para no ver contenido viejo tras un deploy.
  const isStatic =
    url.pathname.startsWith("/_next/static/") ||
    /\.(?:svg|png|jpg|jpeg|gif|ico|webp|css|js|woff2?|webmanifest)$/.test(url.pathname)
  if (!isStatic) return

  e.respondWith(
    (async () => {
      try {
        const fresh = await fetch(request)
        if (fresh && fresh.ok) {
          const clone = fresh.clone()
          caches.open(CACHE).then((c) => c.put(request, clone))
        }
        return fresh
      } catch {
        const hit = await caches.match(request)
        // respondWith exige una Response válida: nunca undefined.
        return (
          hit ??
          new Response(null, { status: 503, statusText: "Offline" })
        )
      }
    })(),
  )
})

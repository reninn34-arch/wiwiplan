// Subir esta versión purga la caché anterior al activarse. Hay que hacerlo con
// cada cambio de iconos o de manifiesto, o el teléfono sigue mostrando los de
// antes por mucho que se despliegue.
const CACHE = "wiwiplan-v5"

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

  // La identidad de la app nunca se cachea. Los iconos y el manifiesto cambian
  // poquísimo, pero cuando cambian hay que verlos ya: cachearlos ahorraba unos
  // kilobytes y a cambio dejaba el icono viejo pegado aunque se reinstalara.
  if (url.pathname.startsWith("/icons/") || url.pathname.endsWith(".webmanifest")) return

  // Sólo assets estáticos se sirven cache-first; páginas y rutas dinámicas
  // van siempre a la red para no ver contenido viejo tras un deploy.
  const isStatic =
    url.pathname.startsWith("/_next/static/") ||
    /\.(?:svg|png|jpg|jpeg|gif|ico|webp|css|js|woff2?)$/.test(url.pathname)
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

/**
 * Avisos de publicación. Llegan aunque la app esté cerrada; al tocarlos, si ya
 * hay una ventana abierta se reusa en vez de abrir otra, que es lo que espera
 * cualquiera que tenga la app en la pantalla de inicio.
 */
self.addEventListener("push", (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = {}
  }

  const title = payload.title || "Toca publicar"
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: payload.tag || "wiwiplan-publicar",
      // Sin esto, dos avisos con la misma etiqueta se reemplazan en silencio y
      // el segundo pasa desapercibido.
      renotify: Boolean(payload.tag),
      data: { url: payload.url || "/agenda" },
    }),
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || "/agenda"

  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
      for (const client of all) {
        if (client.url.includes(self.location.origin)) {
          await client.focus()
          if ("navigate" in client) await client.navigate(target)
          return
        }
      }
      await self.clients.openWindow(target)
    })(),
  )
})

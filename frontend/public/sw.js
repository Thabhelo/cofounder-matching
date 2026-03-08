const CACHE_NAME = "cofounder-match-v1"
const STATIC_ASSETS = ["/", "/dashboard", "/discover", "/inbox", "/revisit", "/profile", "/settings"]

self.addEventListener("install", (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {})
    })
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  )
  self.clients.claim()
})

self.addEventListener("fetch", (event) => {
  // Only handle GET requests for same-origin navigation
  if (event.request.method !== "GET") return
  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return

  // API requests: network-first, don't cache
  if (url.pathname.startsWith("/api/") || url.hostname.includes("onrender.com")) return

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses for static assets
        if (response.ok && (event.request.destination === "document" || event.request.destination === "script" || event.request.destination === "style" || event.request.destination === "image")) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return response
      })
      .catch(() => {
        // Offline fallback: return cached version
        return caches.match(event.request).then((cached) => {
          if (cached) return cached
          // For navigation requests, show cached dashboard
          if (event.request.destination === "document") {
            return caches.match("/dashboard")
          }
        })
      })
  )
})

const SCOPE = self.registration.scope
const CACHE_PREFIX = `kibotalk-shell:${SCOPE}:`
const CACHE_NAME = `${CACHE_PREFIX}v1`
const SHELL_URLS = ['./', 'manifest.webmanifest', 'favicon.png', 'icon-192.png', 'icon-512.png']
  .map((path) => new URL(path, SCOPE).href)

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key)))),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET' || !request.url.startsWith(SCOPE)) return
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone()
          event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {}))
        }
        return response
      })
      .catch(async () => {
        const cache = await caches.open(CACHE_NAME)
        const cached = await cache.match(request)
        if (cached) return cached
        if (request.mode === 'navigate') return await cache.match(SCOPE) ?? Response.error()
        return Response.error()
      }),
  )
})

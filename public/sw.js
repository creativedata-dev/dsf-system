const CACHE = 'farmasign-v1'

const PRECACHE = [
  '/',
  '/dashboard',
  '/auth/login',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png',
]

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  const { request } = e
  const url = new URL(request.url)

  // Não cacheia chamadas de API nem recursos externos
  if (url.pathname.startsWith('/api/') || url.origin !== self.location.origin) return

  // Network-first para navegação (páginas sempre frescas)
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request).catch(() => caches.match('/dashboard') ?? caches.match('/'))
    )
    return
  }

  // Cache-first para assets estáticos
  e.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((res) => {
        if (res.ok) {
          const clone = res.clone()
          caches.open(CACHE).then((c) => c.put(request, clone))
        }
        return res
      })
    })
  )
})

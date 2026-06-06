// 秘密花园 Service Worker — 仅缓存静态资源，不缓存页面
const CACHE_NAME = 'garden-v2'
const STATIC_EXTS = ['.js', '.css', '.png', '.jpg', '.svg', '.ico', '.woff2', '.woff']

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => caches.delete(key)))
    })
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // 不拦截页面导航和 API 请求
  if (url.pathname.includes('/_next') || url.pathname.includes('/api')) return
  if (event.request.method !== 'GET') return

  // 只缓存静态资源文件
  const isStatic = STATIC_EXTS.some(ext => url.pathname.endsWith(ext))
  if (!isStatic) return

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetched = fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return response
      })
      return cached || fetched
    })
  )
})

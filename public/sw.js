// Lets Android Chrome offer "Install app" and receives notifications sent from <site>/admin → Notify (api/push.js).
// Caches nothing: every request goes to the network as usual.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('fetch', () => {})

self.addEventListener('push', (e) => {
  let d = {}
  try {
    d = e.data ? e.data.json() : {}
  } catch {
    d = { body: e.data ? e.data.text() : '' }
  }
  e.waitUntil(self.registration.showNotification(d.title || '찌부씰', { body: d.body || '', icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', data: { url: d.url || '/' } }))
})

// tap → bring the open app forward, or open it
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const w = wins.find((c) => new URL(c.url).origin === self.location.origin)
      return w ? w.focus() : self.clients.openWindow(e.notification.data.url)
    }),
  )
})

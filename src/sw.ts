/// <reference lib="webworker" />
/**
 * The app's service worker. It keeps the app's own files so the installed app opens at once and offline (the firm's
 * data always comes from Supabase), and shows the notifications the `push` edge function sends.
 */
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare const self: ServiceWorkerGlobalScope

// A new version waits until the person chooses Reload (UpdatePrompt sends this).
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting()
})

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

/** What the push edge function sends. */
interface PushMessage {
  title?: string
  body?: string
  /** A page in the app, such as /tasks?open=<id>. */
  url?: string
  /** Notifications with the same tag replace each other instead of piling up. */
  tag?: string
}

self.addEventListener('push', (event) => {
  let msg: PushMessage = {}
  try {
    msg = event.data?.json() ?? {}
  } catch {
    msg = { body: event.data?.text() }
  }
  // An alarm (a reminder or consultation coming up) stays on screen until it is dealt with, and buzzes a phone.
  const alarm = msg.tag?.startsWith('alarm-') ?? false
  const options: NotificationOptions & { renotify?: boolean; requireInteraction?: boolean; vibrate?: number[] } = {
    body: msg.body ?? '',
    icon: '/pwa-192x192.png',
    badge: '/badge-96x96.png',
    tag: msg.tag,
    data: { url: msg.url || '/' },
    ...(alarm && { requireInteraction: true, renotify: true, vibrate: [300, 150, 300, 150, 600] }),
  }
  // Every push must show a notification: Safari and Chrome stop delivering to apps that receive pushes silently.
  event.waitUntil(self.registration.showNotification(msg.title || 'Practice Manager', options))
})

// Tapping a notification opens its page: in the app window already open if there is one (the app moves there itself,
// so nothing half typed is lost to a reload), else in a new one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL((event.notification.data as { url?: string } | null)?.url ?? '/', self.location.origin)
  if (url.origin !== self.location.origin) return
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const open = windows.find((w) => new URL(w.url).origin === url.origin)
      if (open) {
        open.postMessage({ type: 'OPEN', path: url.pathname + url.search })
        await open.focus().catch(() => undefined)
        return
      }
      await self.clients.openWindow(url.href)
    })(),
  )
})

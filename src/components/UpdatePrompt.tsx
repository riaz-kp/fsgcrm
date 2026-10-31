import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useSyncStatus } from '../lib/sync'

const HOUR = 60 * 60 * 1000

/** People leave the app open for days, so look for a new version every hour and whenever it comes back on screen. */
function watchForUpdates(registration: ServiceWorkerRegistration) {
  const check = () => {
    if (navigator.onLine && !registration.installing) registration.update().catch(() => undefined)
  }
  window.setInterval(check, HOUR)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check()
  })
}

function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  return online
}

/**
 * A new version of the app has been downloaded and waits until the user reloads into it. Reloading clears the screen,
 * so it waits while changes are being saved, and is not offered offline, where the firm's work could not load again.
 */
export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({ onRegisteredSW: (_url, registration) => registration && watchForUpdates(registration) })
  const saving = useSyncStatus((s) => s.saving)
  const online = useOnline()
  const [reloading, setReloading] = useState(false)

  if (!needRefresh || !online) return null
  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-4 z-[55] mx-auto flex max-w-lg animate-pop-in items-center gap-4 rounded-xl bg-ink-900 px-4 py-3 text-[13px] text-white shadow-pop"
    >
      <p className="flex-1">A new version of Practice Manager is ready.</p>
      <button type="button" onClick={() => setNeedRefresh(false)} className="shrink-0 font-semibold text-ink-300 hover:text-white">
        Later
      </button>
      <button
        type="button"
        disabled={saving || reloading}
        onClick={() => {
          setReloading(true)
          void updateServiceWorker()
        }}
        className="shrink-0 font-semibold text-brand-200 hover:text-white disabled:opacity-60"
      >
        {saving ? 'Saving…' : reloading ? 'Reloading…' : 'Reload'}
      </button>
    </div>
  )
}

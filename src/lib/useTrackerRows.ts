import { useEffect } from 'react'
import { useStore } from '../store'
import { todayISO } from './format'
import { hasNewRows, missingTrackerRows } from './trackerRows'

/**
 * Gives every client the tracker rows their scopes call for: when the app opens, when a client is added or their
 * scopes change, and when a new month or year begins with the app left open. Used once, in the layout.
 */
export function useTrackerRows() {
  useEffect(() => {
    let timer: number | undefined
    const run = () => {
      const s = useStore.getState()
      if (!s.currentUserId) return
      const rows = missingTrackerRows(s, todayISO())
      if (hasNewRows(rows)) s.addTrackerRows(rows)
    }
    // Just after the change that prompted it, rather than in the middle of it.
    const soon = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(run, 0)
    }
    soon()
    const unsubscribe = useStore.subscribe((s, prev) => {
      if (s.clients !== prev.clients || s.currentUserId !== prev.currentUserId) soon()
    })
    const hourly = window.setInterval(soon, 60 * 60 * 1000)
    const onVisible = () => document.visibilityState === 'visible' && soon()
    window.addEventListener('focus', soon)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearTimeout(timer)
      unsubscribe()
      window.clearInterval(hourly)
      window.removeEventListener('focus', soon)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])
}

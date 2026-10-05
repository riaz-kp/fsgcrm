import { useState } from 'react'

/**
 * Like useState, but remembered in this browser: a sort order, a set of calendar filters.
 * Storage can be missing or blocked (private windows, previews), so it quietly falls back to the initial value.
 */
export function useStoredState<T>(key: string, initial: T, valid: (v: unknown) => v is T = (v): v is T => typeof v === typeof initial) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw === null) return initial
      const parsed: unknown = JSON.parse(raw)
      return valid(parsed) ? parsed : initial
    } catch {
      return initial
    }
  })
  const set = (next: T) => {
    setValue(next)
    try {
      localStorage.setItem(key, JSON.stringify(next))
    } catch {
      // Not remembered this time; the choice still applies on this page.
    }
  }
  return [value, set] as const
}

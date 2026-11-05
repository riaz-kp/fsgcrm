import { useSyncExternalStore } from 'react'

/** Light, dark, or whatever the device is set to. Chosen per device, not per person: one phone may be dark and the office PC light. */
export type ThemePick = 'light' | 'dark' | 'system'

const KEY = 'fsg-theme'
const system = window.matchMedia('(prefers-color-scheme: dark)')
const listeners = new Set<() => void>()

function stored(): ThemePick {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

let pick = stored()

/** Puts the theme on the page (public/theme.js does the same before the app loads). */
function apply() {
  const dark = pick === 'dark' || (pick === 'system' && system.matches)
  const root = document.documentElement
  // Colours change at once, not through each button's hover transition.
  root.classList.add('theme-switch')
  root.dataset.theme = dark ? 'dark' : 'light'
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('theme-switch')))
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#171a1e' : '#ffffff')
}

export function setTheme(next: ThemePick) {
  pick = next
  try {
    if (next === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, next)
  } catch {
    // Not remembered; it still applies until the page is closed.
  }
  apply()
  listeners.forEach((l) => l())
}

system.addEventListener('change', () => pick === 'system' && apply())
// Another tab changed it.
window.addEventListener('storage', (e) => {
  if (e.key !== KEY) return
  pick = stored()
  apply()
  listeners.forEach((l) => l())
})
apply()

export function useTheme(): ThemePick {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => pick,
  )
}

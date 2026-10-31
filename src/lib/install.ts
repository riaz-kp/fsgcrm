import { create } from 'zustand'

/** The offer to install the app that Chrome, Edge and Samsung Internet make (not in TypeScript's DOM types). */
interface InstallOffer extends Event {
  prompt(): Promise<unknown>
}

let offer: InstallOffer | null = null

/** Whether the browser has offered to install the app, so the menu can show "Install app". */
export const useInstall = create<{ canPrompt: boolean }>(() => ({ canPrompt: false }))

// The browser makes the offer once, soon after the page loads (and again on a later visit if it was turned down),
// so this module is imported by main.tsx before anything draws. The browser's own install button stays as it is.
window.addEventListener('beforeinstallprompt', (e) => {
  offer = e as InstallOffer
  useInstall.setState({ canPrompt: true })
})

window.addEventListener('appinstalled', () => {
  offer = null
  useInstall.setState({ canPrompt: false })
})

/** Show the browser's install prompt. An offer works once, and only straight from a click. */
export function install() {
  const shown = offer
  offer = null
  useInstall.setState({ canPrompt: false })
  shown?.prompt().catch(() => undefined)
}

/** An iPhone or iPad browser tab: no install prompt there, the app is added from the Share menu. iPadOS says it is a Mac. */
export function installsFromShareMenu(): boolean {
  const ua = navigator.userAgent
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  const installed = (navigator as Navigator & { standalone?: boolean }).standalone === true || matchMedia('(display-mode: standalone)').matches
  return ios && !installed
}

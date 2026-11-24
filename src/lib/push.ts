import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { installsFromShareMenu } from './install'

/**
 * Notifications on this device: Windows, macOS and Android browsers, and iPhone/iPad once the app is on the Home Screen.
 * The device's push subscription is saved for whoever is signed in; the database decides what to send (see the
 * push_notifications migration) and the `push` edge function sends it.
 */
export type PushState =
  /** This browser cannot get notifications at all. */
  | 'unsupported'
  /** iPhone/iPad in a Safari tab: notifications only work once the app is added to the Home Screen. */
  | 'install-first'
  /** The person said no; only the browser's site settings can undo that. */
  | 'blocked'
  | 'off'
  | 'on'

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  // The worker registers when the app opens; in development there is none.
  const reg = await navigator.serviceWorker.getRegistration()
  return reg ? navigator.serviceWorker.ready : null
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await registration()
  return reg ? reg.pushManager.getSubscription() : null
}

async function readState(): Promise<PushState> {
  if (installsFromShareMenu()) return 'install-first'
  if (!pushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'blocked'
  if (Notification.permission !== 'granted') return 'off'
  return (await currentSubscription()) ? 'on' : 'off'
}

/** A short name for the device, so a person can tell their devices apart. */
function deviceName(): string {
  const ua = navigator.userAgent
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'Device'
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : ''
  return browser ? `${browser} on ${os}` : os
}

function base64UrlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const b64 = (s + '='.repeat((4 - (s.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

function bytesToBase64Url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function save(sub: PushSubscription) {
  const json = sub.toJSON()
  const { error } = await supabase!.rpc('save_push_subscription', {
    p_endpoint: sub.endpoint,
    p_p256dh: json.keys?.p256dh ?? '',
    p_auth: json.keys?.auth ?? '',
    p_device: deviceName(),
  })
  if (error) throw new Error(error.message)
}

function installed(): boolean {
  return (navigator as Navigator & { standalone?: boolean }).standalone === true || matchMedia('(display-mode: standalone)').matches
}

/**
 * Where to let this site send notifications, for the browser and device in hand. Browsers often answer a request
 * without asking: Edge (by default) and Chrome (after a few "no"s) show only a small bell or crossed-out icon in the
 * address bar, and a site that was blocked once is never asked again.
 */
export function allowHelp(): string {
  const ua = navigator.userAgent
  const apple = /iPhone|iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  if (apple) return 'Open the iPhone/iPad Settings → Notifications → FSG, and turn on Allow Notifications.'
  if (/Android/.test(ua))
    return installed()
      ? 'Press and hold the FSG app icon → App info → Notifications, and allow them.'
      : 'Tap ⋮ → Settings → Site settings → Notifications, and allow this site. Or tap the icon left of the address.'
  if (installed()) return 'Click the ⋮ menu at the top of the app window → App info (or Site settings) → Notifications → Allow.'
  if (/Edg\//.test(ua)) return 'Click the bell (or the lock) in the address bar → Notifications → Allow.'
  if (/Firefox\//.test(ua)) return 'Click the icon left of the address → clear "Blocked" next to notifications, or allow them.'
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return 'Safari menu → Settings → Websites → Notifications, and set this site to Allow.'
  return 'Click the icon left of the address (a lock or two sliders) → turn Notifications on. If you see a crossed-out bell in the address bar, click it and choose Allow.'
}

/** Asks for permission (must run straight from a tap) and turns notifications on for this device. */
export async function enablePush(): Promise<void> {
  if (!supabase) throw new Error('Notifications work in the live app only.')
  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
  if (permission === 'denied') throw new Error(`Notifications are blocked for this site. ${allowHelp()} Then tap Turn on again.`)
  if (permission !== 'granted') throw new Error(`Your browser did not allow it. If no box appeared, it was held back: ${allowHelp()} Then tap Turn on again.`)
  const reg = await registration()
  if (!reg) throw new Error('The app is still getting ready on this device. Reload the page, then try again.')
  const { data: key, error } = await supabase.rpc('push_public_key')
  if (error) throw new Error(error.message)
  if (typeof key !== 'string' || !key) throw new Error('Notifications are not set up on the server yet.')
  let sub = await reg.pushManager.getSubscription()
  // A subscription made with another key (the keys were changed) cannot be used; start again.
  const current = sub?.options.applicationServerKey
  if (sub && current && bytesToBase64Url(current) !== key) {
    await sub.unsubscribe()
    sub = null
  }
  if (!sub) {
    try {
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(key) })
    } catch (e) {
      // Brave turns off the push service unless asked; some privacy settings and extensions do the same.
      const brave = 'brave' in navigator
      throw new Error(
        brave
          ? 'Brave blocks this by default: open brave://settings/privacy, turn on "Use Google services for push messaging", restart Brave and try again.'
          : `This browser could not register for notifications (${e instanceof Error ? e.message : String(e)}). Try Chrome or Edge, or the installed app.`,
      )
    }
  }
  await save(sub)
}

/** Turns notifications off for this device. Also run when signing out, so the next person here does not get them. */
export async function disablePush(): Promise<void> {
  const sub = await currentSubscription().catch(() => null)
  if (!sub) return
  if (supabase) await supabase.rpc('remove_push_subscription', { p_endpoint: sub.endpoint })
  await sub.unsubscribe().catch(() => undefined)
}

/** Sends a notification to this device only. */
export async function testPush(): Promise<void> {
  const sub = await currentSubscription()
  if (!sub || !supabase) throw new Error('Notifications are off on this device.')
  const { error } = await supabase.functions.invoke('push', { body: { action: 'test', endpoint: sub.endpoint } })
  if (error) {
    const detail = await (error as { context?: Response }).context?.json?.().catch(() => null)
    throw new Error((detail as { error?: string } | null)?.error ?? error.message)
  }
}

/**
 * On opening the app with notifications allowed, save the device's subscription again: it may have changed, or
 * someone else may have used this device since.
 */
export async function refreshPush(): Promise<void> {
  if (!supabase || !pushSupported() || Notification.permission !== 'granted') return
  const sub = await currentSubscription()
  if (sub) await save(sub)
}

/** This device's notification state, kept up to date. */
export function usePushState(): [PushState | null, () => void] {
  const [state, setState] = useState<PushState | null>(null)
  const refresh = useCallback(() => {
    readState().then(setState, () => setState('unsupported'))
  }, [])
  useEffect(refresh, [refresh])
  return [state, refresh]
}

/**
 * Mounted once in the signed-in app: refreshes this device's subscription, and opens the page of a notification
 * tapped while the app is already open (the service worker asks; moving in the app keeps anything half typed).
 */
export function usePushInApp(open: ((path: string) => void) | null) {
  useEffect(() => {
    if (!open) return
    refreshPush().catch(() => undefined)
    if (!('serviceWorker' in navigator)) return
    const onMessage = (e: MessageEvent) => {
      const data = e.data as { type?: string; path?: string } | null
      if (data?.type === 'OPEN' && typeof data.path === 'string' && data.path.startsWith('/')) open(data.path)
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [open])
}

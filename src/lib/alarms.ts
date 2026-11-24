/**
 * Alarms: a reminder or consultation set to ring some minutes before its time. While the app is open (in any tab)
 * it pops up a card with a sound, and shows a system notification when the app is not in front. With the app
 * closed, the database's alarm job sends the same thing as a push notification (see the alarms migration), tagged
 * alike so a device that gets both shows one.
 */

export const ALARM_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0, label: 'At the time' },
  { value: 1, label: '1 minute before' },
  { value: 2, label: '2 minutes before' },
  { value: 3, label: '3 minutes before' },
  { value: 5, label: '5 minutes before' },
  { value: 10, label: '10 minutes before' },
  { value: 15, label: '15 minutes before' },
  { value: 30, label: '30 minutes before' },
  { value: 60, label: '1 hour before' },
  { value: 120, label: '2 hours before' },
  { value: 1440, label: '1 day before' },
]

export function alarmLabel(min: number | undefined): string {
  if (min === undefined) return 'No alarm'
  return ALARM_OPTIONS.find((o) => o.value === min)?.label ?? `${min} minutes before`
}

/** A date and HH:MM time on this device's clock, as milliseconds. */
export function at(date: string, time: string): number {
  return new Date(`${date}T${time}:00`).getTime()
}

/* ---------- What has rung on this device ---------- */

const RUNG_KEY = 'fsg-alarms'

/** key -> when it may ring again (ms). A dismissed alarm is held off for a few days, by which time it has passed. */
type Rung = Record<string, number>

export function readRung(): Rung {
  try {
    const raw = JSON.parse(localStorage.getItem(RUNG_KEY) ?? '{}') as Rung
    const now = Date.now()
    return Object.fromEntries(Object.entries(raw).filter(([, v]) => typeof v === 'number' && v > now - 864e5))
  } catch {
    return {}
  }
}

/** Holds an alarm off until `until` (a snooze), or for good. */
export function markRung(key: string, until: number | 'dismissed') {
  const r = readRung()
  r[key] = until === 'dismissed' ? Date.now() + 4 * 864e5 : until
  try {
    localStorage.setItem(RUNG_KEY, JSON.stringify(r))
  } catch {
    /* private window: alarms just ring again after a reload */
  }
}

/* ---------- Sound ---------- */

const SOUND_KEY = 'fsg-alarm-sound'

export function soundOn(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off'
  } catch {
    return true
  }
}

export function setSoundOn(on: boolean) {
  try {
    localStorage.setItem(SOUND_KEY, on ? 'on' : 'off')
  } catch {
    /* kept for this visit only */
  }
}

let ctx: AudioContext | null = null

/**
 * Browsers only let a page make sound after the person has tapped or typed on it, so the audio is set up on the
 * first touch and kept ready. Called once when the app starts.
 */
export function primeSound() {
  const unlock = () => {
    try {
      ctx ??= new AudioContext()
      if (ctx.state === 'suspended') void ctx.resume()
    } catch {
      /* no audio on this device */
    }
  }
  for (const ev of ['pointerdown', 'keydown', 'touchstart'] as const) window.addEventListener(ev, unlock, { passive: true })
}

function tone(freq: number, start: number, length: number, volume = 0.25) {
  if (!ctx) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(volume, start + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.001, start + length)
  osc.connect(gain).connect(ctx.destination)
  osc.start(start)
  osc.stop(start + length + 0.05)
}

/** A short two-note chime, for a task given to you. */
export function chime() {
  if (!soundOn() || !ctx) return
  if (ctx.state === 'suspended') void ctx.resume()
  const t = ctx.currentTime + 0.02
  tone(880, t, 0.35, 0.2)
  tone(1320, t + 0.16, 0.5, 0.2)
}

/** One round of the alarm: three quick beeps. */
function beeps() {
  if (!ctx) return
  if (ctx.state === 'suspended') void ctx.resume()
  const t = ctx.currentTime + 0.02
  for (let i = 0; i < 3; i++) tone(i === 2 ? 1175 : 988, t + i * 0.22, 0.18, 0.3)
}

let ringing: number | undefined
let stopAt = 0

/** Starts the alarm sound, repeating until stopped or for about a minute. Whether it is heard needs `primeSound`. */
export function startRinging() {
  if (!soundOn()) return
  stopAt = Date.now() + 60_000
  if (ringing !== undefined) return
  beeps()
  ringing = window.setInterval(() => {
    if (Date.now() > stopAt) stopRinging()
    else beeps()
  }, 1400)
}

export function stopRinging() {
  if (ringing !== undefined) window.clearInterval(ringing)
  ringing = undefined
}

/** Whether a page sound can play now: false until the person has tapped the page once since it opened. */
export function soundReady(): boolean {
  return ctx?.state === 'running'
}

/* ---------- System notifications ---------- */

/** Asks to show notifications, if it was never asked. Must run straight from a tap. */
export function askToNotify() {
  if ('Notification' in window && Notification.permission === 'default') void Notification.requestPermission().catch(() => undefined)
}

/**
 * Shows a notification from the page itself (the app is open but not in front). Goes through the service worker
 * when there is one, since Android only allows that; tapping it opens `url` in the app.
 */
export async function notifyHere(title: string, body: string, tag: string, url: string, sticky: boolean) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  const options: NotificationOptions & { renotify?: boolean; requireInteraction?: boolean } = {
    body,
    tag,
    icon: '/pwa-192x192.png',
    badge: '/badge-96x96.png',
    data: { url },
    requireInteraction: sticky,
    renotify: true,
  }
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined
    if (reg) await reg.showNotification(title, options)
    else {
      const n = new Notification(title, options)
      n.onclick = () => {
        window.focus()
        window.dispatchEvent(new CustomEvent('fsg-open', { detail: url }))
        n.close()
      }
    }
  } catch {
    /* the popup in the app is still there */
  }
}

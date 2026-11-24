import { AlarmClock, BellRing, Check, ClipboardCheck, Clock, ListTodo, Volume2, VolumeX, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { at, chime, markRung, notifyHere, primeSound, readRung, setSoundOn, soundOn, soundReady, startRinging, stopRinging } from '../lib/alarms'
import { addDays, cn, fmtDate, fmtTime, todayISO } from '../lib/format'
import { consultationPeople, useCurrentUser, useReminderOccurrences, useStore } from '../store'

/**
 * Popups in the corner of the app: alarms on reminders and consultations (with a sound that repeats until they are
 * dealt with), and a chime for work that has just come to you — a task given to you, one sent for your approval,
 * a reminder someone set for you. Mounted once, in the layout.
 */

interface Pop {
  key: string
  kind: 'reminder' | 'consultation' | 'task' | 'review' | 'note'
  title: string
  body: string
  url: string
  /** An alarm rings and offers snooze; the rest just chime once. */
  alarm: boolean
  /** Ticks off a reminder's date. */
  tick?: () => void
}

interface Alarm extends Pop {
  /** When it rings, when the thing itself starts, and when it is too late to ring. */
  ring: number
  start: number
  end: number
}

const SNOOZE_MIN = 5

primeSound()

function when(date: string, time: string): string {
  const today = todayISO()
  const day = date === today ? 'today' : date === addDays(today, 1) ? 'tomorrow' : fmtDate(date)
  return `${fmtTime(time)} ${day}`
}

/** Names by id, steady between renders while the lists are. */
function useNames() {
  const employees = useStore((s) => s.employees)
  const clients = useStore((s) => s.clients)
  return useMemo(() => {
    const e = new Map(employees.map((x) => [x.id, x.name]))
    const c = new Map(clients.map((x) => [x.id, x.name]))
    return { emp: (id?: string) => (id ? e.get(id) : undefined), client: (id?: string) => (id ? c.get(id) : undefined) }
  }, [employees, clients])
}

/** Every alarm set for this person from yesterday to two days on (the longest alarm is a day ahead). */
function useMyAlarms(today: string): Alarm[] {
  const me = useCurrentUser()
  const occurrences = useReminderOccurrences(addDays(today, -1), addDays(today, 2))
  const consultations = useStore((s) => s.consultations)
  const employees = useStore((s) => s.employees)
  const toggleReminderDone = useStore((s) => s.toggleReminderDone)
  const { client, emp } = useNames()

  return useMemo(() => {
    const out: Alarm[] = []
    for (const o of occurrences) {
      const r = o.reminder
      if (o.done || !r.time || r.alarm === undefined) continue
      const start = at(o.date, r.time)
      out.push({
        key: `r-${r.id}-${o.date}-${r.time}-${r.alarm}`,
        kind: 'reminder',
        title: r.title,
        body: [`Reminder · ${when(o.date, r.time)}`, client(r.clientId), r.note].filter(Boolean).join(' · '),
        url: `/calendar?date=${o.date}`,
        alarm: true,
        tick: () => toggleReminderDone(r.id, o.date),
        ring: start - r.alarm * 60_000,
        start,
        end: start + 60 * 60_000,
      })
    }
    for (const c of consultations) {
      if (c.status !== 'scheduled' || c.alarm === undefined || c.date < addDays(today, -1) || c.date > addDays(today, 2)) continue
      const people = consultationPeople(c, employees)
      if (!people.includes(me.id)) continue
      const start = at(c.date, c.time)
      const others = people.filter((id) => id !== me.id).map((id) => emp(id)).filter(Boolean)
      out.push({
        key: `c-${c.id}-${c.date}-${c.time}-${c.alarm}`,
        kind: 'consultation',
        title: `Consultation: ${c.withName}`,
        body: [`${when(c.date, c.time)} · ${c.mode}`, c.topic, others.length ? `with ${others.join(' & ')}` : ''].filter(Boolean).join(' · '),
        url: '/consultations',
        alarm: true,
        ring: start - c.alarm * 60_000,
        start,
        end: start + Math.max(c.durationMin, 30) * 60_000,
      })
    }
    return out
  }, [occurrences, consultations, employees, me, client, emp, toggleReminderDone, today])
}

/* ---------- Work that has just come to you ---------- */

const seenKey = (id: string) => `fsg-seen-${id}`

function readSeen(id: string): Set<string> | null {
  try {
    const raw = localStorage.getItem(seenKey(id))
    return raw ? new Set(JSON.parse(raw) as string[]) : null
  } catch {
    return null
  }
}

function writeSeen(id: string, keys: Set<string>) {
  try {
    localStorage.setItem(seenKey(id), JSON.stringify([...keys]))
  } catch {
    /* pops again next visit */
  }
}

/**
 * New things for this person since they last had the app open: each is a key that holds while the thing is true
 * ("task t1 is mine"), and a key not seen before pops up. A key that stops holding is forgotten, so a task passed
 * away and back, or sent for approval a second time, pops again. The first time on a device only notes what is there.
 */
function useArrivals(onNew: (pops: Pop[]) => void) {
  const me = useCurrentUser()
  const tasks = useStore((s) => s.tasks)
  const reminders = useStore((s) => s.reminders)
  const { client, emp } = useNames()

  useEffect(() => {
    const now: Map<string, Pop> = new Map()
    for (const t of tasks) {
      if (t.status === 'completed') continue
      const about = [client(t.clientId), `due ${fmtDate(t.dueDate)}`].filter(Boolean).join(' · ')
      if (t.assigneeId === me.id && t.assignedById !== me.id)
        now.set(`a:${t.id}`, {
          key: `a:${t.id}`,
          kind: 'task',
          title: `New task: ${t.title}`,
          body: [about, `from ${emp(t.assignedById) ?? 'someone'}`].join(' · '),
          url: `/tasks?open=${t.id}`,
          alarm: false,
        })
      if (t.status === 'in_review' && t.assignedById === me.id && t.assigneeId !== me.id)
        now.set(`v:${t.id}`, {
          key: `v:${t.id}`,
          kind: 'review',
          title: `Ready for your approval: ${t.title}`,
          body: [about, `by ${emp(t.assigneeId) ?? 'someone'}`].join(' · '),
          url: `/tasks?open=${t.id}`,
          alarm: false,
        })
    }
    for (const r of reminders) {
      if (r.forId !== me.id || r.createdBy === me.id) continue
      now.set(`m:${r.id}`, {
        key: `m:${r.id}`,
        kind: 'note',
        title: `Reminder for you: ${r.title}`,
        body: [`${fmtDate(r.date)}${r.time ? `, ${fmtTime(r.time)}` : ''}`, `set by ${emp(r.createdBy) ?? 'someone'}`].join(' · '),
        url: `/calendar?date=${r.date}`,
        alarm: false,
      })
    }
    const seen = readSeen(me.id)
    writeSeen(me.id, new Set(now.keys()))
    if (!seen) return
    const fresh = [...now.values()].filter((p) => !seen.has(p.key))
    if (fresh.length) onNew(fresh)
  }, [tasks, reminders, me, client, emp, onNew])
}

/* ---------- The popups ---------- */

const ICON: Record<Pop['kind'], typeof BellRing> = {
  reminder: AlarmClock,
  consultation: Clock,
  task: ListTodo,
  review: ClipboardCheck,
  note: AlarmClock,
}

function PopCard({ p, onOpen, onClose, onSnooze, onTick, muted, onMute }: { p: Pop; onOpen: () => void; onClose: () => void; onSnooze?: () => void; onTick?: () => void; muted: boolean; onMute: () => void }) {
  const Icon = p.alarm ? BellRing : ICON[p.kind]
  return (
    <div
      role={p.alarm ? 'alertdialog' : 'status'}
      aria-label={p.title}
      className={cn('pointer-events-auto animate-pop-in rounded-xl bg-white p-3 shadow-pop ring-1', p.alarm ? 'ring-2 ring-rose-300' : 'ring-ink-200')}
    >
      <div className="flex items-start gap-3">
        <span className={cn('mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full', p.alarm ? 'bg-rose-50 text-rose-600' : 'bg-brand-50 text-brand-700')}>
          <Icon size={18} className={cn(p.alarm && 'animate-ring')} />
        </span>
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
          <span className="block text-[13px] leading-snug font-bold text-ink-900">{p.title}</span>
          <span className="mt-0.5 block text-xs leading-snug text-ink-600">{p.body}</span>
        </button>
        {p.alarm && (
          <button type="button" onClick={onMute} aria-label={muted ? 'Turn alarm sound on' : 'Turn alarm sound off'} title={muted ? 'Sound off on this device' : 'Sound on'} className="flex size-7 shrink-0 items-center justify-center rounded-lg text-ink-400 hover:bg-ink-100 hover:text-ink-700">
            {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
        )}
        <button type="button" onClick={onClose} aria-label="Dismiss" className="flex size-7 shrink-0 items-center justify-center rounded-lg text-ink-400 hover:bg-ink-100 hover:text-ink-700">
          <X size={16} />
        </button>
      </div>
      <div className="mt-2 flex flex-wrap justify-end gap-1.5 pl-12">
        {onTick && (
          <button type="button" onClick={onTick} className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-[13px] font-semibold text-emerald-700 ring-1 ring-emerald-200 ring-inset hover:bg-emerald-50">
            <Check size={14} /> Done
          </button>
        )}
        {onSnooze && (
          <button type="button" onClick={onSnooze} className="inline-flex h-8 items-center rounded-lg px-2.5 text-[13px] font-semibold text-ink-700 ring-1 ring-ink-200 ring-inset hover:bg-ink-50">
            Snooze {SNOOZE_MIN} min
          </button>
        )}
        <button type="button" onClick={onOpen} className="inline-flex h-8 items-center rounded-lg bg-brand-600 px-3 text-[13px] font-semibold text-white hover:bg-brand-700">
          Open
        </button>
      </div>
    </div>
  )
}

export default function Alarms() {
  const navigate = useNavigate()
  const [now, setNow] = useState(() => Date.now())
  const today = todayISO()
  const alarms = useMyAlarms(today)
  const [news, setNews] = useState<Pop[]>([])
  const [muted, setMuted] = useState(() => !soundOn())
  const [, setHeard] = useState(soundReady())

  // The clock the alarms run on. Background tabs slow timers to about once a minute, which is close enough.
  useEffect(() => {
    const tick = () => setNow(Date.now())
    const id = window.setInterval(tick, 10_000)
    document.addEventListener('visibilitychange', tick)
    // Dismissed or snoozed in another tab: drop it here too.
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'fsg-alarms') tick()
    }
    window.addEventListener('storage', onStorage)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  // What should be ringing now.
  const ringing = useMemo(() => {
    const rung = readRung()
    return alarms.filter((a) => now >= a.ring && now < a.end && (rung[a.key] ?? 0) <= now).sort((a, b) => a.start - b.start)
  }, [alarms, now])
  const notified = useRef(new Set<string>())
  useEffect(() => {
    for (const a of ringing) {
      if (notified.current.has(a.key)) continue
      notified.current.add(a.key)
      // The card is right there when the app is in front; otherwise the system shows it too.
      if (!document.hasFocus()) void notifyHere(a.title, a.body, `alarm-${a.key}`, a.url, true)
    }
  }, [ringing])

  const onNew = useCallback((pops: Pop[]) => {
    const shown = pops.length > 3 ? [{ key: `many-${Date.now()}`, kind: 'task' as const, title: `${pops.length} new things for you`, body: pops.slice(0, 3).map((p) => p.title).join(' · ') + '…', url: '/tasks', alarm: false }] : pops
    setNews((n) => [...n.filter((x) => !shown.some((s) => s.key === x.key)), ...shown])
    chime()
    if (!document.hasFocus()) for (const p of shown) void notifyHere(p.title, p.body, `pop-${p.key}`, p.url, false)
  }, [])
  useArrivals(onNew)

  // The sound runs while any alarm is up.
  useEffect(() => {
    if (ringing.length && !muted) startRinging()
    else stopRinging()
  }, [ringing.length, muted])
  useEffect(() => stopRinging, [])

  // Sound only starts after a tap on the page: note when that happens, to drop the hint.
  useEffect(() => {
    if (!ringing.length || soundReady()) return
    const check = () => window.setTimeout(() => setHeard(soundReady()), 50)
    window.addEventListener('pointerdown', check)
    return () => window.removeEventListener('pointerdown', check)
  }, [ringing.length])

  // A notification shown from the page itself (no service worker, as in development) opens its page here.
  useEffect(() => {
    const open = (e: Event) => navigate((e as CustomEvent<string>).detail)
    window.addEventListener('fsg-open', open)
    return () => window.removeEventListener('fsg-open', open)
  }, [navigate])

  const off = (a: Alarm, until: number | 'dismissed') => {
    markRung(a.key, until)
    setNow(() => Date.now())
  }
  const toggleMute = () => {
    setSoundOn(muted)
    setMuted(!muted)
  }

  if (!ringing.length && !news.length) return null
  const shownNews = news.slice(-3)
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[70] flex w-[360px] flex-col gap-2 max-sm:inset-x-3 max-sm:top-3 max-sm:bottom-auto max-sm:w-auto" aria-live="assertive">
      {ringing.slice(0, 3).map((a) => (
        <PopCard
          key={a.key}
          p={a}
          muted={muted}
          onMute={toggleMute}
          onOpen={() => {
            off(a, 'dismissed')
            navigate(a.url)
          }}
          onClose={() => off(a, 'dismissed')}
          onSnooze={() => off(a, Date.now() + SNOOZE_MIN * 60_000)}
          onTick={
            a.tick &&
            (() => {
              a.tick!()
              off(a, 'dismissed')
            })
          }
        />
      ))}
      {ringing.length > 3 && <p className="pointer-events-auto rounded-lg bg-white px-3 py-1.5 text-center text-xs font-semibold text-ink-600 shadow-pop ring-1 ring-ink-200">{ringing.length - 3} more alarms</p>}
      {ringing.length > 0 && !muted && !soundReady() && (
        <p className="pointer-events-auto rounded-lg bg-amber-50 px-3 py-1.5 text-center text-xs text-amber-800 ring-1 ring-amber-200">Tap anywhere on the page to hear the alarm.</p>
      )}
      {shownNews.map((p) => (
        <PopCard
          key={p.key}
          p={p}
          muted={muted}
          onMute={toggleMute}
          onOpen={() => {
            setNews((n) => n.filter((x) => x.key !== p.key))
            navigate(p.url)
          }}
          onClose={() => setNews((n) => n.filter((x) => x.key !== p.key))}
        />
      ))}
    </div>
  )
}

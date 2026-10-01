import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Card, CardHeader, Empty, IconButton, PageHeader, TONE_BAR } from '../components/ui'
import { statutoryDeadlines } from '../lib/deadlines'
import { addDays, cn, daysUntil, fmtDate, parseISO, periodLabel, relDue, shiftPeriod, toISO, todayISO } from '../lib/format'
import { DEPARTMENTS, type Tone } from '../lib/meta'
import { isHead, useCurrentUser, useStore } from '../store'

interface CalEvent {
  id: string
  date: string
  title: string
  sub: string
  tone: Tone
  kind: 'Statutory' | 'Staff cut-off' | 'Task' | 'Follow-up' | 'Committed'
  to: string
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const CHIP: Record<Tone, string> = {
  neutral: 'bg-ink-100 text-ink-700',
  blue: 'bg-brand-100 text-brand-800',
  green: 'bg-emerald-100 text-emerald-800',
  amber: 'bg-amber-100 text-amber-900',
  red: 'bg-rose-100 text-rose-800',
  violet: 'bg-violet-100 text-violet-800',
  teal: 'bg-teal-100 text-teal-800',
}

function useEvents(from: string, to: string): CalEvent[] {
  const me = useCurrentUser()
  const clients = useStore((s) => s.clients)
  const tasks = useStore((s) => s.tasks)
  const leads = useStore((s) => s.leads)
  const services = useStore((s) => s.services)

  return useMemo(() => {
    const head = isHead(me)
    const out: CalEvent[] = []
    const within = (d: string) => d >= from && d <= to
    const names = new Map(clients.map((c) => [c.id, c.name]))

    for (const d of statutoryDeadlines(addDays(from, -2), addDays(to, 2))) {
      const n = clients.filter(d.applies).length
      if (!n) continue
      const tone = DEPARTMENTS[d.dept].tone
      const sub = `${d.detail} · ${n} clients${d.extendable ? ' · may be extended' : ''}`
      if (within(d.date)) out.push({ id: d.id, date: d.date, title: d.title, sub, tone, kind: 'Statutory', to: '/compliance' })
      if (d.internalDate && within(d.internalDate))
        out.push({ id: `${d.id}-cut`, date: d.internalDate, title: `${d.title} cut-off`, sub: `Finish a day early · ${n} clients`, tone, kind: 'Staff cut-off', to: '/compliance' })
    }
    for (const t of tasks) {
      if (t.status === 'completed' || !within(t.dueDate) || !(head || t.assigneeId === me.id)) continue
      out.push({
        id: t.id,
        date: t.dueDate,
        title: t.title,
        sub: (t.clientId && names.get(t.clientId)) || 'Internal',
        tone: daysUntil(t.dueDate) < 0 ? 'red' : 'neutral',
        kind: 'Task',
        to: `/tasks?open=${t.id}`,
      })
    }
    for (const l of leads) {
      if ((l.status !== 'new' && l.status !== 'followup') || !l.nextFollowUp || !within(l.nextFollowUp) || !(head || l.ownerId === me.id)) continue
      out.push({ id: l.id, date: l.nextFollowUp, title: `Call ${l.name}`, sub: `${l.contact} · ${l.phone}`, tone: 'amber', kind: 'Follow-up', to: `/leads?open=${l.id}` })
    }
    for (const s of services) {
      if (s.status === 'completed' || !within(s.committedDate) || !(head || s.assigneeId === me.id)) continue
      out.push({ id: s.id, date: s.committedDate, title: s.kind, sub: `Committed to ${s.party}`, tone: 'green', kind: 'Committed', to: '/compliance' })
    }
    return out.sort((a, b) => a.date.localeCompare(b.date))
  }, [me, clients, tasks, leads, services, from, to])
}

export default function Calendar() {
  const today = todayISO()
  const [month, setMonth] = useState(today.slice(0, 7))
  const [selected, setSelected] = useState(today)

  // Six full weeks, Monday first, covering the visible month.
  const days = useMemo(() => {
    const first = parseISO(`${month}-01`)
    const offset = (first.getDay() + 6) % 7
    const start = toISO(new Date(first.getFullYear(), first.getMonth(), 1 - offset))
    return Array.from({ length: 42 }, (_, i) => addDays(start, i))
  }, [month])

  const events = useEvents(days[0], days[41])
  const byDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>()
    for (const e of events) map.set(e.date, [...(map.get(e.date) ?? []), e])
    return map
  }, [events])

  const upcoming = useEvents(today, addDays(today, 30)).filter((e) => e.kind !== 'Staff cut-off' && e.kind !== 'Task')
  const dayEvents = byDay.get(selected) ?? []

  const go = (n: number) => setMonth((m) => shiftPeriod(m, n))

  return (
    <>
      <PageHeader
        title="Deadlines"
        subtitle="Statutory dates worked out from each client's scopes, plus task due dates, follow-ups and dates committed to customers."
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="flex items-center justify-between gap-2 px-4 py-3">
            <h2 className="text-base font-extrabold text-ink-900">{periodLabel(month)}</h2>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                onClick={() => {
                  setMonth(today.slice(0, 7))
                  setSelected(today)
                }}
              >
                Today
              </Button>
              <IconButton label="Previous month" onClick={() => go(-1)}>
                <ChevronLeft size={18} />
              </IconButton>
              <IconButton label="Next month" onClick={() => go(1)}>
                <ChevronRight size={18} />
              </IconButton>
            </div>
          </div>

          <div className="grid grid-cols-7 border-y border-ink-100 bg-ink-50/60">
            {WEEKDAYS.map((w) => (
              <p key={w} className="px-2 py-1.5 text-[11px] font-bold tracking-wider text-ink-500 uppercase">
                {w}
              </p>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d, i) => {
              const list = byDay.get(d) ?? []
              const inMonth = d.startsWith(month)
              const isToday = d === today
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSelected(d)}
                  aria-pressed={selected === d}
                  aria-label={`${fmtDate(d, true)}, ${list.length} items`}
                  className={cn(
                    'relative flex min-h-[72px] flex-col gap-1 border-ink-100 p-1.5 text-left transition-colors sm:min-h-[104px]',
                    i % 7 !== 6 && 'border-r',
                    i < 35 && 'border-b',
                    !inMonth && 'bg-ink-50/50',
                    selected === d ? 'bg-brand-50 ring-2 ring-brand-400 ring-inset' : 'hover:bg-ink-50',
                  )}
                >
                  <span
                    className={cn(
                      'tnum flex size-6 items-center justify-center rounded-full text-xs font-bold',
                      isToday ? 'bg-brand-600 text-white' : inMonth ? 'text-ink-700' : 'text-ink-400',
                    )}
                  >
                    {Number(d.slice(8))}
                  </span>
                  <span className="hidden w-full flex-col gap-1 sm:flex">
                    {list.slice(0, 3).map((e) => (
                      <span key={e.id} className={cn('truncate rounded px-1.5 py-0.5 text-[11px] leading-tight font-semibold', CHIP[e.tone], !inMonth && 'opacity-60')}>
                        {e.title}
                      </span>
                    ))}
                    {list.length > 3 && <span className="px-1 text-[11px] font-semibold text-ink-500">+{list.length - 3} more</span>}
                  </span>
                  <span className="flex flex-wrap gap-0.5 sm:hidden">
                    {list.slice(0, 4).map((e) => (
                      <span key={e.id} className={cn('size-1.5 rounded-full', TONE_BAR[e.tone])} />
                    ))}
                  </span>
                </button>
              )
            })}
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title={fmtDate(selected, true)} hint={selected === today ? 'Today' : relDue(selected)} />
            {dayEvents.length === 0 ? (
              <Empty icon={<CalendarDays size={20} />} title="Nothing due" hint="Pick another day on the calendar." />
            ) : (
              <ul className="divide-y divide-ink-100 pb-2">
                {dayEvents.map((e) => (
                  <li key={e.id}>
                    <Link to={e.to} className="flex items-start gap-3 px-5 py-2.5 hover:bg-ink-50">
                      <span className={cn('mt-1 h-8 w-1 shrink-0 rounded-full', TONE_BAR[e.tone])} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-ink-800">{e.title}</span>
                        <span className="block truncate text-xs text-ink-500">{e.sub}</span>
                      </span>
                      <Badge>{e.kind}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Next 30 days" hint="Statutory dates, follow-ups and committed dates" />
            <ul className="divide-y divide-ink-100 pb-2">
              {upcoming.slice(0, 9).map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setMonth(e.date.slice(0, 7))
                      setSelected(e.date)
                    }}
                    className="flex w-full items-center gap-3 px-5 py-2 text-left hover:bg-ink-50"
                  >
                    <span className="tnum w-12 shrink-0 text-[13px] font-bold text-ink-700">{fmtDate(e.date)}</span>
                    <span className={cn('size-2 shrink-0 rounded-full', TONE_BAR[e.tone])} />
                    <span className="min-w-0 flex-1 truncate text-[13px]">
                      <span className="font-semibold text-ink-800">{e.title}</span> <span className="text-ink-500">· {e.sub}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  )
}

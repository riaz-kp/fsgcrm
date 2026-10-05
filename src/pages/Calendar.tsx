import { AlarmClock, CalendarDays, Check, ChevronLeft, ChevronRight, Pencil, Plus, Repeat, Trash2 } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Badge, Button, Card, CardHeader, Empty, Field, IconButton, Input, Modal, PageHeader, Select, Textarea, TONE_BAR } from '../components/ui'
import { statutoryDeadlines } from '../lib/deadlines'
import { addDays, cn, daysUntil, fmtDate, fmtTime, parseISO, periodLabel, relDue, shiftPeriod, toISO, todayISO } from '../lib/format'
import { DEPARTMENTS, type Tone } from '../lib/meta'
import { useStoredState } from '../lib/useStoredState'
import { can, useCurrentUser, useReminderOccurrences, useStore } from '../store'
import type { Department, Reminder, ReminderRepeat } from '../types'

const KINDS = ['Statutory', 'Staff cut-off', 'Task', 'Follow-up', 'Committed', 'Consultation', 'Reminder'] as const
type Kind = (typeof KINDS)[number]

const KIND_LABEL: Record<Kind, string> = {
  Statutory: 'Statutory dates',
  'Staff cut-off': 'Staff cut-offs',
  Task: 'Tasks',
  'Follow-up': 'Follow-ups',
  Committed: 'Committed dates',
  Consultation: 'Consultations',
  Reminder: 'Reminders',
}

const KIND_TONE: Record<Kind, Tone> = {
  Statutory: 'blue',
  'Staff cut-off': 'neutral',
  Task: 'neutral',
  'Follow-up': 'amber',
  Committed: 'green',
  Consultation: 'violet',
  Reminder: 'teal',
}

/** The work heads a statutory date or task can belong to, for the second row of filters. */
const DEPTS: Department[] = ['gst', 'tds', 'it', 'audit', 'registration', 'bookkeeping', 'general']

interface CalEvent {
  id: string
  date: string
  title: string
  sub: string
  tone: Tone
  kind: Kind
  to: string
  dept?: Department
  /** Set for a reminder: which one, and whether this date of it has been ticked off. */
  reminder?: { r: Reminder; done: boolean }
  /** Set for a statutory date, so a reminder can be made from it. */
  statutory?: { title: string; detail: string }
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

interface Filters {
  /** Kinds and work heads that are switched off; everything else shows. */
  hiddenKinds: Kind[]
  hiddenDepts: Department[]
}

const NO_FILTERS: Filters = { hiddenKinds: [], hiddenDepts: [] }
const isFilters = (v: unknown): v is Filters =>
  !!v && typeof v === 'object' && Array.isArray((v as Filters).hiddenKinds) && Array.isArray((v as Filters).hiddenDepts)

function useEvents(from: string, to: string): CalEvent[] {
  const me = useCurrentUser()
  const clients = useStore((s) => s.clients)
  const tasks = useStore((s) => s.tasks)
  const leads = useStore((s) => s.leads)
  const services = useStore((s) => s.services)
  const consultations = useStore((s) => s.consultations)
  const reminders = useReminderOccurrences(from, to)
  const employees = useStore((s) => s.employees)

  return useMemo(() => {
    const head = can(me, 'assign_tasks')
    const out: CalEvent[] = []
    const within = (d: string) => d >= from && d <= to
    const names = new Map(clients.map((c) => [c.id, c.name]))

    for (const d of statutoryDeadlines(addDays(from, -2), addDays(to, 2))) {
      const n = clients.filter(d.applies).length
      if (!n) continue
      const tone = DEPARTMENTS[d.dept].tone
      const sub = `${d.detail} · ${n} clients${d.extendable ? ' · may be extended' : ''}`
      const to = `/filings/${d.dept}`
      const statutory = { title: d.title, detail: d.detail }
      if (within(d.date)) out.push({ id: d.id, date: d.date, title: d.title, sub, tone, kind: 'Statutory', to, dept: d.dept, statutory })
      if (d.internalDate && within(d.internalDate))
        out.push({ id: `${d.id}-cut`, date: d.internalDate, title: `${d.title} cut-off`, sub: `Finish a day early · ${n} clients`, tone, kind: 'Staff cut-off', to, dept: d.dept })
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
        dept: t.department,
      })
    }
    for (const l of leads) {
      if ((l.status !== 'new' && l.status !== 'followup') || !l.nextFollowUp || !within(l.nextFollowUp) || !(head || l.ownerId === me.id)) continue
      out.push({ id: l.id, date: l.nextFollowUp, title: `Call ${l.name}`, sub: `${l.contact} · ${l.phone}`, tone: 'amber', kind: 'Follow-up', to: `/leads?open=${l.id}` })
    }
    for (const s of services) {
      if (s.status === 'completed' || !within(s.committedDate) || !(head || s.assigneeId === me.id)) continue
      out.push({ id: s.id, date: s.committedDate, title: s.kind, sub: `Committed to ${s.party}`, tone: 'green', kind: 'Committed', to: '/filings/services', dept: 'registration' })
    }
    if (me.role === 'ceo')
      for (const c of consultations) {
        if (c.status !== 'scheduled' || !within(c.date)) continue
        out.push({ id: c.id, date: c.date, title: `${fmtTime(c.time)} ${c.withName}`, sub: c.topic, tone: 'violet', kind: 'Consultation', to: '/consultations' })
      }
    for (const o of reminders) {
      const r = o.reminder
      const who = r.forId ? (r.forId === me.id ? 'For you' : `For ${employees.find((e) => e.id === r.forId)?.name ?? 'someone'}`) : 'For everyone'
      out.push({
        id: `${r.id}-${o.date}`,
        date: o.date,
        title: r.title,
        sub: [r.clientId && names.get(r.clientId), r.note, who].filter(Boolean).join(' · '),
        tone: 'teal',
        kind: 'Reminder',
        to: r.clientId ? `/clients/${r.clientId}` : `/calendar?date=${o.date}`,
        reminder: { r, done: o.done },
      })
    }
    return out.sort((a, b) => a.date.localeCompare(b.date))
  }, [me, clients, tasks, leads, services, consultations, reminders, employees, from, to])
}

/* ---------- Reminder form ---------- */

const REPEATS: Array<{ value: ReminderRepeat; label: string }> = [
  { value: 'none', label: 'Does not repeat' },
  { value: 'monthly', label: 'Every month on this day' },
  { value: 'yearly', label: 'Every year on this date' },
]

const NOTICE = [
  { value: 0, label: 'On the day' },
  { value: 1, label: '1 day before' },
  { value: 3, label: '3 days before' },
  { value: 7, label: 'A week before' },
  { value: 15, label: '15 days before' },
  { value: 30, label: 'A month before' },
]

export type ReminderDraft = Partial<Omit<Reminder, 'id' | 'createdBy' | 'done'>>

function ReminderForm({ reminder, draft, onClose }: { reminder?: Reminder; draft?: ReminderDraft; onClose: () => void }) {
  const me = useCurrentUser()
  const employees = useStore((s) => s.employees)
  const clients = useStore((s) => s.clients)
  const addReminder = useStore((s) => s.addReminder)
  const updateReminder = useStore((s) => s.updateReminder)
  const deleteReminder = useStore((s) => s.deleteReminder)
  const start = reminder ?? draft ?? {}
  const [f, setF] = useState({
    title: start.title ?? '',
    note: start.note ?? '',
    date: start.date ?? addDays(todayISO(), 1),
    repeat: start.repeat ?? ('none' as ReminderRepeat),
    notifyDays: start.notifyDays ?? 1,
    // A new reminder is the creator's own unless they choose otherwise.
    forId: reminder ? (reminder.forId ?? '') : (start.forId ?? me.id),
    clientId: start.clientId ?? '',
  })
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }))
  const valid = f.title.trim() && f.date
  // People who assign work can set reminders for others; everyone else for themselves or the whole firm.
  const people = can(me, 'assign_tasks') ? employees : employees.filter((e) => e.id === me.id || e.id === f.forId)

  const save = () => {
    if (!valid) return
    const data = {
      title: f.title.trim(),
      note: f.note.trim() || undefined,
      date: f.date,
      repeat: f.repeat,
      notifyDays: f.notifyDays,
      forId: f.forId || undefined,
      clientId: f.clientId || undefined,
    }
    if (reminder) updateReminder(reminder.id, data)
    else addReminder(data)
    onClose()
  }

  return (
    <Modal
      title={reminder ? 'Edit reminder' : 'New reminder'}
      subtitle="Shows on the calendar and under the bell from the notice you pick."
      onClose={onClose}
      footer={
        <>
          {reminder && (
            <Button
              variant="danger"
              icon={<Trash2 size={15} />}
              onClick={() => {
                deleteReminder(reminder.id)
                onClose()
              }}
              className="mr-auto"
            >
              Delete
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={!valid}>
            {reminder ? 'Save' : 'Add reminder'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Remind about" className="sm:col-span-2">
          <Input value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. PF & ESI contribution due" autoFocus={!reminder} />
        </Field>
        <Field label="Date">
          <Input type="date" value={f.date} onChange={(e) => set('date', e.target.value)} />
        </Field>
        <Field label="Repeats">
          <Select value={f.repeat} onChange={(e) => set('repeat', e.target.value as ReminderRepeat)}>
            {REPEATS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Start reminding">
          <Select value={f.notifyDays} onChange={(e) => set('notifyDays', Number(e.target.value))}>
            {NOTICE.map((n) => (
              <option key={n.value} value={n.value}>
                {n.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="For">
          <Select value={f.forId} onChange={(e) => set('forId', e.target.value)}>
            <option value="">Everyone</option>
            {people.map((e) => (
              <option key={e.id} value={e.id}>
                {e.id === me.id ? `Me (${e.name})` : e.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Client" hint="optional" className="sm:col-span-2">
          <Select value={f.clientId} onChange={(e) => set('clientId', e.target.value)}>
            <option value="">Not about a client</option>
            {clients
              .filter((c) => c.active || c.id === f.clientId)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Note" hint="optional" className="sm:col-span-2">
          <Textarea value={f.note} onChange={(e) => set('note', e.target.value)} rows={2} placeholder="What to do, who to call…" />
        </Field>
      </div>
    </Modal>
  )
}

/* ---------- Filters ---------- */

// On a phone each row of chips scrolls sideways rather than stacking down the page.
const FILTER_ROW = 'scroll-none flex min-w-0 flex-1 items-center gap-1.5 sm:flex-wrap max-sm:-mx-4 max-sm:overflow-x-auto max-sm:px-4'

/** "Check all" and "Uncheck all" for one row of chips; each shows only when it would change something. */
function CheckAll({ allOn, noneOn, onAll, onNone, className }: { allOn: boolean; noneOn: boolean; onAll: () => void; onNone: () => void; className?: string }) {
  return (
    <span className={cn('flex shrink-0 items-center gap-3 text-xs font-semibold text-brand-700', className)}>
      {!allOn && (
        <button type="button" onClick={onAll} className="hover:underline">
          Check all
        </button>
      )}
      {!noneOn && (
        <button type="button" onClick={onNone} className="hover:underline">
          Uncheck all
        </button>
      )}
    </span>
  )
}

/**
 * One row of filters: its name, then the chips. "Check all" and "Uncheck all" follow the chips on a wide screen,
 * and sit beside the name on a phone, where the chips scroll.
 */
function FilterRow({ label, all, children, divider }: { label: string; all: Parameters<typeof CheckAll>[0]; children: ReactNode; divider?: boolean }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3', divider && 'border-t border-ink-100')}>
      <div className="flex w-14 shrink-0 items-center justify-between max-sm:w-full">
        <p className="text-[11px] font-bold tracking-wider text-ink-400 uppercase">{label}</p>
        <CheckAll {...all} className="sm:hidden" />
      </div>
      <div className={FILTER_ROW}>
        {children}
        <CheckAll {...all} className="pl-1 max-sm:hidden" />
      </div>
    </div>
  )
}

function FilterChip({ on, tone, label, count, onClick }: { on: boolean; tone: Tone; label: string; count?: number; onClick: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-2 rounded-lg pr-2.5 pl-2 text-[13px] font-semibold whitespace-nowrap ring-1 transition-colors ring-inset',
        on ? 'bg-white text-ink-800 ring-ink-300' : 'bg-ink-50 text-ink-400 ring-ink-200 hover:text-ink-600',
      )}
    >
      <span className={cn('flex size-4 shrink-0 items-center justify-center rounded', on ? cn(TONE_BAR[tone], 'text-white') : 'ring-1 ring-ink-300 ring-inset')}>
        {on && <Check size={12} strokeWidth={3.5} />}
      </span>
      {label}
      {count !== undefined && <span className="tnum text-xs font-medium text-ink-400">{count}</span>}
    </button>
  )
}

/* ---------- Page ---------- */

export default function Calendar() {
  const today = todayISO()
  const me = useCurrentUser()
  const toggleReminderDone = useStore((s) => s.toggleReminderDone)
  const [params, setParams] = useSearchParams()
  const linked = params.get('date')
  const start = linked && /^\d{4}-\d{2}-\d{2}$/.test(linked) ? linked : today
  const [month, setMonth] = useState(start.slice(0, 7))
  const [selected, setSelected] = useState(start)
  const [filters, setFilters] = useStoredState<Filters>('fsg-calendar-filters', NO_FILTERS, isFilters)
  const [form, setForm] = useState<{ reminder?: Reminder; draft?: ReminderDraft } | null>(() => (params.get('remind') ? { draft: { date: start } } : null))

  const closeForm = () => {
    setForm(null)
    if (params.get('remind')) {
      const next = new URLSearchParams(params)
      next.delete('remind')
      setParams(next, { replace: true })
    }
  }

  // Six full weeks, Monday first, covering the visible month.
  const days = useMemo(() => {
    const first = parseISO(`${month}-01`)
    const offset = (first.getDay() + 6) % 7
    const begin = toISO(new Date(first.getFullYear(), first.getMonth(), 1 - offset))
    return Array.from({ length: 42 }, (_, i) => addDays(begin, i))
  }, [month])

  const kinds = KINDS.filter((k) => k !== 'Consultation' || me.role === 'ceo')
  const visible = (e: CalEvent) => !filters.hiddenKinds.includes(e.kind) && !(e.dept && filters.hiddenDepts.includes(e.dept))

  const all = useEvents(days[0], days[41])
  const events = all.filter(visible)
  const byDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>()
    for (const e of events) map.set(e.date, [...(map.get(e.date) ?? []), e])
    return map
  }, [events])

  const upcoming = useEvents(today, addDays(today, 30)).filter((e) => visible(e) && e.kind !== 'Staff cut-off' && e.kind !== 'Task' && !e.reminder?.done)
  const dayEvents = byDay.get(selected) ?? []
  const inMonth = (e: CalEvent) => e.date.startsWith(month)
  const countKind = (k: Kind) => all.filter((e) => e.kind === k && inMonth(e)).length
  const countDept = (d: Department) => all.filter((e) => e.dept === d && inMonth(e)).length
  const depts = DEPTS.filter((d) => countDept(d) > 0 || filters.hiddenDepts.includes(d))
  const filtered = filters.hiddenKinds.length + filters.hiddenDepts.length > 0

  const go = (n: number) => setMonth((m) => shiftPeriod(m, n))
  const toggleKind = (k: Kind) =>
    setFilters({ ...filters, hiddenKinds: filters.hiddenKinds.includes(k) ? filters.hiddenKinds.filter((x) => x !== k) : [...filters.hiddenKinds, k] })
  const toggleDept = (d: Department) =>
    setFilters({ ...filters, hiddenDepts: filters.hiddenDepts.includes(d) ? filters.hiddenDepts.filter((x) => x !== d) : [...filters.hiddenDepts, d] })
  const mayEdit = (r: Reminder) => r.createdBy === me.id || can(me, 'assign_tasks')

  return (
    <>
      <PageHeader
        title="Calendar"
        subtitle="Statutory dates worked out from each client's scopes, plus task due dates, follow-ups, dates committed to customers and your own reminders."
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setForm({ draft: { date: selected >= today ? selected : addDays(today, 1) } })}>
            Add reminder
          </Button>
        }
      />

      <Card className="mb-4">
        <FilterRow
          label="Show"
          all={{
            allOn: kinds.every((k) => !filters.hiddenKinds.includes(k)),
            noneOn: kinds.every((k) => filters.hiddenKinds.includes(k)),
            onAll: () => setFilters({ ...filters, hiddenKinds: [] }),
            onNone: () => setFilters({ ...filters, hiddenKinds: [...KINDS] }),
          }}
        >
          {kinds.map((k) => (
            <FilterChip key={k} on={!filters.hiddenKinds.includes(k)} tone={KIND_TONE[k]} label={KIND_LABEL[k]} count={countKind(k)} onClick={() => toggleKind(k)} />
          ))}
        </FilterRow>
        {depts.length > 0 && (
          <FilterRow
            label="Work"
            divider
            all={{
              allOn: depts.every((d) => !filters.hiddenDepts.includes(d)),
              noneOn: depts.every((d) => filters.hiddenDepts.includes(d)),
              onAll: () => setFilters({ ...filters, hiddenDepts: [] }),
              onNone: () => setFilters({ ...filters, hiddenDepts: [...DEPTS] }),
            }}
          >
            {depts.map((d) => (
              <FilterChip key={d} on={!filters.hiddenDepts.includes(d)} tone={DEPARTMENTS[d].tone} label={DEPARTMENTS[d].label} count={countDept(d)} onClick={() => toggleDept(d)} />
            ))}
          </FilterRow>
        )}
      </Card>

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
              const thisMonth = d.startsWith(month)
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
                    !thisMonth && 'bg-ink-50/50',
                    selected === d ? 'bg-brand-50 ring-2 ring-brand-400 ring-inset' : 'hover:bg-ink-50',
                  )}
                >
                  <span
                    className={cn(
                      'tnum flex size-6 items-center justify-center rounded-full text-xs font-bold',
                      isToday ? 'bg-brand-600 text-white' : thisMonth ? 'text-ink-700' : 'text-ink-400',
                    )}
                  >
                    {Number(d.slice(8))}
                  </span>
                  <span className="hidden w-full flex-col gap-1 sm:flex">
                    {list.slice(0, 3).map((e) => (
                      <span
                        key={e.id}
                        className={cn(
                          'truncate rounded px-1.5 py-0.5 text-[11px] leading-tight font-semibold',
                          CHIP[e.tone],
                          (!thisMonth || e.reminder?.done) && 'opacity-60',
                          e.reminder?.done && 'line-through',
                        )}
                      >
                        {e.kind === 'Reminder' && <AlarmClock size={10} className="mr-0.5 inline align-[-1px]" />}
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
            <CardHeader
              title={fmtDate(selected, true)}
              hint={selected === today ? 'Today' : relDue(selected)}
              action={
                <Button size="sm" icon={<AlarmClock size={14} />} onClick={() => setForm({ draft: { date: selected } })}>
                  Remind me
                </Button>
              }
            />
            {dayEvents.length === 0 ? (
              <Empty icon={<CalendarDays size={20} />} title="Nothing due" hint={filtered ? 'Nothing here, or it is hidden by the filters above.' : 'Pick another day on the calendar.'} />
            ) : (
              <ul className="divide-y divide-ink-100 pb-2">
                {dayEvents.map((e) => (
                  <li key={e.id} className="flex items-center gap-1 pr-3 hover:bg-ink-50">
                    {e.reminder ? (
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={e.reminder.done}
                        aria-label={`${e.reminder.done ? 'Untick' : 'Tick off'} ${e.title}`}
                        title={e.reminder.done ? 'Done. Click to reopen.' : 'Tick off when done'}
                        onClick={() => toggleReminderDone(e.reminder!.r.id, e.date)}
                        className="ml-5 flex size-5 shrink-0 items-center justify-center rounded-md ring-1 ring-ink-300 ring-inset hover:ring-teal-500 aria-checked:bg-teal-500 aria-checked:text-white aria-checked:ring-teal-500"
                      >
                        {e.reminder.done && <Check size={13} strokeWidth={3.5} />}
                      </button>
                    ) : (
                      <span className={cn('mt-1 ml-5 h-8 w-1 shrink-0 self-start rounded-full', TONE_BAR[e.tone])} />
                    )}
                    <Link to={e.to} className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-2">
                      <span className="min-w-0 flex-1">
                        <span className={cn('block truncate font-semibold text-ink-800', e.reminder?.done && 'text-ink-400 line-through')}>
                          {e.title}
                          {e.reminder && e.reminder.r.repeat !== 'none' && <Repeat size={11} className="ml-1.5 inline text-ink-400" aria-label={`Repeats ${e.reminder.r.repeat}`} />}
                        </span>
                        <span className="block truncate text-xs text-ink-500">{e.sub}</span>
                      </span>
                      <Badge tone={e.kind === 'Reminder' ? 'teal' : 'neutral'}>{e.kind}</Badge>
                    </Link>
                    {e.reminder && mayEdit(e.reminder.r) && (
                      <IconButton label={`Edit ${e.title}`} onClick={() => setForm({ reminder: e.reminder!.r })}>
                        <Pencil size={14} />
                      </IconButton>
                    )}
                    {e.statutory && (
                      <IconButton
                        label={`Add a reminder for ${e.title}`}
                        onClick={() => setForm({ draft: { title: `${e.statutory!.title} · ${e.statutory!.detail}`, date: e.date, notifyDays: 3 } })}
                      >
                        <AlarmClock size={14} />
                      </IconButton>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Next 30 days" hint="Statutory dates, follow-ups, committed dates and reminders" />
            {upcoming.length === 0 ? (
              <p className="px-5 pb-5 text-[13px] text-ink-500">Nothing coming up{filtered ? ' with these filters' : ''}.</p>
            ) : (
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
            )}
          </Card>
        </div>
      </div>

      {form && <ReminderForm key={form.reminder?.id ?? 'new'} reminder={form.reminder} draft={form.draft} onClose={closeForm} />}
    </>
  )
}

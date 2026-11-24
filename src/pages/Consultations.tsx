import { AlarmClock, CalendarClock, CalendarArrowUp, Check, Clock, Lock, MapPin, Pencil, Phone, Plus, Video, X } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, Badge, Button, Card, Empty, Field, IconButton, Input, Modal, PageHeader, Segmented, Select, Textarea } from '../components/ui'
import { ALARM_OPTIONS, alarmLabel, askToNotify } from '../lib/alarms'
import { addDays, cn, daysUntil, fmtDate, fmtTime, fmtWeekday, relDue, todayISO } from '../lib/format'
import { CONSULT_MODES } from '../lib/meta'
import { consultants, consultationPeople, useCan, useCurrentUser, useStore } from '../store'
import type { ConsultMode, Consultation } from '../types'

const MODE_ICON: Record<ConsultMode, ReactNode> = {
  'In person': <MapPin size={13} />,
  Phone: <Phone size={13} />,
  Video: <Video size={13} />,
}

function ConsultForm({ c, onClose }: { c?: Consultation; onClose: () => void }) {
  const addConsultation = useStore((s) => s.addConsultation)
  const updateConsultation = useStore((s) => s.updateConsultation)
  const clients = useStore((s) => s.clients)
  const employees = useStore((s) => s.employees)
  const me = useCurrentUser()
  const start = c ? consultationPeople(c, employees) : []
  const people = consultants(employees, start)
  const [f, setF] = useState({
    clientId: c?.clientId ?? '',
    withName: c && !c.clientId ? c.withName : '',
    date: c?.date ?? addDays(todayISO(), 1),
    time: c?.time ?? '11:00',
    durationMin: c?.durationMin ?? 30,
    topic: c?.topic ?? '',
    mode: c?.mode ?? ('In person' as ConsultMode),
    notes: c?.notes ?? '',
    // A new one is for whoever is scheduling it, if they take consultations, else the CEO.
    attendees: c ? start : people.some((e) => e.id === me.id) ? [me.id] : people.filter((e) => e.role === 'ceo').map((e) => e.id),
    alarm: c ? (c.alarm === undefined ? '' : String(c.alarm)) : '15',
  })
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }))
  const withName = f.clientId ? (clients.find((x) => x.id === f.clientId)?.name ?? '') : f.withName.trim()
  const valid = withName && f.date && f.time && f.topic.trim() && f.attendees.length > 0
  const toggle = (id: string) => set('attendees', f.attendees.includes(id) ? f.attendees.filter((x) => x !== id) : [...f.attendees, id])

  const save = () => {
    const data = {
      withName,
      clientId: f.clientId || undefined,
      date: f.date,
      time: f.time,
      durationMin: f.durationMin,
      topic: f.topic.trim(),
      mode: f.mode,
      notes: f.notes.trim(),
      attendees: people.filter((e) => f.attendees.includes(e.id)).map((e) => e.id),
      alarm: f.alarm === '' ? undefined : Number(f.alarm),
    }
    if (c) updateConsultation(c.id, data)
    else addConsultation({ ...data, status: 'scheduled' })
    if (data.alarm !== undefined) askToNotify()
    onClose()
  }

  return (
    <Modal
      wide
      title={c ? 'Edit consultation' : 'Schedule a consultation'}
      subtitle="Goes into the diary of whoever takes it, with an alarm before it starts."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!valid} onClick={save}>
            {c ? 'Save' : 'Schedule'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Client">
          <Select value={f.clientId} onChange={(e) => set('clientId', e.target.value)}>
            <option value="">Not a client yet</option>
            {clients
              .filter((x) => x.active || x.id === f.clientId)
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Or name">
          <Input value={f.withName} onChange={(e) => set('withName', e.target.value)} disabled={!!f.clientId} placeholder="Lead or new customer" />
        </Field>
        <Field label="What it is about" className="sm:col-span-2">
          <Input value={f.topic} onChange={(e) => set('topic', e.target.value)} placeholder="e.g. Tax planning before year end" />
        </Field>
        <Field label="Who takes it" hint={f.attendees.length ? undefined : 'tick at least one'} className="sm:col-span-2">
          <div className="flex flex-wrap gap-2">
            {people.map((e) => {
              const on = f.attendees.includes(e.id)
              return (
                <label
                  key={e.id}
                  className={cn(
                    'flex h-10 cursor-pointer items-center gap-2 rounded-lg px-3 text-[13px] font-semibold ring-1 transition-colors ring-inset',
                    on ? 'bg-brand-50 text-brand-800 ring-brand-300' : 'bg-white text-ink-600 ring-ink-200 hover:bg-ink-50',
                  )}
                >
                  <input type="checkbox" checked={on} onChange={() => toggle(e.id)} aria-label={e.name} className="size-4 accent-brand-600" />
                  <Avatar name={e.name} hue={e.hue} photo={e.photo} size={22} />
                  {e.name}
                  <span className="font-normal text-ink-500">{e.title}</span>
                </label>
              )
            })}
          </div>
        </Field>
        <Field label="Date">
          <Input type="date" value={f.date} onChange={(e) => set('date', e.target.value)} />
        </Field>
        <Field label="Time">
          <Input type="time" value={f.time} onChange={(e) => set('time', e.target.value)} step={300} />
        </Field>
        <Field label="Length">
          <Select value={f.durationMin} onChange={(e) => set('durationMin', Number(e.target.value))}>
            {[15, 30, 45, 60, 90].map((m) => (
              <option key={m} value={m}>
                {m} minutes
              </option>
            ))}
          </Select>
        </Field>
        <Field label="How">
          <Select value={f.mode} onChange={(e) => set('mode', e.target.value as ConsultMode)}>
            {CONSULT_MODES.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </Select>
        </Field>
        <Field label="Alarm" hint="popup, sound and notification" className="sm:col-span-2">
          <Select value={f.alarm} onChange={(e) => set('alarm', e.target.value)}>
            <option value="">No alarm</option>
            {ALARM_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Notes" hint="optional" className="sm:col-span-2">
          <Textarea value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Papers to bring, background, who referred them…" />
        </Field>
      </div>
    </Modal>
  )
}

/** Move a consultation to another day or time. The old slot is kept, so the diary shows how often it has moved. */
function PostponeForm({ c, onClose }: { c: Consultation; onClose: () => void }) {
  const postpone = useStore((s) => s.postponeConsultation)
  // A missed appointment is moved on from today; an upcoming one from its own day.
  const base = c.date < todayISO() ? todayISO() : c.date
  const [date, setDate] = useState(addDays(base, 1))
  const [time, setTime] = useState(c.time)
  const [reason, setReason] = useState('')
  const same = date === c.date && time === c.time
  const quick = [
    { label: 'Next day', date: addDays(base, 1) },
    { label: 'In 2 days', date: addDays(base, 2) },
    { label: 'A week later', date: addDays(base, 7) },
  ]

  return (
    <Modal
      title="Postpone consultation"
      subtitle={`${c.withName} · now ${fmtWeekday(c.date)} ${fmtDate(c.date, true)}, ${fmtTime(c.time)}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!date || !time || same}
            onClick={() => {
              postpone(c.id, date, time, reason.trim())
              onClose()
            }}
          >
            Move to {date ? `${fmtDate(date)}, ${time ? fmtTime(time) : ''}` : '…'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {quick.map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => setDate(q.date)}
              aria-pressed={date === q.date}
              className={cn(
                'h-8 rounded-lg px-3 text-[13px] font-semibold ring-1 transition-colors ring-inset',
                date === q.date ? 'bg-brand-50 text-brand-800 ring-brand-300' : 'bg-white text-ink-600 ring-ink-200 hover:bg-ink-50',
              )}
            >
              {q.label} <span className="font-normal text-ink-500">· {fmtWeekday(q.date)} {fmtDate(q.date)}</span>
            </button>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="New date">
            <Input type="date" value={date} min={todayISO()} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="New time">
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} step={900} />
          </Field>
        </div>
        <Field label="Why" hint="optional">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Client travelling, asked for next week" />
        </Field>
        {same && <p className="text-[13px] text-amber-700">That is the slot it already has. Pick another day or time.</p>}
      </div>
    </Modal>
  )
}

function Slot({ c, onPostpone, onEdit }: { c: Consultation; onPostpone: () => void; onEdit: () => void }) {
  const updateConsultation = useStore((s) => s.updateConsultation)
  const employees = useStore((s) => s.employees)
  const people = consultationPeople(c, employees)
    .map((id) => employees.find((e) => e.id === id))
    .filter((e) => e !== undefined)
  const open = c.status === 'scheduled'
  const moved = c.postponed?.at(-1)
  return (
    <li className={cn('flex flex-wrap items-start gap-x-4 gap-y-2 px-5 py-3', !open && 'opacity-60')}>
      <div className="w-20 shrink-0">
        <p className="tnum text-[15px] leading-tight font-extrabold text-ink-900">{fmtTime(c.time)}</p>
        <p className="text-xs text-ink-500">{c.durationMin} min</p>
      </div>
      <div className="min-w-48 flex-1">
        <p className="font-semibold text-ink-900">
          {c.clientId ? (
            <Link to={`/clients/${c.clientId}`} className="hover:text-brand-700 hover:underline">
              {c.withName}
            </Link>
          ) : (
            c.withName
          )}
          {!c.clientId && <Badge className="ml-2">Not a client yet</Badge>}
        </p>
        <p className="text-sm text-ink-700">{c.topic}</p>
        {c.notes && <p className="mt-0.5 text-[13px] text-ink-500">{c.notes}</p>}
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
          <span className="flex items-center gap-1.5">
            {people.map((e) => (
              <span key={e.id} className="inline-flex items-center gap-1 font-medium text-ink-700">
                <Avatar name={e.name} hue={e.hue} photo={e.photo} size={18} />
                {e.name}
              </span>
            ))}
          </span>
          {open && c.alarm !== undefined && (
            <span className="inline-flex items-center gap-1">
              <AlarmClock size={12} /> {alarmLabel(c.alarm)}
            </span>
          )}
        </p>
        {moved && (
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-amber-800">
            <CalendarArrowUp size={13} className="shrink-0" />
            Postponed from {fmtWeekday(moved.date)} {fmtDate(moved.date)}, {fmtTime(moved.time)}
            {moved.reason && <span className="text-ink-500">· {moved.reason}</span>}
            {c.postponed!.length > 1 && <span className="text-ink-500">· moved {c.postponed!.length} times</span>}
          </p>
        )}
      </div>
      {/* Wraps under the details on a phone, lined up with them rather than with the time. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 max-sm:w-full max-sm:pl-24">
        <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-600">
          {MODE_ICON[c.mode]}
          {c.mode}
        </span>
        {open ? (
          <span className="flex flex-wrap gap-1">
            <Button size="sm" icon={<Check size={14} />} onClick={() => updateConsultation(c.id, { status: 'done' })}>
              Done
            </Button>
            <Button size="sm" icon={<CalendarArrowUp size={14} />} onClick={onPostpone}>
              Postpone
            </Button>
            <IconButton label="Edit consultation" onClick={onEdit}>
              <Pencil size={15} />
            </IconButton>
            <IconButton label="Cancel consultation" onClick={() => updateConsultation(c.id, { status: 'cancelled' })} className="hover:text-rose-600">
              <X size={16} />
            </IconButton>
          </span>
        ) : (
          <Badge tone={c.status === 'done' ? 'green' : 'neutral'}>{c.status === 'done' ? 'Done' : 'Cancelled'}</Badge>
        )}
      </div>
    </li>
  )
}

export default function Consultations() {
  const consultations = useStore((s) => s.consultations)
  const employees = useStore((s) => s.employees)
  const me = useCurrentUser()
  const allowed = useCan()('consultations')
  const [view, setView] = useState<'upcoming' | 'past'>('upcoming')
  const people = consultants(employees)
  // Whose diary: theirs for those who take consultations, else everyone's.
  const [who, setWho] = useState(() => (people.some((e) => e.id === me.id) ? me.id : 'all'))
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Consultation>()
  const [postponing, setPostponing] = useState<Consultation>()
  const today = todayISO()

  const mine = useMemo(() => (who === 'all' ? consultations : consultations.filter((c) => consultationPeople(c, employees).includes(who))), [consultations, employees, who])

  const days = useMemo(() => {
    const list = mine
      .filter((c) => (view === 'upcoming' ? c.date >= today : c.date < today))
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
    if (view === 'past') list.reverse()
    const map = new Map<string, Consultation[]>()
    for (const c of list) map.set(c.date, [...(map.get(c.date) ?? []), c])
    return [...map]
  }, [mine, view, today])

  const todayCount = mine.filter((c) => c.date === today && c.status === 'scheduled').length

  if (!allowed)
    return (
      <Card>
        <Empty icon={<Lock size={20} />} title="Consultations are private" hint="The CEO's diary is open to those given access in Settings." />
      </Card>
    )

  return (
    <>
      <PageHeader
        title="Consultations"
        subtitle={
          <>
            {who === 'all' ? 'Everyone' : employees.find((e) => e.id === who)?.name}'s consulting schedule ·{' '}
            <span className={cn(todayCount > 0 && 'font-semibold text-brand-700')}>{todayCount} today</span>
          </>
        }
        actions={
          <>
            {people.length > 1 && (
              <Segmented value={who} onChange={setWho} items={[{ value: 'all', label: 'All' }, ...people.map((e) => ({ value: e.id, label: e.name }))]} />
            )}
            <Segmented
              value={view}
              onChange={setView}
              items={[
                { value: 'upcoming', label: 'Upcoming' },
                { value: 'past', label: 'Past' },
              ]}
            />
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setAdding(true)}>
              Schedule
            </Button>
          </>
        }
      />

      {days.length === 0 ? (
        <Card>
          <Empty icon={<CalendarClock size={20} />} title={view === 'upcoming' ? 'Nothing scheduled' : 'No past consultations'} hint="Schedule one and it shows up in the reminders and calendar of whoever takes it, with an alarm before it starts." />
        </Card>
      ) : (
        <div className="space-y-4">
          {days.map(([date, list]) => (
            <Card key={date}>
              <header className="flex items-center gap-3 border-b border-ink-100 px-5 py-3">
                <Clock size={16} className="text-ink-400" />
                <h2 className="text-[15px] font-bold text-ink-900">
                  {fmtWeekday(date)}, {fmtDate(date, true)}
                </h2>
                <Badge tone={date === today ? 'blue' : 'neutral'}>{date === today ? 'Today' : daysUntil(date) === 1 ? 'Tomorrow' : relDue(date).replace(' overdue', ' ago')}</Badge>
              </header>
              <ul className="divide-y divide-ink-100">
                {list.map((c) => (
                  <Slot key={c.id} c={c} onPostpone={() => setPostponing(c)} onEdit={() => setEditing(c)} />
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}

      {adding && <ConsultForm onClose={() => setAdding(false)} />}
      {editing && <ConsultForm c={editing} onClose={() => setEditing(undefined)} />}
      {postponing && <PostponeForm c={postponing} onClose={() => setPostponing(undefined)} />}
    </>
  )
}

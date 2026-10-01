import { ArrowLeft, CalendarX2, ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Avatar, Badge, Button, Card, CardHeader, Empty, IconButton, PageHeader, Select, StatusSelect, Td, Th } from '../components/ui'
import { attendanceTotals, monthDays } from '../lib/attendance'
import { cn, fmtDate, fmtDuration, fmtTime, fmtWeekday, minutesBetween, nowHHMM, periodLabel, shiftPeriod, todayISO } from '../lib/format'
import { ATTENDANCE, ATTENDANCE_ORDER, type Tone } from '../lib/meta'
import { isHead, useCurrentUser, useStore } from '../store'
import type { AttendanceEntry, AttendanceMark } from '../types'

const CELL: Record<AttendanceMark, string> = {
  P: 'bg-emerald-100 text-emerald-800',
  H: 'bg-amber-100 text-amber-900',
  L: 'bg-violet-100 text-violet-800',
  A: 'bg-rose-100 text-rose-800',
}

/** Unmarked -> Present -> Half day -> Leave -> Absent -> unmarked */
function next(mark?: AttendanceMark): AttendanceMark | undefined {
  if (!mark) return 'P'
  return ATTENDANCE_ORDER[ATTENDANCE_ORDER.indexOf(mark) + 1]
}

const worked = (e?: AttendanceEntry) => e?.mark === 'P' || e?.mark === 'H'

/** '9:12 am – 5:48 pm', or just the time in while the person is still at work. */
function timing(e?: AttendanceEntry): string {
  if (!e?.in) return ''
  return e.out ? `${fmtTime(e.in)} – ${fmtTime(e.out)}` : `in ${fmtTime(e.in)}`
}

function hhmm(minutes: number): string {
  const m = Math.round(minutes)
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

function TimeInput({ value, onChange, label, disabled }: { value?: string; onChange: (v: string) => void; label: string; disabled?: boolean }) {
  return (
    <input
      type="time"
      value={value ?? ''}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      title={label}
      className="tnum h-7 w-[108px] rounded-md bg-white px-1.5 text-[13px] font-medium text-ink-800 ring-1 ring-ink-200 ring-inset focus:ring-2 focus:ring-brand-500 focus:outline-none disabled:bg-ink-50 disabled:text-ink-300"
    />
  )
}

function MonthSwitch({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  return (
    <div className="flex items-center gap-1">
      <IconButton label="Previous month" onClick={() => onChange(shiftPeriod(month, -1))}>
        <ChevronLeft size={18} />
      </IconButton>
      <h2 className="w-36 text-center text-base font-extrabold text-ink-900">{periodLabel(month)}</h2>
      <IconButton label="Next month" onClick={() => onChange(shiftPeriod(month, 1))} disabled={month >= todayISO().slice(0, 7)}>
        <ChevronRight size={18} />
      </IconButton>
    </div>
  )
}

/* ---------- Register: everyone, one month ---------- */

export default function AttendancePage() {
  const me = useCurrentUser()
  const head = isHead(me)
  const employees = useStore((s) => s.employees)
  const attendance = useStore((s) => s.attendance)
  const setAttendance = useStore((s) => s.setAttendance)
  const setAttendanceTime = useStore((s) => s.setAttendanceTime)
  const today = todayISO()
  const [month, setMonth] = useState(today.slice(0, 7))

  // Heads keep the register for everyone; others see their own row.
  const people = head ? employees : employees.filter((e) => e.id === me.id)
  const days = useMemo(() => monthDays(month), [month])
  const unmarkedToday = people.filter((e) => !attendance[e.id]?.[today])

  const markToday = (id: string, mark: AttendanceMark) => {
    const entry = attendance[id]?.[today]
    if (entry?.mark === mark) return setAttendance(id, today)
    setAttendance(id, today, mark)
    // Marking someone in for the day is the moment they arrived, unless a time is already there.
    if ((mark === 'P' || mark === 'H') && !entry?.in) setAttendanceTime(id, today, { in: nowHHMM() })
  }

  return (
    <>
      <PageHeader
        title="Attendance"
        subtitle={head ? 'Daily register for the whole team, with time in and out. Open a person for their totals.' : 'Your attendance for the month.'}
        actions={
          !head && (
            <Link to={`/attendance/${me.id}`}>
              <Button>My attendance in detail</Button>
            </Link>
          )
        }
      />

      {head && month === today.slice(0, 7) && (
        <Card className="mb-4">
          <CardHeader
            title="Today"
            hint={unmarkedToday.length ? `${unmarkedToday.length} not marked yet` : 'Everyone is marked'}
            action={
              unmarkedToday.length > 0 && (
                <Button size="sm" onClick={() => unmarkedToday.forEach((e) => setAttendance(e.id, today, 'P'))}>
                  Mark the rest present
                </Button>
              )
            }
          />
          <ul className="grid gap-2 px-5 lg:grid-cols-2">
            {people.map((e) => {
              const entry = attendance[e.id]?.[today]
              const off = entry?.mark === 'L' || entry?.mark === 'A'
              return (
                <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg p-2 ring-1 ring-ink-200/80">
                  <Link to={`/attendance/${e.id}`} className="flex min-w-32 flex-1 items-center gap-2.5 hover:text-brand-700">
                    <Avatar name={e.name} hue={e.hue} photo={e.photo} size={28} />
                    <span className="truncate text-[13px] font-semibold text-ink-800 hover:text-brand-700">{e.name}</span>
                  </Link>
                  <span className="flex gap-0.5" role="group" aria-label={`Attendance for ${e.name}`}>
                    {ATTENDANCE_ORDER.map((m) => (
                      <button
                        key={m}
                        type="button"
                        title={ATTENDANCE[m].label}
                        aria-pressed={entry?.mark === m}
                        onClick={() => markToday(e.id, m)}
                        className={cn(
                          'size-7 rounded-md text-xs font-bold transition-colors',
                          entry?.mark === m ? CELL[m] : 'text-ink-400 ring-1 ring-ink-200 ring-inset hover:bg-ink-50',
                        )}
                      >
                        {m}
                      </button>
                    ))}
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-ink-400 uppercase">
                    In
                    <TimeInput label={`Time in for ${e.name}`} value={entry?.in} disabled={off} onChange={(v) => setAttendanceTime(e.id, today, { in: v })} />
                    Out
                    <TimeInput label={`Time out for ${e.name}`} value={entry?.out} disabled={off} onChange={(v) => setAttendanceTime(e.id, today, { out: v })} />
                  </span>
                </li>
              )
            })}
          </ul>
          <p className="px-5 py-3 text-xs text-ink-500">Marking someone present or half day notes the time as their time in. Set the time out when they leave; both can be corrected.</p>
        </Card>
      )}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <MonthSwitch month={month} onChange={setMonth} />
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {ATTENDANCE_ORDER.map((m) => (
              <li key={m} className="flex items-center gap-1.5 text-[13px] text-ink-600">
                <span className={cn('flex size-5 items-center justify-center rounded text-[11px] font-bold', CELL[m])}>{m}</span>
                {ATTENDANCE[m].label}
              </li>
            ))}
          </ul>
        </div>

        <div className="overflow-x-auto border-t border-ink-100">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-ink-50 py-2 pr-3 pl-5 text-left text-[11px] font-bold tracking-wider text-ink-500 uppercase">Person</th>
                {days.map((d) => (
                  <th key={d.date} className={cn('bg-ink-50 px-px py-1.5 text-center', d.date === today && 'bg-brand-50')}>
                    <span className={cn('block text-[10px] font-bold', d.sunday ? 'text-rose-400' : 'text-ink-400')}>{d.weekday}</span>
                    <span className={cn('tnum block text-xs font-bold', d.date === today ? 'text-brand-700' : 'text-ink-600')}>{d.day}</span>
                  </th>
                ))}
                {ATTENDANCE_ORDER.map((m) => (
                  <th key={m} className="bg-ink-50 px-2 text-center text-[11px] font-bold text-ink-500" title={ATTENDANCE[m].label}>
                    {m}
                  </th>
                ))}
                <th className="bg-ink-50 pr-5 pl-2 text-center text-[11px] font-bold tracking-wider text-ink-500 uppercase" title="Days worked, a half day counting as half">
                  Days
                </th>
              </tr>
            </thead>
            <tbody>
              {people.map((e) => {
                const t = attendanceTotals(attendance[e.id], month)
                return (
                  <tr key={e.id}>
                    <td className="sticky left-0 z-10 border-t border-ink-100 bg-white py-1.5 pr-3 pl-5">
                      <Link to={`/attendance/${e.id}`} title={`Attendance detail for ${e.name}`} className="group flex items-center gap-2 whitespace-nowrap">
                        <Avatar name={e.name} hue={e.hue} photo={e.photo} size={24} />
                        <span className="font-semibold text-ink-800 group-hover:text-brand-700 group-hover:underline">{e.name}</span>
                      </Link>
                    </td>
                    {days.map((d) => {
                      const entry = attendance[e.id]?.[d.date]
                      const mark = entry?.mark
                      const future = d.date > today
                      const state = mark ? [ATTENDANCE[mark].label, timing(entry)].filter(Boolean).join(' · ') : d.sunday ? 'Sunday' : 'not marked'
                      return (
                        <td key={d.date} className={cn('border-t border-ink-100 px-px py-1 text-center', d.date === today && 'bg-brand-50/60')}>
                          <button
                            type="button"
                            disabled={!head || future}
                            onClick={() => setAttendance(e.id, d.date, next(mark))}
                            aria-label={`${e.name}, ${d.date}: ${state}`}
                            title={mark ? state : undefined}
                            className={cn(
                              'size-6 rounded text-[11px] font-bold transition-colors disabled:cursor-default',
                              mark ? CELL[mark] : d.sunday ? 'text-ink-300' : future ? 'text-ink-200' : 'text-ink-300 ring-1 ring-ink-200 ring-inset',
                              head && !future && 'hover:ring-2 hover:ring-brand-400',
                            )}
                          >
                            {mark ?? (d.sunday ? '·' : '')}
                          </button>
                        </td>
                      )
                    })}
                    {ATTENDANCE_ORDER.map((m) => (
                      <td key={m} className="tnum border-t border-ink-100 px-2 text-center text-[13px] font-bold text-ink-700">
                        {t[m] || <span className="font-normal text-ink-300">0</span>}
                      </td>
                    ))}
                    <td className="tnum border-t border-ink-100 pr-5 pl-2 text-center text-[13px] font-extrabold text-ink-900">{t.worked}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t border-ink-100 px-5 py-2.5 text-xs text-ink-500">
          {head
            ? 'Click a day to step through Present, Half day, Leave, Absent and blank; hover it for the time in and out. Click a name for that person’s totals and timings. Sundays are left blank unless someone worked.'
            : 'Marked by your heads. Ask them if a day looks wrong.'}
        </p>
      </Card>
    </>
  )
}

/* ---------- Detail: one person ---------- */

const MARK_OPTIONS: Array<{ value: AttendanceMark | ''; label: string; tone: Tone }> = [
  { value: '', label: 'Not marked', tone: 'neutral' },
  ...ATTENDANCE_ORDER.map((m) => ({ value: m, ...ATTENDANCE[m] })),
]

function Tile({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: string }) {
  return (
    <div className="px-5 py-3.5">
      <dt className="text-xs font-semibold text-ink-500">{label}</dt>
      <dd className={cn('tnum mt-0.5 text-2xl leading-tight font-extrabold', tone ?? 'text-ink-900')}>{value}</dd>
      {sub && <dd className="mt-0.5 text-xs text-ink-500">{sub}</dd>}
    </div>
  )
}

export function AttendanceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const me = useCurrentUser()
  const head = isHead(me)
  const employees = useStore((s) => s.employees)
  const attendance = useStore((s) => s.attendance)
  const setAttendance = useStore((s) => s.setAttendance)
  const setAttendanceTime = useStore((s) => s.setAttendanceTime)
  const today = todayISO()
  const [month, setMonth] = useState(today.slice(0, 7))
  const emp = employees.find((e) => e.id === id)
  const entries = emp ? attendance[emp.id] : undefined

  // Every month on record, newest first, and the leave and absences of the year in view.
  const months = useMemo(() => [...new Set([today.slice(0, 7), ...Object.keys(entries ?? {}).map((d) => d.slice(0, 7))])].sort().reverse(), [entries, today])
  const year = month.slice(0, 4)
  const timeOff = useMemo(
    () =>
      Object.entries(entries ?? {})
        .filter(([date, e]) => date.startsWith(year) && e.mark !== 'P')
        .sort(([a], [b]) => b.localeCompare(a)),
    [entries, year],
  )

  if (!emp) {
    return (
      <Card>
        <Empty title="No such person" hint="They may have been removed when the sample data was reset." action={<Link to="/attendance"><Button>Back to attendance</Button></Link>} />
      </Card>
    )
  }
  // Only heads look at other people's attendance.
  if (!head && emp.id !== me.id) return <Navigate to={`/attendance/${me.id}`} replace />

  const days = monthDays(month).filter((d) => d.date <= today)
  const t = attendanceTotals(entries, month)
  const y = attendanceTotals(entries, year)
  const workingDays = days.filter((d) => !d.sunday).length
  const unmarked = days.filter((d) => !d.sunday && !entries?.[d.date]).length

  return (
    <>
      <Link to="/attendance" className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-500 hover:text-ink-800">
        <ArrowLeft size={15} /> Attendance
      </Link>

      <div className="mb-5 flex flex-wrap items-center gap-4">
        <Avatar name={emp.name} hue={emp.hue} photo={emp.photo} size={52} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[22px] leading-tight font-extrabold tracking-tight text-ink-900">{emp.name}</h1>
          <p className="mt-0.5 text-sm text-ink-500">
            {emp.title}
            {emp.joined && ` · joined ${fmtDate(emp.joined, true)}`}
          </p>
        </div>
        {head && (
          <Select fit value={emp.id} onChange={(e) => navigate(`/attendance/${e.target.value}`)} aria-label="Show another person">
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </Select>
        )}
      </div>

      <Card className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-4 py-2.5">
          <MonthSwitch month={month} onChange={setMonth} />
          <p className="px-1 text-[13px] text-ink-500">
            {workingDays} working days{month === today.slice(0, 7) ? ' so far' : ''}
            {unmarked > 0 && <span className="font-semibold text-amber-700"> · {unmarked} not marked</span>}
          </p>
        </div>
        <dl className="grid grid-cols-2 divide-ink-100 sm:grid-cols-3 lg:grid-cols-6 lg:divide-x">
          <Tile label="Days worked" value={t.worked} sub={`of ${workingDays} working days`} />
          <Tile label="Present" value={t.P} tone="text-emerald-700" sub={t.P === 1 ? 'full day' : 'full days'} />
          <Tile label="Half days" value={t.H} tone={t.H ? 'text-amber-700' : undefined} />
          <Tile label="Leave" value={t.L} tone={t.L ? 'text-violet-700' : undefined} sub={`${y.L} in ${year}`} />
          <Tile label="Absent" value={t.A} tone={t.A ? 'text-rose-600' : undefined} sub={`${y.A} in ${year}`} />
          <Tile
            label="Hours worked"
            value={t.timed ? fmtDuration(t.minutes) : '—'}
            sub={t.timed ? `usually ${fmtTime(hhmm(t.inSum / t.timed))} – ${fmtTime(hhmm(t.outSum / t.timed))}` : 'no timings yet'}
          />
        </dl>
      </Card>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3 lg:self-start">
          <CardHeader title="Day by day" hint={head ? 'Change a status or a time and it is saved' : 'Marked by your heads'} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="border-y border-ink-100 bg-ink-50/60">
                <tr>
                  <Th>Date</Th>
                  <Th>Status</Th>
                  <Th>Time in</Th>
                  <Th>Time out</Th>
                  <Th align="right">Hours</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {[...days].reverse().map((d) => {
                  const entry = entries?.[d.date]
                  const off = entry?.mark === 'L' || entry?.mark === 'A'
                  const minutes = minutesBetween(entry?.in, entry?.out)
                  if (d.sunday && !entry && !head)
                    return (
                      <tr key={d.date} className="bg-ink-50/50 text-ink-400">
                        <Td className="tnum whitespace-nowrap">
                          {fmtDate(d.date)} <span className="text-xs">{d.weekdayShort}</span>
                        </Td>
                        <td colSpan={4} className="px-3 py-2.5 text-[13px]">
                          Sunday
                        </td>
                      </tr>
                    )
                  return (
                    <tr key={d.date} className={cn(d.date === today && 'bg-brand-50/50', d.sunday && !entry && 'bg-ink-50/50')}>
                      <Td className="tnum whitespace-nowrap">
                        <span className={cn('font-semibold', d.sunday && !entry ? 'text-ink-400' : 'text-ink-800')}>{fmtDate(d.date)}</span>{' '}
                        <span className={cn('text-xs', d.sunday ? 'text-rose-400' : 'text-ink-500')}>{d.date === today ? 'Today' : d.weekdayShort}</span>
                      </Td>
                      <Td>
                        {head ? (
                          <StatusSelect
                            label={`Attendance on ${d.date}`}
                            value={entry?.mark ?? ''}
                            options={MARK_OPTIONS}
                            onChange={(mark) => setAttendance(emp.id, d.date, mark || undefined)}
                          />
                        ) : entry ? (
                          <Badge tone={ATTENDANCE[entry.mark].tone}>{ATTENDANCE[entry.mark].label}</Badge>
                        ) : (
                          <span className="text-[13px] text-ink-400">{d.sunday ? 'Sunday' : 'Not marked'}</span>
                        )}
                      </Td>
                      {head ? (
                        <>
                          <Td>
                            <TimeInput label={`Time in on ${d.date}`} value={entry?.in} disabled={off} onChange={(v) => setAttendanceTime(emp.id, d.date, { in: v })} />
                          </Td>
                          <Td>
                            <TimeInput label={`Time out on ${d.date}`} value={entry?.out} disabled={off} onChange={(v) => setAttendanceTime(emp.id, d.date, { out: v })} />
                          </Td>
                        </>
                      ) : (
                        <>
                          <Td className="tnum text-ink-700">{entry?.in ? fmtTime(entry.in) : <span className="text-ink-300">—</span>}</Td>
                          <Td className="tnum text-ink-700">{entry?.out ? fmtTime(entry.out) : <span className="text-ink-300">—</span>}</Td>
                        </>
                      )}
                      <Td className="tnum text-right font-semibold whitespace-nowrap text-ink-700">
                        {minutes ? fmtDuration(minutes) : <span className="font-normal text-ink-300">{worked(entry) && entry?.in && !entry.out ? 'at work' : '—'}</span>}
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="Month by month" hint={`${y.worked} days worked in ${year} · ${y.L} leave · ${y.A} absent`} />
            <div className="overflow-x-auto">
              <table className="w-full text-sm [&_td]:px-2 [&_th]:px-2">
                <thead className="border-y border-ink-100 bg-ink-50/60">
                  <tr>
                    <Th>Month</Th>
                    {ATTENDANCE_ORDER.map((m) => (
                      <Th key={m} align="center">
                        <span title={ATTENDANCE[m].label}>{m}</span>
                      </Th>
                    ))}
                    <Th align="center">Days</Th>
                    <Th align="right">Hours</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {months.map((m) => {
                    const mt = attendanceTotals(entries, m)
                    return (
                      <tr key={m} onClick={() => setMonth(m)} className={cn('cursor-pointer hover:bg-ink-50', m === month && 'bg-brand-50/60')}>
                        <Td>
                          <button type="button" className={cn('font-semibold whitespace-nowrap', m === month ? 'text-brand-700' : 'text-ink-800')}>
                            {periodLabel(m, true)}
                          </button>
                        </Td>
                        {ATTENDANCE_ORDER.map((k) => (
                          <Td key={k} className="tnum text-center text-ink-700">
                            {mt[k] || <span className="text-ink-300">0</span>}
                          </Td>
                        ))}
                        <Td className="tnum text-center font-bold text-ink-900">{mt.worked}</Td>
                        <Td className="tnum text-right whitespace-nowrap text-ink-600">{mt.timed ? fmtDuration(mt.minutes) : '—'}</Td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardHeader title="Leave and absences" hint={`${y.L} leave · ${y.A} absent · ${y.H} half days in ${year}`} />
            {timeOff.length === 0 ? (
              <Empty icon={<CalendarX2 size={20} />} title="A clean sheet" hint={`No leave, absence or half day recorded in ${year}.`} />
            ) : (
              <ul className="scroll-thin max-h-80 divide-y divide-ink-100 overflow-y-auto border-t border-ink-100">
                {timeOff.map(([date, e]) => (
                  <li key={date} className="flex items-center gap-3 px-5 py-2">
                    <span className="tnum min-w-0 flex-1 font-semibold text-ink-800">
                      {fmtDate(date)} <span className="text-xs font-normal text-ink-500">{fmtWeekday(date)}</span>
                    </span>
                    {e.mark === 'H' && timing(e) && <span className="tnum text-xs text-ink-500">{timing(e)}</span>}
                    <Badge tone={ATTENDANCE[e.mark].tone}>{ATTENDANCE[e.mark].label}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  )
}

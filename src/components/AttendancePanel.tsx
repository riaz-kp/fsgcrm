import { CalendarX2, ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { attendanceTotals, monthDays, timing, toHHMM } from '../lib/attendance'
import { cn, fmtDate, fmtDuration, fmtTime, fmtWeekday, minutesBetween, periodLabel, shiftPeriod, todayISO } from '../lib/format'
import { ATTENDANCE, ATTENDANCE_ORDER, type Tone } from '../lib/meta'
import { useStore } from '../store'
import type { AttendanceMark, Employee } from '../types'
import { Badge, Card, CardHeader, Empty, IconButton, StatusSelect, Td, Th } from './ui'

export function TimeInput({ value, onChange, label, disabled }: { value?: string; onChange: (v: string) => void; label: string; disabled?: boolean }) {
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

export function MonthSwitch({ month, onChange }: { month: string; onChange: (m: string) => void }) {
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

/** One person's attendance: the month's totals, each day with its timings, every month on record and the days off. */
export function AttendancePanel({ emp, canEdit }: { emp: Employee; canEdit: boolean }) {
  const entries = useStore((s) => s.attendance[emp.id])
  const setAttendance = useStore((s) => s.setAttendance)
  const setAttendanceTime = useStore((s) => s.setAttendanceTime)
  const today = todayISO()
  const [month, setMonth] = useState(today.slice(0, 7))

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

  const days = monthDays(month).filter((d) => d.date <= today)
  const t = attendanceTotals(entries, month)
  const y = attendanceTotals(entries, year)
  const workingDays = days.filter((d) => !d.sunday).length
  const unmarked = days.filter((d) => !d.sunday && !entries?.[d.date]).length

  return (
    <>
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
            sub={t.timed ? `usually ${fmtTime(toHHMM(t.inSum / t.timed))} – ${fmtTime(toHHMM(t.outSum / t.timed))}` : 'no timings yet'}
          />
        </dl>
      </Card>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3 lg:self-start">
          <CardHeader title="Day by day" hint={canEdit ? 'Change a status or a time and it is saved' : 'Marked by your heads'} />
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
                  if (d.sunday && !entry && !canEdit)
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
                        {canEdit ? (
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
                      {canEdit ? (
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
                        {minutes ? fmtDuration(minutes) : <span className="font-normal text-ink-300">{entry?.in && !entry.out ? 'at work' : '—'}</span>}
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

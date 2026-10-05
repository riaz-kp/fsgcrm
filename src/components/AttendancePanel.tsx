import { CalendarX2, ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { attendanceTotals, monthDays, offDayName, timing, toHHMM, workingDays } from '../lib/attendance'
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
      // Touch screens set form text to 16px (see index.css), which needs a wider box to show the whole time.
      className="tnum h-7 w-[108px] rounded-md bg-white px-1.5 text-[13px] font-medium text-ink-800 ring-1 ring-ink-200 ring-inset focus:ring-2 focus:ring-brand-500 focus:outline-none disabled:bg-ink-50 disabled:text-ink-300 pointer-coarse:w-[136px]"
    />
  )
}

/** Overtime typed in hours (half hours and so on), kept in minutes. */
export function OtInput({ minutes, onChange, label, disabled }: { minutes?: number; onChange: (minutes?: number) => void; label: string; disabled?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="number"
        min={0}
        max={16}
        step={0.5}
        inputMode="decimal"
        value={minutes ? minutes / 60 : ''}
        disabled={disabled}
        placeholder="0"
        onChange={(e) => {
          const hours = parseFloat(e.target.value)
          onChange(Number.isFinite(hours) && hours > 0 ? Math.min(16, hours) * 60 : undefined)
        }}
        aria-label={label}
        title={label}
        className="tnum h-7 w-14 rounded-md bg-white px-1.5 text-right text-[13px] font-medium text-ink-800 ring-1 ring-ink-200 ring-inset placeholder:text-ink-300 focus:ring-2 focus:ring-brand-500 focus:outline-none disabled:bg-ink-50 disabled:text-ink-300"
      />
      <span className={cn('text-xs font-semibold', disabled ? 'text-ink-300' : 'text-ink-500')}>h</span>
    </span>
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

// On a day off for everyone there is no leave to take; someone who comes in anyway is marked present.
const OFF_DAY_OPTIONS: Array<{ value: AttendanceMark | ''; label: string; tone: Tone }> = [
  { value: '', label: 'Off day', tone: 'neutral' },
  { value: 'P', ...ATTENDANCE.P },
  { value: 'H', ...ATTENDANCE.H },
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
  const offDays = useStore((s) => s.offDays)
  const setAttendance = useStore((s) => s.setAttendance)
  const setAttendanceTime = useStore((s) => s.setAttendanceTime)
  const setOvertime = useStore((s) => s.setOvertime)
  const today = todayISO()
  const [month, setMonth] = useState(today.slice(0, 7))

  // Every month on record, newest first, and the leave, half days and off days worked in the year in view.
  const months = useMemo(() => [...new Set([today.slice(0, 7), ...Object.keys(entries ?? {}).map((d) => d.slice(0, 7))])].sort().reverse(), [entries, today])
  const year = month.slice(0, 4)
  const notable = useMemo(
    () =>
      Object.entries(entries ?? {})
        .filter(([date, e]) => date.startsWith(year) && (e.mark !== 'P' || offDayName(date, offDays)))
        .sort(([a], [b]) => b.localeCompare(a)),
    [entries, year, offDays],
  )

  const all = monthDays(month, offDays)
  const days = all.filter((d) => d.date <= today)
  const t = attendanceTotals(entries, month, offDays)
  const y = attendanceTotals(entries, year, offDays)
  const current = month === today.slice(0, 7)
  // The whole month's working days, and those up to today while the month is still running.
  const total = workingDays(month, offDays)
  const soFar = workingDays(month, offDays, today)
  const holidays = all.filter((d) => d.off && !d.sunday)
  const sundays = all.filter((d) => d.sunday).length
  const unmarked = days.filter((d) => !d.off && !entries?.[d.date]).length
  // The year's working days over the months that have attendance on record, so a part year compares like with like.
  const yearWorking = months.filter((m) => m.startsWith(year)).reduce((n, m) => n + workingDays(m, offDays, today), 0)

  return (
    <>
      <Card className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-4 py-2.5">
          <MonthSwitch month={month} onChange={setMonth} />
          <p className="px-1 text-[13px] text-ink-500">
            Off: {sundays} Sundays
            {holidays.map((d) => ` · ${fmtDate(d.date)} ${d.off}`).join('')}
            {unmarked > 0 && <span className="font-semibold text-amber-700"> · {unmarked} not marked</span>}
          </p>
        </div>
        <dl className="grid grid-cols-2 divide-ink-100 sm:grid-cols-4 lg:grid-cols-7 lg:divide-x">
          <Tile label="Working days" value={total} sub={current ? `${soFar} so far this month` : `${all.length - total} days off`} />
          <Tile
            label="Days worked"
            value={t.worked}
            sub={`of ${current ? soFar : total} working days${t.offWorked ? ` · ${t.offWorked === 1 ? '1 on an off day' : `${t.offWorked} on off days`}` : ''}`}
          />
          <Tile label="Present" value={t.P} tone="text-emerald-700" sub={t.P === 1 ? 'full day' : 'full days'} />
          <Tile label="Half days" value={t.H} tone={t.H ? 'text-amber-700' : undefined} />
          <Tile label="Leave" value={t.L} tone={t.L ? 'text-violet-700' : undefined} sub={`${y.L} in ${year}`} />
          <Tile label="Overtime" value={t.ot ? fmtDuration(t.ot) : '—'} tone={t.ot ? 'text-brand-700' : undefined} sub={y.ot ? `${fmtDuration(y.ot)} in ${year}` : 'none recorded'} />
          <Tile
            label="Hours worked"
            value={t.timed ? fmtDuration(t.minutes) : '—'}
            sub={t.usual ? `usually ${fmtTime(toHHMM(t.inSum / t.usual))} – ${fmtTime(toHHMM(t.outSum / t.usual))}` : t.timed ? 'no full day timed yet' : 'no timings yet'}
          />
        </dl>
      </Card>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3 lg:self-start">
          <CardHeader title="Day by day" hint={canEdit ? 'Change a status, a time or overtime and it is saved' : 'Marked by your heads'} />
          <div className="@container overflow-x-auto">
            <table className="stack w-full min-w-[600px] text-sm">
              <thead className="border-y border-ink-100 bg-ink-50/60">
                <tr>
                  <Th>Date</Th>
                  <Th>Status</Th>
                  <Th>Time in</Th>
                  <Th>Time out</Th>
                  <Th>OT</Th>
                  <Th align="right">Hours</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {[...days].reverse().map((d) => {
                  const entry = entries?.[d.date]
                  const away = !entry || entry.mark === 'L'
                  const minutes = minutesBetween(entry?.in, entry?.out)
                  const dateCell = (
                    <Td className="tnum whitespace-nowrap">
                      <span className={cn('font-semibold', d.off && !entry ? 'text-ink-400' : 'text-ink-800')}>{fmtDate(d.date)}</span>{' '}
                      <span className={cn('text-xs', d.off ? 'text-rose-400' : 'text-ink-500')}>{d.date === today ? 'Today' : d.weekdayShort}</span>
                      {d.off && !d.sunday && <span className="block text-xs font-normal text-ink-400">{d.off}</span>}
                    </Td>
                  )
                  if (d.off && !entry && !canEdit)
                    return (
                      <tr key={d.date} className="bg-ink-50/50 text-ink-400">
                        {dateCell}
                        <td data-label="Status" colSpan={5} className="px-3 py-2.5 text-[13px]">
                          Off · {d.off}
                        </td>
                      </tr>
                    )
                  return (
                    <tr key={d.date} className={cn(d.date === today && 'bg-brand-50/50', d.off && 'bg-ink-50/50')}>
                      {dateCell}
                      <Td label="Status">
                        {canEdit ? (
                          <StatusSelect
                            label={`Attendance on ${d.date}`}
                            value={entry?.mark ?? ''}
                            options={d.off ? OFF_DAY_OPTIONS : MARK_OPTIONS}
                            onChange={(mark) => setAttendance(emp.id, d.date, mark || undefined)}
                          />
                        ) : entry ? (
                          <Badge tone={ATTENDANCE[entry.mark].tone}>{ATTENDANCE[entry.mark].label}</Badge>
                        ) : (
                          <span className="text-[13px] text-ink-400">Not marked</span>
                        )}
                        {d.off && entry && entry.mark !== 'L' && <span className="mt-0.5 block text-xs font-semibold text-brand-700">on an off day</span>}
                      </Td>
                      {canEdit ? (
                        <>
                          <Td label="Time in">
                            <TimeInput label={`Time in on ${d.date}`} value={entry?.in} disabled={entry?.mark === 'L'} onChange={(v) => setAttendanceTime(emp.id, d.date, { in: v })} />
                          </Td>
                          <Td label="Time out">
                            <TimeInput label={`Time out on ${d.date}`} value={entry?.out} disabled={entry?.mark === 'L'} onChange={(v) => setAttendanceTime(emp.id, d.date, { out: v })} />
                          </Td>
                          <Td label="OT">
                            <OtInput label={`Overtime on ${d.date}, in hours`} minutes={entry?.ot} disabled={away} onChange={(m) => setOvertime(emp.id, d.date, m)} />
                          </Td>
                        </>
                      ) : (
                        <>
                          <Td label="Time in" className="tnum text-ink-700">
                            {entry?.in ? fmtTime(entry.in) : <span className="text-ink-300">—</span>}
                          </Td>
                          <Td label="Time out" className="tnum text-ink-700">
                            {entry?.out ? fmtTime(entry.out) : <span className="text-ink-300">—</span>}
                          </Td>
                          <Td label="OT" className="tnum font-semibold text-brand-700">
                            {entry?.ot ? fmtDuration(entry.ot) : <span className="font-normal text-ink-300">—</span>}
                          </Td>
                        </>
                      )}
                      <Td label="Hours" className="tnum text-right font-semibold whitespace-nowrap text-ink-700">
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
            <CardHeader title="Month by month" hint={`${y.worked} of ${yearWorking} working days on record in ${year} · ${y.L} leave${y.ot ? ` · ${fmtDuration(y.ot)} overtime` : ''}`} />
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
                    <Th align="center">
                      <span title="Overtime">OT</span>
                    </Th>
                    <Th align="center">
                      <span title="Days worked of the working days">Days</span>
                    </Th>
                    <Th align="right">Hours</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {months.map((m) => {
                    const mt = attendanceTotals(entries, m, offDays)
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
                        <Td className="tnum text-center whitespace-nowrap text-brand-700">{mt.ot ? fmtDuration(mt.ot) : <span className="text-ink-300">—</span>}</Td>
                        <Td className="tnum text-center whitespace-nowrap">
                          <span className="font-bold text-ink-900">{mt.worked}</span>
                          <span className="text-xs text-ink-400">/{workingDays(m, offDays, today)}</span>
                        </Td>
                        <Td className="tnum text-right whitespace-nowrap text-ink-600">{mt.timed ? fmtDuration(mt.minutes) : '—'}</Td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardHeader title="Leave, half days and off days worked" hint={`${y.L} leave · ${y.H} half days · ${y.offWorked} off days worked in ${year}`} />
            {notable.length === 0 ? (
              <Empty icon={<CalendarX2 size={20} />} title="A clean sheet" hint={`No leave, half day or off-day work recorded in ${year}.`} />
            ) : (
              <ul className="scroll-thin max-h-80 divide-y divide-ink-100 overflow-y-auto border-t border-ink-100">
                {notable.map(([date, e]) => {
                  const off = offDayName(date, offDays)
                  return (
                    <li key={date} className="flex items-center gap-3 px-5 py-2">
                      <span className="tnum min-w-0 flex-1 font-semibold text-ink-800">
                        {fmtDate(date)} <span className="text-xs font-normal text-ink-500">{fmtWeekday(date)}</span>
                      </span>
                      {e.mark !== 'L' && timing(e) && <span className="tnum text-xs text-ink-500">{timing(e)}</span>}
                      {off && e.mark !== 'L' ? <Badge tone="blue">Worked · {off}</Badge> : <Badge tone={ATTENDANCE[e.mark].tone}>{ATTENDANCE[e.mark].label}</Badge>}
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  )
}

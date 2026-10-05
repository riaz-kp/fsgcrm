import { ArrowLeft, UserRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { AttendancePanel, MonthSwitch, OtInput, TimeInput } from '../components/AttendancePanel'
import { Avatar, Button, Card, CardHeader, Empty, Field, Input, Modal, PageHeader, Select } from '../components/ui'
import { MARK_CELL, attendanceTotals, fmtOt, monthDays, offDayName, timing, workingDays } from '../lib/attendance'
import { cn, fmtDate, fmtDuration, fmtWeekday, nowHHMM, todayISO } from '../lib/format'
import { ATTENDANCE, ATTENDANCE_ORDER } from '../lib/meta'
import { can, useCurrentUser, useStore } from '../store'
import type { AttendanceMark } from '../types'

/** A working day steps through Present, Half day, Leave and blank; a day off for everyone through Present, Half day and blank. */
function next(mark: AttendanceMark | undefined, off: boolean): AttendanceMark | undefined {
  const order: AttendanceMark[] = off ? ['P', 'H'] : ATTENDANCE_ORDER
  return mark ? order[order.indexOf(mark) + 1] : order[0]
}

/** Make a date off for the whole firm (a public holiday, say), rename it, or make it a working day again. */
function OffDayForm({ date, onClose }: { date: string; onClose: () => void }) {
  const offDays = useStore((s) => s.offDays)
  const setOffDay = useStore((s) => s.setOffDay)
  const isOff = date in offDays
  const [name, setName] = useState(offDays[date] ?? '')
  const save = () => {
    setOffDay(date, name)
    onClose()
  }

  return (
    <Modal
      title={isOff ? `${fmtDate(date, true)} is an off day` : `Make ${fmtDate(date, true)} an off day?`}
      subtitle={`${fmtWeekday(date)} · for everyone at the firm`}
      onClose={onClose}
      footer={
        <>
          {isOff && (
            <Button
              variant="danger"
              onClick={() => {
                setOffDay(date, null)
                onClose()
              }}
              className="mr-auto"
            >
              Make it a working day
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save}>
            {isOff ? 'Save' : 'Mark off for everyone'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="What it is" hint="optional">
          <Input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} placeholder="e.g. Onam, Vishu, Gandhi Jayanti" autoFocus />
        </Field>
        <p className="text-[13px] text-ink-600">
          It is left out of everyone's working days. Anyone who comes in anyway can still be marked present, and the day shows as worked on an off day.
        </p>
      </div>
    </Modal>
  )
}

/* ---------- Register: everyone, one month ---------- */

const FIELD_LABEL = 'text-[11px] font-bold tracking-wide text-ink-400 uppercase'

export default function AttendancePage() {
  const me = useCurrentUser()
  const head = can(me, 'manage_attendance')
  const employees = useStore((s) => s.employees)
  const attendance = useStore((s) => s.attendance)
  const offDays = useStore((s) => s.offDays)
  const setAttendance = useStore((s) => s.setAttendance)
  const setAttendanceTime = useStore((s) => s.setAttendanceTime)
  const setOvertime = useStore((s) => s.setOvertime)
  const today = todayISO()
  const [month, setMonth] = useState(today.slice(0, 7))
  const [editingDay, setEditingDay] = useState<string>()

  // Whoever keeps attendance (the heads, by default) has the register for everyone; others see their own row.
  const people = head ? employees : employees.filter((e) => e.id === me.id)
  const days = useMemo(() => monthDays(month, offDays), [month, offDays])
  const current = month === today.slice(0, 7)
  const total = workingDays(month, offDays)
  const soFar = workingDays(month, offDays, today)
  const holidays = days.filter((d) => d.off && !d.sunday)
  const todayOff = offDayName(today, offDays)
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
        subtitle={head ? 'Daily register for the whole team, with time in and out and overtime. Open a person for their totals.' : 'Your attendance for the month.'}
        actions={
          !head && (
            <Link to={`/attendance/${me.id}`}>
              <Button>My attendance in detail</Button>
            </Link>
          )
        }
      />

      {head && current && (
        <Card className="mb-4">
          <CardHeader
            title={todayOff ? `Today · off (${todayOff})` : 'Today'}
            hint={todayOff ? 'Mark anyone who comes in anyway' : unmarkedToday.length ? `${unmarkedToday.length} not marked yet` : 'Everyone is marked'}
            action={
              !todayOff &&
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
              const away = !entry || entry.mark === 'L'
              return (
                <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg p-2 ring-1 ring-ink-200/80">
                  <Link to={`/attendance/${e.id}`} className="flex min-w-32 flex-1 items-center gap-2.5 hover:text-brand-700">
                    <Avatar name={e.name} hue={e.hue} photo={e.photo} size={28} />
                    <span className="truncate text-[13px] font-semibold text-ink-800 hover:text-brand-700">{e.name}</span>
                  </Link>
                  <span className="flex gap-0.5" role="group" aria-label={`Attendance for ${e.name}`}>
                    {ATTENDANCE_ORDER.filter((m) => !todayOff || m !== 'L').map((m) => (
                      <button
                        key={m}
                        type="button"
                        title={ATTENDANCE[m].label}
                        aria-pressed={entry?.mark === m}
                        onClick={() => markToday(e.id, m)}
                        className={cn(
                          'size-7 rounded-md text-xs font-bold transition-colors',
                          entry?.mark === m ? MARK_CELL[m] : 'text-ink-400 ring-1 ring-ink-200 ring-inset hover:bg-ink-50',
                        )}
                      >
                        {m}
                      </button>
                    ))}
                  </span>
                  {/* Each label stays with its box when the row wraps. */}
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span className="flex items-center gap-1.5">
                      <span className={FIELD_LABEL}>In</span>
                      <TimeInput label={`Time in for ${e.name}`} value={entry?.in} disabled={entry?.mark === 'L'} onChange={(v) => setAttendanceTime(e.id, today, { in: v })} />
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className={FIELD_LABEL}>Out</span>
                      <TimeInput label={`Time out for ${e.name}`} value={entry?.out} disabled={entry?.mark === 'L'} onChange={(v) => setAttendanceTime(e.id, today, { out: v })} />
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className={FIELD_LABEL}>OT</span>
                      <OtInput label={`Overtime for ${e.name} today, in hours`} minutes={entry?.ot} disabled={away} onChange={(m) => setOvertime(e.id, today, m)} />
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>
          <p className="px-5 py-3 text-xs text-ink-500">
            Marking someone present or half day notes the time as their time in. Set the time out when they leave, and any overtime in hours; all of it can be corrected.
          </p>
        </Card>
      )}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <MonthSwitch month={month} onChange={setMonth} />
            <p className="flex items-baseline gap-2 rounded-lg bg-ink-50 px-3 py-1.5 ring-1 ring-ink-200/70 ring-inset">
              <span className="text-xs font-semibold text-ink-500">Working days</span>
              <span className="tnum text-lg leading-none font-extrabold text-ink-900">{total}</span>
              {current && soFar < total && <span className="tnum text-xs text-ink-500">{soFar} so far</span>}
            </p>
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {ATTENDANCE_ORDER.map((m) => (
              <li key={m} className="flex items-center gap-1.5 text-[13px] text-ink-600">
                <span className={cn('flex size-5 items-center justify-center rounded text-[11px] font-bold', MARK_CELL[m])}>{m}</span>
                {ATTENDANCE[m].label}
              </li>
            ))}
            <li className="flex items-center gap-1.5 text-[13px] text-ink-600">
              <span className="size-5 rounded bg-ink-100 ring-1 ring-ink-200 ring-inset" />
              Off day
            </li>
            <li className="flex items-center gap-1.5 text-[13px] text-ink-600">
              <span className="relative flex size-5 items-center justify-center rounded bg-emerald-100 text-[11px] font-bold text-emerald-800">
                P<span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-brand-500" />
              </span>
              Overtime
            </li>
          </ul>
        </div>

        <div className="overflow-x-auto border-t border-ink-100">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-ink-50 py-2 pr-3 pl-5 text-left text-[11px] font-bold tracking-wider text-ink-500 uppercase">Person</th>
                {days.map((d) => {
                  const label = (
                    <>
                      <span className={cn('block text-[10px] font-bold', d.off ? 'text-rose-400' : 'text-ink-400')}>{d.weekday}</span>
                      <span className={cn('tnum block text-xs font-bold', d.date === today ? 'text-brand-700' : d.off ? 'text-ink-400' : 'text-ink-600')}>{d.day}</span>
                    </>
                  )
                  return (
                    <th key={d.date} className={cn('px-px py-1 text-center', d.date === today ? 'bg-brand-50' : d.off ? 'bg-ink-100' : 'bg-ink-50')}>
                      {/* Sundays are always off; any other day can be made off for everyone. */}
                      {head && !d.sunday ? (
                        <button
                          type="button"
                          onClick={() => setEditingDay(d.date)}
                          title={d.off ? `${d.off}: off for everyone. Click to change.` : `Make ${fmtDate(d.date)} an off day for everyone`}
                          className="w-full rounded px-0.5 hover:bg-white hover:ring-1 hover:ring-ink-300"
                        >
                          {label}
                        </button>
                      ) : (
                        <span title={d.off}>{label}</span>
                      )}
                    </th>
                  )
                })}
                {ATTENDANCE_ORDER.map((m) => (
                  <th key={m} className="bg-ink-50 px-2 text-center text-[11px] font-bold text-ink-500" title={ATTENDANCE[m].label}>
                    {m}
                  </th>
                ))}
                <th className="bg-ink-50 px-2 text-center text-[11px] font-bold text-ink-500" title="Overtime recorded this month">
                  OT
                </th>
                <th className="bg-ink-50 pr-5 pl-2 text-center text-[11px] font-bold tracking-wider whitespace-nowrap text-ink-500 uppercase" title="Days worked, a half day counting as half, of the month's working days">
                  Days
                  <span className="block text-[10px] font-semibold tracking-normal normal-case">of {total}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {people.map((e) => {
                const t = attendanceTotals(attendance[e.id], month, offDays)
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
                      const state = mark
                        ? [ATTENDANCE[mark].label, timing(entry), entry?.ot && `OT ${fmtDuration(entry.ot)}`, d.off && `worked on an off day (${d.off})`].filter(Boolean).join(' · ')
                        : d.off
                          ? `Off · ${d.off}`
                          : 'not marked'
                      return (
                        <td key={d.date} className={cn('border-t border-ink-100 px-px py-1 text-center', d.date === today ? 'bg-brand-50/60' : d.off && 'bg-ink-50')}>
                          <button
                            type="button"
                            disabled={!head || future}
                            onClick={() => setAttendance(e.id, d.date, next(mark, !!d.off))}
                            aria-label={`${e.name}, ${d.date}: ${state}`}
                            title={mark ? state : d.off}
                            className={cn(
                              'relative size-6 rounded text-[11px] font-bold transition-colors disabled:cursor-default',
                              mark ? MARK_CELL[mark] : d.off ? 'text-ink-300' : future ? 'text-ink-200' : 'text-ink-300 ring-1 ring-ink-200 ring-inset',
                              mark && d.off && 'ring-2 ring-brand-300',
                              head && !future && 'hover:ring-2 hover:ring-brand-400',
                            )}
                          >
                            {mark ?? (d.off ? '·' : '')}
                            {!!entry?.ot && <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-brand-500" />}
                          </button>
                        </td>
                      )
                    })}
                    {ATTENDANCE_ORDER.map((m) => (
                      <td key={m} className="tnum border-t border-ink-100 px-2 text-center text-[13px] font-bold text-ink-700">
                        {t[m] || <span className="font-normal text-ink-300">0</span>}
                      </td>
                    ))}
                    <td className="tnum border-t border-ink-100 px-2 text-center text-[13px] font-bold whitespace-nowrap text-brand-700">
                      {t.ot ? fmtOt(t.ot) : <span className="font-normal text-ink-300">—</span>}
                    </td>
                    <td
                      className="tnum border-t border-ink-100 pr-5 pl-2 text-center text-[13px] font-extrabold text-ink-900"
                      title={t.offWorked ? `${t.worked - t.offWorked} on working days and ${t.offWorked} on off days` : undefined}
                    >
                      {t.worked}
                      {t.offWorked > 0 && <span className="ml-0.5 text-[11px] font-bold text-brand-700">*</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="space-y-1 border-t border-ink-100 px-5 py-2.5 text-xs text-ink-500">
          <p>
            Off this month: {days.filter((d) => d.sunday).length} Sundays
            {holidays.map((d) => ` · ${fmtDate(d.date)}${d.off !== 'Off day' ? ` ${d.off}` : ''}`).join('')}. Days marked * include work on an off day.
          </p>
          <p>
            {head
              ? 'Click a day to step through Present, Half day, Leave and blank (on an off day, Present, Half day and blank). Click a date to make it an off day for everyone, such as a holiday. A dot marks overtime, entered in hours under Today or on a person’s page.'
              : 'Marked by your heads. Ask them if a day looks wrong.'}
          </p>
        </div>
      </Card>

      {editingDay && <OffDayForm date={editingDay} onClose={() => setEditingDay(undefined)} />}
    </>
  )
}

/* ---------- Detail: one person ---------- */

export function AttendanceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const me = useCurrentUser()
  const head = can(me, 'manage_attendance')
  const employees = useStore((s) => s.employees)
  const emp = employees.find((e) => e.id === id)

  if (!emp) {
    return (
      <Card>
        <Empty title="No such person" hint="They may have been removed when the sample data was reset." action={<Link to="/attendance"><Button>Back to attendance</Button></Link>} />
      </Card>
    )
  }
  // Only those who keep attendance look at other people's.
  if (!head && emp.id !== me.id) return <Navigate to={`/attendance/${me.id}`} replace />

  return (
    <>
      <Link to="/attendance" className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-500 hover:text-ink-800">
        <ArrowLeft size={15} /> Attendance
      </Link>

      <div className="mb-5 flex flex-wrap items-center gap-4">
        <Avatar name={emp.name} hue={emp.hue} photo={emp.photo} size={52} />
        <div className="min-w-48 flex-1">
          <h1 className="truncate text-[22px] leading-tight font-extrabold tracking-tight text-ink-900">{emp.name}</h1>
          <p className="mt-0.5 text-sm text-ink-500">
            {emp.title}
            {emp.joined && ` · joined ${fmtDate(emp.joined, true)}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {head && (
            <Select fit value={emp.id} onChange={(e) => navigate(`/attendance/${e.target.value}`)} aria-label="Show another person">
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
          )}
          <Link to={`/team/${emp.id}`}>
            <Button icon={<UserRound size={15} />}>Profile</Button>
          </Link>
        </div>
      </div>

      <AttendancePanel emp={emp} canEdit={head} />
    </>
  )
}

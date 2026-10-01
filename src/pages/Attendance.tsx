import { ArrowLeft, UserRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { AttendancePanel, MonthSwitch, TimeInput } from '../components/AttendancePanel'
import { Avatar, Button, Card, CardHeader, Empty, PageHeader, Select } from '../components/ui'
import { MARK_CELL, attendanceTotals, monthDays, timing } from '../lib/attendance'
import { cn, fmtDate, nowHHMM, todayISO } from '../lib/format'
import { ATTENDANCE, ATTENDANCE_ORDER } from '../lib/meta'
import { isHead, useCurrentUser, useStore } from '../store'
import type { AttendanceMark } from '../types'

/** Unmarked -> Present -> Half day -> Leave -> Absent -> unmarked */
function next(mark?: AttendanceMark): AttendanceMark | undefined {
  if (!mark) return 'P'
  return ATTENDANCE_ORDER[ATTENDANCE_ORDER.indexOf(mark) + 1]
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
                          entry?.mark === m ? MARK_CELL[m] : 'text-ink-400 ring-1 ring-ink-200 ring-inset hover:bg-ink-50',
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
                <span className={cn('flex size-5 items-center justify-center rounded text-[11px] font-bold', MARK_CELL[m])}>{m}</span>
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
                              mark ? MARK_CELL[mark] : d.sunday ? 'text-ink-300' : future ? 'text-ink-200' : 'text-ink-300 ring-1 ring-ink-200 ring-inset',
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

export function AttendanceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const me = useCurrentUser()
  const head = isHead(me)
  const employees = useStore((s) => s.employees)
  const emp = employees.find((e) => e.id === id)

  if (!emp) {
    return (
      <Card>
        <Empty title="No such person" hint="They may have been removed when the sample data was reset." action={<Link to="/attendance"><Button>Back to attendance</Button></Link>} />
      </Card>
    )
  }
  // Only heads look at other people's attendance.
  if (!head && emp.id !== me.id) return <Navigate to={`/attendance/${me.id}`} replace />

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
        <Link to={`/team/${emp.id}`}>
          <Button icon={<UserRound size={15} />}>Profile</Button>
        </Link>
      </div>

      <AttendancePanel emp={emp} canEdit={head} />
    </>
  )
}

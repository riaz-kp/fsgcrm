import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Avatar, Button, Card, CardHeader, IconButton, PageHeader } from '../components/ui'
import { addDays, cn, parseISO, periodLabel, shiftPeriod, todayISO } from '../lib/format'
import { ATTENDANCE, ATTENDANCE_ORDER } from '../lib/meta'
import { isHead, useCurrentUser, useStore } from '../store'
import type { AttendanceMark } from '../types'

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

export default function AttendancePage() {
  const me = useCurrentUser()
  const head = isHead(me)
  const employees = useStore((s) => s.employees)
  const attendance = useStore((s) => s.attendance)
  const setAttendance = useStore((s) => s.setAttendance)
  const today = todayISO()
  const [month, setMonth] = useState(today.slice(0, 7))

  // Heads keep the register for everyone; others see their own row.
  const people = head ? employees : employees.filter((e) => e.id === me.id)

  const days = useMemo(() => {
    const out: Array<{ date: string; day: number; weekday: string; sunday: boolean }> = []
    for (let d = `${month}-01`; d.startsWith(month); d = addDays(d, 1)) {
      const wd = parseISO(d).getDay()
      out.push({ date: d, day: Number(d.slice(8)), weekday: 'SMTWTFS'[wd], sunday: wd === 0 })
    }
    return out
  }, [month])

  const totals = (id: string) => {
    const t = { P: 0, H: 0, L: 0, A: 0 }
    for (const d of days) {
      const m = attendance[id]?.[d.date]
      if (m) t[m]++
    }
    return t
  }
  const unmarkedToday = people.filter((e) => !attendance[e.id]?.[today])

  return (
    <>
      <PageHeader
        title="Attendance"
        subtitle={head ? 'Daily register for the whole team. Click a day to change it.' : 'Your attendance for the month.'}
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
          <ul className="grid gap-2 px-5 pb-5 sm:grid-cols-2 xl:grid-cols-3">
            {people.map((e) => {
              const mark = attendance[e.id]?.[today]
              return (
                <li key={e.id} className="flex items-center gap-2.5 rounded-lg p-2 ring-1 ring-ink-200/80">
                  <Avatar name={e.name} hue={e.hue} photo={e.photo} size={28} />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink-800">{e.name}</span>
                  <span className="flex gap-0.5" role="group" aria-label={`Attendance for ${e.name}`}>
                    {ATTENDANCE_ORDER.map((m) => (
                      <button
                        key={m}
                        type="button"
                        title={ATTENDANCE[m].label}
                        aria-pressed={mark === m}
                        onClick={() => setAttendance(e.id, today, mark === m ? undefined : m)}
                        className={cn(
                          'size-7 rounded-md text-xs font-bold transition-colors',
                          mark === m ? CELL[m] : 'text-ink-400 ring-1 ring-ink-200 ring-inset hover:bg-ink-50',
                        )}
                      >
                        {m}
                      </button>
                    ))}
                  </span>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-1">
            <IconButton label="Previous month" onClick={() => setMonth((m) => shiftPeriod(m, -1))}>
              <ChevronLeft size={18} />
            </IconButton>
            <h2 className="w-36 text-center text-base font-extrabold text-ink-900">{periodLabel(month)}</h2>
            <IconButton label="Next month" onClick={() => setMonth((m) => shiftPeriod(m, 1))} disabled={month >= today.slice(0, 7)}>
              <ChevronRight size={18} />
            </IconButton>
          </div>
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
                  <th key={m} className="bg-ink-50 px-2 text-center text-[11px] font-bold text-ink-500 last:pr-5" title={ATTENDANCE[m].label}>
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {people.map((e) => {
                const t = totals(e.id)
                return (
                  <tr key={e.id}>
                    <td className="sticky left-0 z-10 border-t border-ink-100 bg-white py-1.5 pr-3 pl-5">
                      <span className="flex items-center gap-2 whitespace-nowrap">
                        <Avatar name={e.name} hue={e.hue} photo={e.photo} size={24} />
                        <span className="font-semibold text-ink-800">{e.name}</span>
                      </span>
                    </td>
                    {days.map((d) => {
                      const mark = attendance[e.id]?.[d.date]
                      const future = d.date > today
                      return (
                        <td key={d.date} className={cn('border-t border-ink-100 px-px py-1 text-center', d.date === today && 'bg-brand-50/60')}>
                          <button
                            type="button"
                            disabled={!head || future}
                            onClick={() => setAttendance(e.id, d.date, next(mark))}
                            aria-label={`${e.name}, ${d.date}: ${mark ? ATTENDANCE[mark].label : d.sunday ? 'Sunday' : 'not marked'}`}
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
                      <td key={m} className="tnum border-t border-ink-100 px-2 text-center text-[13px] font-bold text-ink-700 last:pr-5">
                        {t[m] || <span className="font-normal text-ink-300">0</span>}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t border-ink-100 px-5 py-2.5 text-xs text-ink-500">
          {head ? 'Click a day to step through Present, Half day, Leave, Absent and blank. Sundays are left blank unless someone worked.' : 'Marked by your heads. Ask them if a day looks wrong.'}
        </p>
      </Card>
    </>
  )
}

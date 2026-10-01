import type { AttendanceEntry, AttendanceMark } from '../types'
import { addDays, minutesBetween, parseISO } from './format'

export interface MonthDay {
  date: string
  day: number
  /** Single letter for the register, short name for the detail page. */
  weekday: string
  weekdayShort: string
  sunday: boolean
}

/** Every day of a 'YYYY-MM' month. */
export function monthDays(month: string): MonthDay[] {
  const out: MonthDay[] = []
  for (let d = `${month}-01`; d.startsWith(month); d = addDays(d, 1)) {
    const wd = parseISO(d).getDay()
    out.push({
      date: d,
      day: Number(d.slice(8)),
      weekday: 'SMTWTFS'[wd],
      weekdayShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][wd],
      sunday: wd === 0,
    })
  }
  return out
}

export interface AttendanceTotals extends Record<AttendanceMark, number> {
  /** Days worked, a half day counting as half. */
  worked: number
  /** Minutes between time in and time out, over the days that have both. */
  minutes: number
  /** Days that have both times, for averages. */
  timed: number
  /** Sum of time-in and time-out, in minutes past midnight, over those days. */
  inSum: number
  outSum: number
}

const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))

/** Counts and hours for one person's entries in a month ('YYYY-MM') or a year ('YYYY'). */
export function attendanceTotals(days: Record<string, AttendanceEntry> | undefined, prefix: string): AttendanceTotals {
  const t: AttendanceTotals = { P: 0, H: 0, L: 0, A: 0, worked: 0, minutes: 0, timed: 0, inSum: 0, outSum: 0 }
  for (const [date, e] of Object.entries(days ?? {})) {
    if (!date.startsWith(prefix)) continue
    t[e.mark]++
    if (e.in && e.out) {
      t.minutes += minutesBetween(e.in, e.out)
      t.timed++
      t.inSum += toMinutes(e.in)
      t.outSum += toMinutes(e.out)
    }
  }
  t.worked = t.P + t.H / 2
  return t
}

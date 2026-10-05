import type { AttendanceEntry, AttendanceMark, OffDays } from '../types'
import { addDays, fmtTime, minutesBetween, parseISO } from './format'

/** Cell colours for the three marks, shared by the register and a person's own page. */
export const MARK_CELL: Record<AttendanceMark, string> = {
  P: 'bg-emerald-100 text-emerald-800',
  H: 'bg-amber-100 text-amber-900',
  L: 'bg-violet-100 text-violet-800',
}

/** '9:12 am – 5:48 pm', or just the time in while the person is still at work. */
export function timing(e?: AttendanceEntry): string {
  if (!e?.in) return ''
  return e.out ? `${fmtTime(e.in)} – ${fmtTime(e.out)}` : `in ${fmtTime(e.in)}`
}

/** Minutes past midnight -> 'HH:MM'. */
export function toHHMM(minutes: number): string {
  const m = Math.round(minutes)
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/** Overtime as the register shows it: 150 -> '2.5h'. */
export function fmtOt(minutes: number): string {
  return `${Math.round((minutes / 60) * 10) / 10}h`
}

/** Why a day is off for everyone: 'Sunday', the holiday's name, or 'Off day'. Undefined on a working day. */
export function offDayName(date: string, offDays: OffDays): string | undefined {
  if (date in offDays) return offDays[date] || 'Off day'
  return parseISO(date).getDay() === 0 ? 'Sunday' : undefined
}

export interface MonthDay {
  date: string
  day: number
  /** Single letter for the register, short name for the detail page. */
  weekday: string
  weekdayShort: string
  sunday: boolean
  /** Set when the day is off for the whole firm: 'Sunday' or the holiday's name. */
  off?: string
}

/** Every day of a 'YYYY-MM' month, with the firm's off days marked. */
export function monthDays(month: string, offDays: OffDays = {}): MonthDay[] {
  const out: MonthDay[] = []
  for (let d = `${month}-01`; d.startsWith(month); d = addDays(d, 1)) {
    const wd = parseISO(d).getDay()
    out.push({
      date: d,
      day: Number(d.slice(8)),
      weekday: 'SMTWTFS'[wd],
      weekdayShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][wd],
      sunday: wd === 0,
      off: offDayName(d, offDays),
    })
  }
  return out
}

/** Days in a month ('YYYY-MM') or a year ('YYYY') that are not off for the firm, up to and including `upTo` if given. */
export function workingDays(prefix: string, offDays: OffDays, upTo?: string): number {
  const months = prefix.length === 4 ? Array.from({ length: 12 }, (_, i) => `${prefix}-${String(i + 1).padStart(2, '0')}`) : [prefix]
  return months.reduce((n, m) => n + monthDays(m, offDays).filter((d) => !d.off && (!upTo || d.date <= upTo)).length, 0)
}

export interface AttendanceTotals extends Record<AttendanceMark, number> {
  /** Days worked, a half day counting as half, off days included. */
  worked: number
  /** Of those, the days worked on an off day. */
  offWorked: number
  /** Overtime recorded, in minutes. */
  ot: number
  /** Minutes between time in and time out, over the days that have both. */
  minutes: number
  /** Days that have both times. */
  timed: number
  /** Full days on working days that have both times, and the sums of their time in and out in minutes past midnight, for the usual hours. */
  usual: number
  inSum: number
  outSum: number
}

const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))

/** Counts and hours for one person's entries in a month ('YYYY-MM') or a year ('YYYY'). */
export function attendanceTotals(days: Record<string, AttendanceEntry> | undefined, prefix: string, offDays: OffDays = {}): AttendanceTotals {
  const t: AttendanceTotals = { P: 0, H: 0, L: 0, worked: 0, offWorked: 0, ot: 0, minutes: 0, timed: 0, usual: 0, inSum: 0, outSum: 0 }
  for (const [date, e] of Object.entries(days ?? {})) {
    if (!date.startsWith(prefix)) continue
    t[e.mark]++
    const share = e.mark === 'P' ? 1 : e.mark === 'H' ? 0.5 : 0
    const off = !!offDayName(date, offDays)
    t.worked += share
    if (off) t.offWorked += share
    t.ot += e.ot ?? 0
    if (e.in && e.out) {
      t.minutes += minutesBetween(e.in, e.out)
      t.timed++
      // A half day or a few hours on a Sunday would pull the usual hours off.
      if (e.mark === 'P' && !off) {
        t.usual++
        t.inSum += toMinutes(e.in)
        t.outSum += toMinutes(e.out)
      }
    }
  }
  return t
}

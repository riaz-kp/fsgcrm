export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export function uid(prefix = 'id'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

/* ---------- Dates (plain YYYY-MM-DD strings, local time) ---------- */

export function toISO(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayISO(): string {
  return toISO(new Date())
}

export function addDays(iso: string, n: number): string {
  const d = parseISO(iso)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

export function daysUntil(iso: string): number {
  const ms = parseISO(iso).getTime() - parseISO(todayISO()).getTime()
  return Math.round(ms / 86_400_000)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

export function fmtDate(iso: string, withYear = false): string {
  const d = parseISO(iso)
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`
  return withYear || d.getFullYear() !== new Date().getFullYear() ? `${base} ${d.getFullYear()}` : base
}

export function fmtWeekday(iso: string): string {
  return parseISO(iso).toLocaleDateString('en-IN', { weekday: 'short' })
}

/** "Today", "Tomorrow", "in 5 days", "3 days overdue" */
export function relDue(iso: string): string {
  const n = daysUntil(iso)
  if (n === 0) return 'Today'
  if (n === 1) return 'Tomorrow'
  if (n === -1) return 'Yesterday'
  if (n < 0) return `${-n} days overdue`
  return `in ${n} days`
}

/** '2026-09' -> 'September 2026' */
export function periodLabel(period: string, short = false): string {
  const [y, m] = period.split('-').map(Number)
  return `${(short ? MONTHS : MONTHS_LONG)[m - 1]} ${short ? String(y).slice(2) : y}`
}

export function shiftPeriod(period: string, n: number): string {
  const [y, m] = period.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return toISO(d).slice(0, 7)
}

/** The return period currently being worked on: last month. */
export function currentGstPeriod(): string {
  return shiftPeriod(todayISO().slice(0, 7), -1)
}

/** Indian financial year for a date: '2026-27' */
export function financialYear(iso = todayISO()): string {
  const d = parseISO(iso)
  const start = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1
  return `${start}-${String(start + 1).slice(2)}`
}

/* ---------- Numbers & text ---------- */

const inrFmt = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

export function inr(n: number): string {
  return inrFmt.format(n)
}

export function fileSize(kb: number): string {
  return kb >= 1024 ? `${(kb / 1024).toFixed(kb >= 10_240 ? 0 : 1)} MB` : `${Math.round(kb)} KB`
}

export function initials(name: string): string {
  const words = name
    .replace(/^(Dr|Mr|Mrs|Ms)\.?\s+/i, '')
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
  return ((words[0]?.[0] ?? '') + (words[1]?.[0] ?? '')).toUpperCase()
}

export function longToday(): string {
  return new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export function greeting(): string {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

/** '16:30' -> '4:30 pm' */
export function fmtTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`
}

/** Days until the next occurrence of a birthday (0 = today). */
export function daysToBirthday(dob: string): number {
  const today = parseISO(todayISO())
  const [, m, d] = dob.split('-').map(Number)
  const next = new Date(today.getFullYear(), m - 1, d)
  if (next < today) next.setFullYear(today.getFullYear() + 1)
  return Math.round((next.getTime() - today.getTime()) / 86_400_000)
}

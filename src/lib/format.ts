export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

/** Random hex, from the browser's secure generator (which, unlike randomUUID, also works on a plain-http LAN address). */
export function randomId(bytes = 8): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Ids are made in the browser, by several people at once, so they need to be too random to collide. */
export function uid(prefix = 'id'): string {
  return `${prefix}-${randomId(8)}`
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

/** The time right now as 'HH:MM'. */
export function nowHHMM(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Minutes from one 'HH:MM' to a later one on the same day; 0 if either is missing or they are out of order. */
export function minutesBetween(from?: string, to?: string): number {
  if (!from || !to) return 0
  const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
  return Math.max(0, mins(to) - mins(from))
}

/** 495 -> '8h 15m' */
export function fmtDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return m ? `${h}h ${m}m` : `${h}h`
}

/* ---------- Contact links ---------- */

/** Numbers are stored the way people write them; a bare ten-digit number is taken to be Indian. */
function dialDigits(phone: string): string {
  const d = phone.replace(/\D/g, '')
  return d.length === 10 ? `91${d}` : d
}

export function telHref(phone: string): string {
  return `tel:+${dialDigits(phone)}`
}

export function whatsappHref(phone: string): string {
  return `https://wa.me/${dialDigits(phone)}`
}

/** Completed years since a date of birth. */
export function ageFrom(dob: string): number {
  const born = parseISO(dob)
  const today = parseISO(todayISO())
  const hadBirthday = today.getMonth() > born.getMonth() || (today.getMonth() === born.getMonth() && today.getDate() >= born.getDate())
  return today.getFullYear() - born.getFullYear() - (hadBirthday ? 0 : 1)
}

/** How long someone has been with the firm: 'new', '7 mo', '3 yrs'. */
export function tenure(joined: string): string {
  const months = Math.max(0, Math.floor(-daysUntil(joined) / 30.44))
  if (months < 1) return 'new'
  return months < 12 ? `${months} mo` : `${Math.floor(months / 12)} yr${months >= 24 ? 's' : ''}`
}

/** Days until the next occurrence of a birthday (0 = today). */
export function daysToBirthday(dob: string): number {
  const today = parseISO(todayISO())
  const [, m, d] = dob.split('-').map(Number)
  const next = new Date(today.getFullYear(), m - 1, d)
  if (next < today) next.setFullYear(today.getFullYear() + 1)
  return Math.round((next.getTime() - today.getTime()) / 86_400_000)
}

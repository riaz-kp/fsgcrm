/**
 * Backups of everything the app keeps, as one JSON file, and putting one back.
 *
 * A restore goes through the store like any other change, so live it is saved to the database by sync.ts and
 * shows in the change history under whoever restored it. Team members are in the file for reference but are
 * never restored: logins, roles and permissions stay as they are now.
 */
import type { SeedData } from '../data/seed'
import { useStore, type State } from '../store'
import { todayISO } from './format'

export const BACKUP_KIND = 'fsg-crm-backup'

/** The lists a restore puts back, each keyed by its id. */
const LISTS = ['scopes', 'clients', 'leads', 'tasks', 'gst', 'tds', 'it', 'audits', 'services', 'consultations', 'reminders'] as const
type ListKey = (typeof LISTS)[number]

export const LIST_LABEL: Record<ListKey | 'attendance' | 'offDays' | 'templates', string> = {
  scopes: 'Scopes of work',
  clients: 'Clients',
  leads: 'Leads',
  tasks: 'Tasks',
  gst: 'GST filings',
  tds: 'TDS filings',
  it: 'Income tax filings',
  audits: 'Audits',
  services: 'One-time jobs',
  consultations: 'Consultations',
  reminders: 'Reminders',
  attendance: 'Attendance days',
  offDays: 'Holidays',
  templates: 'Message templates',
}

export interface Backup {
  kind: typeof BACKUP_KIND
  /** Bumped if the file's layout changes. */
  format: 1
  takenAt: string
  by: string
  /** Whether portal and DSC passwords are in the file: only when whoever took it may see them. */
  passwords: boolean
  data: SeedData
}

const pk = (key: ListKey) => (key === 'scopes' ? 'key' : 'id')
const idOf = (key: ListKey, item: object) => String((item as Record<string, unknown>)[pk(key)])

export function takeBackup(by: string, passwords: boolean): Backup {
  const s = useStore.getState()
  const data: SeedData = {
    employees: s.employees,
    clients: passwords ? s.clients : s.clients.map((c) => ({ ...c, credentials: [], dscs: [] })),
    leads: s.leads,
    tasks: s.tasks,
    gst: s.gst,
    tds: s.tds,
    it: s.it,
    audits: s.audits,
    services: s.services,
    consultations: s.consultations,
    attendance: s.attendance,
    offDays: s.offDays,
    scopes: s.scopes,
    reminders: s.reminders,
    templates: s.templates,
  }
  return { kind: BACKUP_KIND, format: 1, takenAt: new Date().toISOString(), by, passwords, data }
}

export function backupFile(b: Backup): Blob {
  return new Blob([JSON.stringify(b)], { type: 'application/json' })
}

export const backupName = () => `FSG backup ${todayISO()}.json`

/** Reads a file chosen for restoring; throws a message fit to show if it is not an FSG backup. */
export async function readBackup(file: File): Promise<Backup> {
  let parsed: unknown
  try {
    parsed = JSON.parse(await file.text())
  } catch {
    throw new Error('This file is not a backup from this app: it could not be read.')
  }
  const b = parsed as Partial<Backup>
  if (!b || b.kind !== BACKUP_KIND || !b.data) throw new Error('This file is not a backup from this app.')
  if (b.format !== 1) throw new Error('This backup was made by a newer version of the app. Reload the app and try again.')
  for (const key of LISTS) if (!Array.isArray(b.data[key])) throw new Error(`The backup is incomplete: ${LIST_LABEL[key].toLowerCase()} are missing.`)
  return b as Backup
}

/* ---------- Working out a restore ---------- */

/** JSON with keys in a fixed order, so two copies of a record compare equal however they were built. */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`
  if (v && typeof v === 'object')
    return `{${Object.keys(v)
      .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`)
      .join(',')}}`
  return JSON.stringify(v)
}

export interface RestoreCount {
  label: string
  /** In the backup but not here now. */
  added: number
  /** Here and in the backup, but different. */
  changed: number
  /** Here now, not in the backup: removed only when asked to. */
  extra: number
}

export interface RestorePlan {
  counts: RestoreCount[]
  next: Partial<State>
}

type Entries = Record<string, string>

/** For attendance: one entry per person and day. */
function flatAttendance(a: SeedData['attendance']): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [emp, days] of Object.entries(a ?? {})) for (const [date, e] of Object.entries(days)) out[`${emp}|${date}`] = e
  return out
}

function countMap(label: string, now: Record<string, unknown>, then: Record<string, unknown>): RestoreCount {
  let added = 0
  let changed = 0
  for (const [k, v] of Object.entries(then)) {
    if (!(k in now)) added++
    else if (stable(now[k]) !== stable(v)) changed++
  }
  return { label, added, changed, extra: Object.keys(now).filter((k) => !(k in then)).length }
}

/**
 * What a restore would do. Every record in the backup goes back as it was; with `removeOthers`, records made since
 * the backup are removed too, otherwise they stay. A backup without passwords leaves portal logins and DSCs as
 * they are now.
 */
export function planRestore(b: Backup, removeOthers: boolean): RestorePlan {
  const s = useStore.getState()
  const counts: RestoreCount[] = []
  const next: Record<string, unknown> = {}

  for (const key of LISTS) {
    const now = s[key] as object[]
    let then = b.data[key] as object[]
    if (key === 'clients' && !b.passwords) {
      const current = new Map(s.clients.map((c) => [c.id, c]))
      then = b.data.clients.map((c) => ({ ...c, credentials: current.get(c.id)?.credentials ?? [], dscs: current.get(c.id)?.dscs ?? [] }))
    }
    const nowById = new Map(now.map((x) => [idOf(key, x), x]))
    const thenById = new Map(then.map((x) => [idOf(key, x), x]))
    counts.push(countMap(LIST_LABEL[key], Object.fromEntries(nowById), Object.fromEntries(thenById)))
    // Keep the order the app has them in now, with records coming back placed where the backup had them.
    const kept = removeOthers ? [] : now.filter((x) => !thenById.has(idOf(key, x)))
    // A record that has not changed keeps the copy the app has, so nothing is sent for it.
    const restored = then.map((x) => {
      const mine = nowById.get(idOf(key, x))
      return mine && stable(mine) === stable(x) ? mine : x
    })
    next[key] = key === 'clients' || key === 'leads' || key === 'tasks' || key === 'services' ? [...kept, ...restored] : [...restored, ...kept]
  }

  // Attendance: person -> day -> entry.
  counts.push(countMap(LIST_LABEL.attendance, flatAttendance(s.attendance), flatAttendance(b.data.attendance)))
  const attendance: SeedData['attendance'] = removeOthers ? {} : structuredClone(s.attendance)
  for (const [emp, days] of Object.entries(b.data.attendance ?? {})) attendance[emp] = { ...attendance[emp], ...days }
  next.attendance = attendance

  for (const key of ['offDays', 'templates'] as const) {
    const now = s[key] as Entries
    const then = (b.data[key] ?? {}) as Entries
    counts.push(countMap(LIST_LABEL[key], now, then))
    next[key] = removeOthers ? { ...then } : { ...now, ...then }
  }

  return { counts, next: next as Partial<State> }
}

export function applyRestore(plan: RestorePlan) {
  useStore.setState(plan.next)
}

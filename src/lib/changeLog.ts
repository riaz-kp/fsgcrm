/**
 * Who changed what. Live, the database keeps the log itself (a trigger on every table the work is kept in, see
 * supabase/migrations/20261105000000_dsc_hours_history.sql), so nothing done through the app can skip it; this
 * module only reads it. On sample data there is no database, so changes made in this browser are noted here instead,
 * the same way: one person's run of edits to one record within two minutes is one entry.
 */
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { useStore, type State } from '../store'
import type { ChangeAction, ChangeEntry } from '../types'
import { uid } from './format'
import { LIVE, supabase } from './supabase'

/** The tables the log covers, as the database names them, with what the app keeps them as. */
export const LOGGED: Record<string, { list?: keyof State; pk?: string }> = {
  employees: { list: 'employees' },
  scopes: { list: 'scopes', pk: 'key' },
  clients: { list: 'clients' },
  client_logins: {},
  client_dscs: {},
  leads: { list: 'leads' },
  tasks: { list: 'tasks' },
  gst_filings: { list: 'gst' },
  tds_filings: { list: 'tds' },
  it_filings: { list: 'it' },
  audits: { list: 'audits' },
  services: { list: 'services' },
  attendance: {},
  off_days: {},
}

/** Kept as the fact of a change only: what they were changed to is personal, or too big to keep. */
const VALUES_HIDDEN = new Set(['photo', 'dob', 'address', 'bloodGroup', 'qualification', 'family', 'password'])
/** What says which record it is, or is the app's own bookkeeping. */
const SKIP = new Set(['id', 'clientId', 'hue', 'credentials', 'dscs', 'hasLogin', 'birthday', 'username', 'code'])
const WINDOW_MS = 2 * 60_000
const MAX_KEPT = 400

const camel = (k: string) => k.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())

/* ---------- Live: reading the database's log ---------- */

export interface ChangeQuery {
  clientId?: string
  /** Changes by this person; '' for those made outside the app. */
  by?: string
  tables?: string[]
}

export const PAGE = 100

function fromRow(r: Record<string, unknown>): ChangeEntry {
  const changes = r.changes as Record<string, [unknown, unknown] | null> | null
  return {
    id: String(r.id),
    at: r.at as string,
    by: (r.employee_id as string | null) ?? undefined,
    table: r.table_name as string,
    recordId: r.record_id as string,
    clientId: (r.client_id as string | null) ?? undefined,
    action: r.action as ChangeAction,
    label: (r.label as string | null) ?? undefined,
    changes: changes ? Object.fromEntries(Object.entries(changes).map(([k, v]) => [camel(k), v])) : undefined,
  }
}

/** A page of the log, newest first, older than the entry `before` if given. */
export async function fetchChanges(q: ChangeQuery, before?: string): Promise<ChangeEntry[]> {
  if (!supabase) return []
  let query = supabase.from('change_log').select('*').order('id', { ascending: false }).limit(PAGE)
  if (q.clientId) query = query.eq('client_id', q.clientId)
  if (q.by === '') query = query.is('employee_id', null)
  else if (q.by) query = query.eq('employee_id', q.by)
  if (q.tables?.length) query = query.in('table_name', q.tables)
  if (before) query = query.lt('id', Number(before))
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => fromRow(r as Record<string, unknown>))
}

/** Note a sign-in in the log. Failing to is no reason to keep anyone out. */
export async function noteSignIn() {
  await supabase?.rpc('note_sign_in').then(
    () => undefined,
    () => undefined,
  )
}

/* ---------- Sample data: noting changes made in this browser ---------- */

interface DemoLog {
  entries: ChangeEntry[]
}

export const useDemoLog = create<DemoLog>()(
  persist(() => ({ entries: [] as ChangeEntry[] }), { name: 'fsg-crm-demo-log', storage: createJSONStorage(() => localStorage), version: 1 }),
)

type Item = Record<string, unknown>
type Changes = NonNullable<ChangeEntry['changes']>

function value(v: unknown): unknown {
  if (v === undefined || v === '') return null
  if (typeof v === 'string' && v.length > 120) return `${v.slice(0, 117)}…`
  return v
}

/** Field by field, what is different between two versions of a record (or what a new one was given). */
function diff(before: Item | undefined, after: Item): Changes {
  const out: Changes = {}
  for (const k of new Set([...Object.keys(before ?? {}), ...Object.keys(after)])) {
    if (SKIP.has(k)) continue
    const a = before?.[k]
    const b = after[k]
    if (a === b || JSON.stringify(a) === JSON.stringify(b)) continue
    if (!before && (b === undefined || b === '' || typeof b === 'object')) continue
    if (VALUES_HIDDEN.has(k) || (a !== null && typeof a === 'object') || (b !== null && typeof b === 'object')) out[k] = null
    else out[k] = [value(a), value(b)]
  }
  return out
}

function labelOf(table: string, x: Item): string | undefined {
  switch (table) {
    case 'clients':
    case 'leads':
    case 'employees':
      return x.name as string
    case 'tasks':
      return x.title as string
    case 'gst_filings':
      return x.period as string
    case 'tds_filings':
      return x.fy as string
    case 'it_filings':
      return x.ay as string
    case 'audits':
      return `${x.kind as string} · FY ${x.fy as string}`
    case 'services':
      return `${x.kind as string} · ${x.party as string}`
    case 'scopes':
      return x.label as string
    case 'client_logins':
      return x.portal as string
    case 'client_dscs':
      return x.holder as string
  }
}

interface Noted {
  table: string
  recordId: string
  clientId?: string
  action: ChangeAction
  label?: string
  changes?: Changes
}

/** Like the database's note_change: a quick run of edits by one person to one record is kept as one entry. */
function note(entries: ChangeEntry[], by: string, n: Noted): ChangeEntry[] {
  const now = new Date().toISOString()
  const last = entries.find((e) => e.table === n.table && e.recordId === n.recordId)
  if (n.action === 'change' && last?.action === 'change' && last.by === by && Date.now() - Date.parse(last.at) < WINDOW_MS) {
    const merged: Changes = { ...last.changes }
    for (const [k, v] of Object.entries(n.changes ?? {})) merged[k] = v && merged[k] ? [merged[k]![0], v[1]] : v
    for (const [k, v] of Object.entries(merged)) if (v && JSON.stringify(v[0]) === JSON.stringify(v[1])) delete merged[k]
    const rest = entries.filter((e) => e !== last)
    return Object.keys(merged).length ? [{ ...last, at: now, label: n.label ?? last.label, changes: merged }, ...rest] : rest
  }
  return [{ id: uid('h'), at: now, by, ...n, changes: n.changes && Object.keys(n.changes).length ? n.changes : undefined }, ...entries]
}

function changesBetween(s: State, prev: State): Noted[] {
  const out: Noted[] = []
  for (const [table, def] of Object.entries(LOGGED)) {
    if (!def.list || s[def.list] === prev[def.list]) continue
    const pk = def.pk ?? 'id'
    const before = new Map((prev[def.list] as unknown as Item[]).map((x) => [x[pk] as string, x]))
    const after = s[def.list] as unknown as Item[]
    const seen = new Set<string>()
    for (const x of after) {
      const id = x[pk] as string
      seen.add(id)
      const was = before.get(id)
      if (was === x) continue
      const clientId = table === 'clients' ? id : (x.clientId as string | undefined)
      const changes = diff(was, x)
      if (!was || Object.keys(changes).length) out.push({ table, recordId: id, clientId, action: was ? 'change' : 'add', label: labelOf(table, x), changes })
      if (table !== 'clients') continue
      // A client's portal logins and DSCs are their own records in the log, as they are in the database.
      const pairs = [
        ['client_logins', 'portal', (was?.credentials ?? []) as Item[], (x.credentials ?? []) as Item[]],
        ['client_dscs', 'id', (was?.dscs ?? []) as Item[], (x.dscs ?? []) as Item[]],
      ] as const
      for (const [sub, key, olds, news] of pairs) {
        if (olds === news) continue
        const oldBy = new Map(olds.map((o) => [o[key] as string, o]))
        const kept = new Set<string>()
        for (const o of news) {
          const k = o[key] as string
          kept.add(k)
          const w = oldBy.get(k)
          const ch = diff(w, o)
          const recordId = sub === 'client_logins' ? `${id}:${k}` : k
          if (!w || Object.keys(ch).length) out.push({ table: sub, recordId, clientId: id, action: w ? 'change' : 'add', label: labelOf(sub, o), changes: ch })
        }
        for (const [k, o] of oldBy)
          if (!kept.has(k)) out.push({ table: sub, recordId: sub === 'client_logins' ? `${id}:${k}` : k, clientId: id, action: 'remove', label: labelOf(sub, o) })
      }
    }
    for (const [id, x] of before) if (!seen.has(id)) out.push({ table, recordId: id, clientId: table === 'clients' ? id : (x.clientId as string | undefined), action: 'remove', label: labelOf(table, x) })
  }
  if (s.attendance !== prev.attendance)
    for (const emp of new Set([...Object.keys(s.attendance), ...Object.keys(prev.attendance)])) {
      const a = prev.attendance[emp] ?? {}
      const b = s.attendance[emp] ?? {}
      if (a === b) continue
      for (const date of new Set([...Object.keys(a), ...Object.keys(b)])) {
        if (a[date] === b[date]) continue
        const recordId = `${emp}:${date}`
        if (!b[date]) out.push({ table: 'attendance', recordId, action: 'remove', label: date })
        else out.push({ table: 'attendance', recordId, action: a[date] ? 'change' : 'add', label: date, changes: diff(a[date] as unknown as Item, b[date] as unknown as Item) })
      }
    }
  if (s.offDays !== prev.offDays)
    for (const date of new Set([...Object.keys(s.offDays), ...Object.keys(prev.offDays)])) {
      if (s.offDays[date] === prev.offDays[date]) continue
      const action: ChangeAction = !(date in s.offDays) ? 'remove' : date in prev.offDays ? 'change' : 'add'
      out.push({ table: 'off_days', recordId: date, action, label: date, changes: action === 'remove' ? undefined : { name: [value(prev.offDays[date]), value(s.offDays[date])] } })
    }
  return out
}

/** Start noting changes made on sample data. Loading or resetting the sample data, or filling the trackers, changes too much at once to be anyone's edit, and is left out. */
export function startDemoLog(): () => void {
  if (LIVE) return () => undefined
  return useStore.subscribe((s, prev) => {
    if (s.currentUserId !== prev.currentUserId && s.employees !== prev.employees) return
    const found = changesBetween(s, prev)
    if (!found.length || found.length > 40) return
    useDemoLog.setState(({ entries }) => ({ entries: found.reduce((list, n) => note(list, s.currentUserId, n), entries).slice(0, MAX_KEPT) }))
  })
}

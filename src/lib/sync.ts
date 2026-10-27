/**
 * Keeps the app's state and the database in step.
 *
 * The screens keep working exactly as they did on sample data: they read the store and call its actions.
 * This module watches the store, works out which records changed (every action replaces only what it
 * touched, so a change of reference is a change), and saves just the changed fields. Saves are gathered
 * for a moment so typing in a cell is one request rather than one per key, sent in an order that respects
 * the foreign keys, and retried when the connection drops.
 *
 * Changes other people make arrive over Supabase Realtime and are put into the store without being sent
 * back. Each tab stamps what it writes with its own `origin`, so it can tell its own echoes apart, and
 * anything still waiting to be saved here wins over a remote copy of the same record.
 */
import type { PostgrestError, RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { create } from 'zustand'
import type { SeedData } from '../data/seed'
import { emptyData, useStore, type State } from '../store'
import type { AttendanceEntry, Credential, Portal } from '../types'
import { randomId } from './format'
import { supabase } from './supabase'

type Row = Record<string, unknown>
type Item = Record<string, unknown>

/* ---------- What is stored where ---------- */

type ListKey = 'employees' | 'scopes' | 'clients' | 'leads' | 'tasks' | 'gst' | 'tds' | 'it' | 'audits' | 'services' | 'consultations' | 'reminders'

interface ListDef {
  key: ListKey
  table: string
  /** What the record is called in an error message. */
  noun: string
  pk: 'id' | 'key'
  /** Lists the app adds to at the front. */
  newestFirst?: boolean
  /** Date fields: an empty string in the app is no date in the database. */
  dates?: string[]
  /** App field -> column, where the column is not simply the field in snake_case. */
  rename?: Record<string, string>
  /** Fields kept elsewhere, with what a record has before they are loaded. */
  apart?: Record<string, unknown>
  /** Fields only the database changes; never sent from here. */
  readOnly?: string[]
  /** The columns to read, where not every column may be read by everyone. */
  columns?: string
  /** Fields the table keeps from people not allowed to see them: read through `employee_details` instead, and kept as they are when a row comes in without them. */
  hidden?: string[]
}

const LISTS: ListDef[] = [
  // Logins are given out through the staff-logins function, never by editing a team member.
  // Personal and family details are for the person and for those allowed to see colleagues' details: the rest of
  // the team cannot read those columns, and gets the day and month of birth as `birthday` instead.
  {
    key: 'employees',
    table: 'employees',
    noun: 'team member',
    pk: 'id',
    dates: ['joined', 'dob'],
    readOnly: ['username', 'hasLogin', 'birthday'],
    columns: 'seq, id, name, title, role, reports_to, responsibilities, phone, email, hue, active, joined, photo, permissions, origin, updated_at, username, has_login, birthday',
    hidden: ['dob', 'address', 'bloodGroup', 'qualification', 'family'],
  },
  { key: 'scopes', table: 'scopes', noun: 'scope', pk: 'key', rename: { group: 'scope_group' } },
  { key: 'clients', table: 'clients', noun: 'client', pk: 'id', newestFirst: true, dates: ['since'], apart: { credentials: [] } },
  { key: 'leads', table: 'leads', noun: 'lead', pk: 'id', newestFirst: true, dates: ['nextFollowUp', 'createdAt'] },
  { key: 'tasks', table: 'tasks', noun: 'task', pk: 'id', newestFirst: true, dates: ['dueDate', 'createdAt'] },
  { key: 'gst', table: 'gst_filings', noun: 'GST filing', pk: 'id', dates: ['dataIn'] },
  { key: 'tds', table: 'tds_filings', noun: 'TDS filing', pk: 'id' },
  { key: 'it', table: 'it_filings', noun: 'income tax filing', pk: 'id', dates: ['dataIn', 'doneOn'] },
  { key: 'audits', table: 'audits', noun: 'audit', pk: 'id', dates: ['dataIn', 'dueDate', 'doneOn'] },
  { key: 'services', table: 'services', noun: 'one-time job', pk: 'id', newestFirst: true, dates: ['committedDate', 'dataIn', 'doneOn'] },
  { key: 'consultations', table: 'consultations', noun: 'consultation', pk: 'id', dates: ['date'] },
  { key: 'reminders', table: 'reminders', noun: 'reminder', pk: 'id', dates: ['date'] },
]

const LIST_BY_TABLE = new Map(LISTS.map((d) => [d.table, d]))

/** Writes go out in this order (deletes in the reverse), so a record is saved before anything that points at it. */
const TABLE_ORDER = [
  'employees',
  'scopes',
  'templates',
  'clients',
  'client_logins',
  'leads',
  'tasks',
  'gst_filings',
  'tds_filings',
  'it_filings',
  'audits',
  'services',
  'consultations',
  'reminders',
  'attendance',
  'off_days',
]

const NOUN: Record<string, string> = {
  ...Object.fromEntries(LISTS.map((d) => [d.table, d.noun])),
  templates: 'message template',
  client_logins: 'portal login',
  attendance: 'attendance entry',
  off_days: 'holiday',
}

/** Bookkeeping columns the app does not keep. */
const META = new Set(['seq', 'origin', 'updated_at', 'user_id'])

const snake = (k: string) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
const camel = (k: string) => k.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())

function toRow(def: ListDef, item: Item): Row {
  const row: Row = {}
  for (const [k, v] of Object.entries(item)) {
    if ((def.apart && k in def.apart) || def.readOnly?.includes(k)) continue
    row[def.rename?.[k] ?? snake(k)] = v === undefined || (v === '' && def.dates?.includes(k)) ? null : v
  }
  return row
}

function fromRow(def: ListDef, row: Row, existing?: Item): Item {
  const back = def.rename ? Object.fromEntries(Object.entries(def.rename).map(([f, c]) => [c, f])) : {}
  const item: Item = {}
  for (const [col, v] of Object.entries(row)) if (!META.has(col) && v !== null && v !== undefined) item[back[col] ?? camel(col)] = v
  for (const [f, empty] of Object.entries(def.apart ?? {})) item[f] = existing?.[f] ?? empty
  for (const f of def.hidden ?? []) if (!(f in item) && existing?.[f] !== undefined) item[f] = existing[f]
  return item
}

const attendanceRow = (employeeId: string, date: string, e: AttendanceEntry): Row => ({
  employee_id: employeeId,
  date,
  mark: e.mark,
  time_in: e.in ?? null,
  time_out: e.out ?? null,
  ot_minutes: e.ot ?? null,
})

function attendanceEntry(row: Row): AttendanceEntry {
  const e: AttendanceEntry = { mark: row.mark as AttendanceEntry['mark'] }
  if (row.time_in) e.in = row.time_in as string
  if (row.time_out) e.out = row.time_out as string
  if (row.ot_minutes) e.ot = row.ot_minutes as number
  return e
}

/* ---------- Status the screens can show ---------- */

export interface SyncStatus {
  /** Changes made here that have not reached the database yet. */
  saving: boolean
  /** The last save failed for want of a connection; it will be tried again. */
  offline: boolean
  /** A change the database turned down. It has been put back the way the database has it. */
  error: string | null
}

export const useSyncStatus = create<SyncStatus>(() => ({ saving: false, offline: false, error: null }))

export const dismissSyncError = () => useSyncStatus.setState({ error: null })

/* ---------- The queue of changes to save ---------- */

type Op =
  | { kind: 'insert' | 'update' | 'upsert'; table: string; key: string; match: Row; row: Row }
  | { kind: 'delete'; table: string; key: string; match: Row }
  | { kind: 'logins'; table: 'client_logins'; key: string; clientId: string; logins: Credential[] }

/** This tab, on everything it writes. */
const ORIGIN = randomId(16)
const PAGE = 1000
const DEBOUNCE_MS = 300
const PARALLEL = 6

const pending = new Map<string, Op>()
/** Fields being written right now, by record, so a remote copy that crosses them in flight does not undo them. */
const inflight = new Map<string, Row>()
let applyingRemote = false
let flushTimer: number | undefined
let retryTimer: number | undefined
let retryDelay = 2000
let running = false
let paused = false
let idleWaiters: Array<() => void> = []

/** Two changes to the same record waiting together become one. */
function merge(older: Op, newer: Op): Op | null {
  if (newer.kind === 'logins' || older.kind === 'logins') return newer
  if (newer.kind === 'delete') return older.kind === 'insert' ? null : newer
  if (older.kind === 'delete') return newer.kind === 'update' ? older : { ...newer, kind: 'upsert' }
  if (newer.kind === 'update') return { ...older, row: { ...older.row, ...newer.row } }
  return { ...newer, kind: older.kind === 'insert' && newer.kind === 'insert' ? 'insert' : 'upsert', row: { ...older.row, ...newer.row } }
}

function enqueue(op: Op, asOlder = false) {
  const was = pending.get(op.key)
  const next = !was ? op : asOlder ? merge(op, was) : merge(was, op)
  if (next) pending.set(op.key, next)
  else pending.delete(op.key)
}

function report() {
  const busy = pending.size > 0 || inflight.size > 0 || running
  if (useSyncStatus.getState().saving !== busy) useSyncStatus.setState({ saving: busy })
  if (!busy) {
    const waiters = idleWaiters
    idleWaiters = []
    waiters.forEach((w) => w())
  }
}

function schedule() {
  report()
  if (flushTimer === undefined && !paused) flushTimer = window.setTimeout(() => void flush(), DEBOUNCE_MS)
}

const isIdle = () => pending.size === 0 && inflight.size === 0 && !running

/** Resolves once everything made here has been saved (or given up on). */
export function whenSaved(): Promise<void> {
  if (isIdle()) return Promise.resolve()
  if (flushTimer !== undefined || paused) void flush(true)
  return new Promise((resolve) => idleWaiters.push(resolve))
}

async function flush(force = false) {
  window.clearTimeout(flushTimer)
  flushTimer = undefined
  if (force) paused = false
  if (running || paused || !supabase) return
  running = true
  report()
  try {
    while (pending.size && !paused) {
      const batch = [...pending.values()]
      pending.clear()
      const rank = (op: Op) => TABLE_ORDER.indexOf(op.table)
      const writes = batch.filter((op) => op.kind !== 'delete').sort((a, b) => rank(a) - rank(b))
      const deletes = batch.filter((op) => op.kind === 'delete').sort((a, b) => rank(b) - rank(a))
      const groups = [writes, deletes].flatMap((ops) => [...new Set(ops.map((op) => op.table))].map((t) => ops.filter((op) => op.table === t)))
      for (const ops of groups) {
        // Once the connection has gone, what is left waits too: a task sent before its new client would be refused.
        if (paused) ops.forEach((op) => enqueue(op, true))
        else await inParallel(ops, send)
      }
    }
  } finally {
    running = false
    report()
  }
}

async function inParallel<T>(items: T[], fn: (item: T) => Promise<void>) {
  let next = 0
  const lane = async () => {
    while (next < items.length) await fn(items[next++])
  }
  await Promise.all(Array.from({ length: Math.min(PARALLEL, items.length) }, lane))
}

/* ---------- Sending one change ---------- */

const pkColumns = (match: Row) => Object.keys(match).join(',')

async function request(op: Op): Promise<{ error: PostgrestError | null; status: number; data: unknown }> {
  const db = supabase!
  switch (op.kind) {
    case 'insert':
      // The database may give a new client the next free code; ask for it back.
      return db.from(op.table).insert({ ...op.row, origin: ORIGIN }).select(op.table === 'clients' ? 'id, code' : pkColumns(op.match))
    case 'upsert':
      return db.from(op.table).upsert({ ...op.row, origin: ORIGIN }, { onConflict: pkColumns(op.match) }).select(pkColumns(op.match))
    case 'update':
      return db.from(op.table).update({ ...op.row, origin: ORIGIN }).match(op.match).select(pkColumns(op.match))
    case 'delete':
      return db.from(op.table).delete().match(op.match)
    case 'logins':
      return db.rpc('save_client_logins', {
        p_client_id: op.clientId,
        p_logins: op.logins.map((c) => ({ portal: c.portal, username: c.username, password: c.password })),
        p_origin: ORIGIN,
      })
  }
}

async function send(op: Op) {
  if (op.kind !== 'delete' && op.kind !== 'logins') inflight.set(op.key, op.row)
  try {
    const res = await request(op)
    if (res.error) return failed(op, res.error, res.status)
    retryDelay = 2000
    if (useSyncStatus.getState().offline) useSyncStatus.setState({ offline: false })
    const rows = Array.isArray(res.data) ? (res.data as Row[]) : []
    // An update the access rules do not allow changes nothing and says so only by returning no rows.
    if (op.kind === 'update' && rows.length === 0) return refused(op, "you don't have permission to change it, or it no longer exists")
    if (op.kind === 'insert' && op.table === 'clients' && rows[0]?.code) {
      const code = rows[0].code as string
      const id = op.match.id as string
      if (useStore.getState().clients.find((c) => c.id === id)?.code !== code)
        remote(() => useStore.setState((s) => ({ clients: s.clients.map((c) => (c.id === id ? { ...c, code } : c)) })))
    }
  } catch (e) {
    failed(op, { message: e instanceof Error ? e.message : String(e), details: '', hint: '', code: '' } as PostgrestError, 0)
  } finally {
    inflight.delete(op.key)
  }
}

function failed(op: Op, error: PostgrestError, status: number) {
  const transient = status === 0 || status === 401 || status === 408 || status === 429 || status >= 500 || /fetch|network/i.test(error.message)
  if (!transient) return refused(op, reason(error))
  // Keep it, under anything changed since, and try again once the connection is back.
  enqueue(op, true)
  paused = true
  useSyncStatus.setState({ offline: true })
  window.clearTimeout(retryTimer)
  retryTimer = window.setTimeout(() => void flush(true), retryDelay)
  retryDelay = Math.min(retryDelay * 2, 30_000)
}

function reason(e: PostgrestError): string {
  if (/row-level security|permission denied/i.test(e.message)) return "you don't have permission to do that"
  // The database's own explanation, from the checks on the team and on portal logins.
  if (e.code === '42501') return e.message.replace(/\.$/, '')
  if (e.code === '23505') return 'one like it already exists'
  if (e.code === '23503') return 'it refers to something that is no longer there'
  if (e.code === '23502') return 'a required detail is missing'
  if (e.code === '23514' || e.code === '22P02' || e.code === '22007' || e.code === '22008') return 'one of the values is not valid'
  return e.message
}

/** The database said no: tell the person, and show the record the way the database has it. */
function refused(op: Op, why: string) {
  const what = op.kind === 'delete' ? 'remove' : op.kind === 'insert' ? 'add' : 'save'
  useSyncStatus.setState({ error: `Couldn't ${what} the ${NOUN[op.table] ?? 'change'}: ${why}.` })
  void restore(op)
}

async function restore(op: Op) {
  const db = supabase!
  if (op.kind === 'logins') return refreshLogins(op.clientId)
  const def = LIST_BY_TABLE.get(op.table)
  const { data } = await db.from(op.table).select(def?.columns ?? '*').match(op.match).maybeSingle()
  remote(() => {
    if (def) {
      if (data) putItem(def, data as unknown as Row)
      else dropItem(def, op.match[def.pk] as string)
    } else putMapRow(op.table, op.match, data as Row | null)
  })
  if (op.table === 'employees') void refreshDetails(op.match.id as string)
}

/* ---------- Spotting what changed in the store ---------- */

function changedFields(a: Item, b: Item): Item | null {
  let patch: Item | null = null
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) if (a[k] !== b[k]) (patch ??= {})[k] = b[k]
  return patch
}

function diffList(def: ListDef, before: Item[], after: Item[]) {
  const old = new Map(before.map((x) => [x[def.pk] as string, x]))
  const seen = new Set<string>()
  for (const item of after) {
    const id = item[def.pk] as string
    seen.add(id)
    const was = old.get(id)
    if (was === item) continue
    const key = `${def.table}:${id}`
    const match = { [def.pk]: id }
    if (!was) enqueue({ kind: 'insert', table: def.table, key, match, row: toRow(def, item) })
    else {
      const patch = changedFields(was, item)
      const row = patch && toRow(def, patch)
      if (row && Object.keys(row).length) enqueue({ kind: 'update', table: def.table, key, match, row })
    }
    if (def.key === 'clients' && item.credentials !== (was?.credentials ?? []) && (was || (item.credentials as Credential[]).length))
      enqueue({ kind: 'logins', table: 'client_logins', key: `client_logins:${id}`, clientId: id, logins: item.credentials as Credential[] })
  }
  for (const id of old.keys()) if (!seen.has(id)) enqueue({ kind: 'delete', table: def.table, key: `${def.table}:${id}`, match: { [def.pk]: id } })
}

function diffAttendance(before: State['attendance'], after: State['attendance']) {
  for (const emp of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const a = before[emp] ?? {}
    const b = after[emp] ?? {}
    if (a === b) continue
    for (const date of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (a[date] === b[date]) continue
      const key = `attendance:${emp}:${date}`
      const match = { employee_id: emp, date }
      if (b[date]) enqueue({ kind: 'upsert', table: 'attendance', key, match, row: attendanceRow(emp, date, b[date]) })
      else enqueue({ kind: 'delete', table: 'attendance', key, match })
    }
  }
}

/** off_days (date -> name) and templates (key -> text). */
function diffMap(table: 'off_days' | 'templates', before: Record<string, string>, after: Record<string, string>) {
  const [pk, col] = table === 'off_days' ? ['date', 'name'] : ['key', 'text']
  for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (before[k] === after[k]) continue
    const key = `${table}:${k}`
    if (k in after) enqueue({ kind: 'upsert', table, key, match: { [pk]: k }, row: { [pk]: k, [col]: after[k] } })
    else enqueue({ kind: 'delete', table, key, match: { [pk]: k } })
  }
}

function onStoreChange(s: State, prev: State) {
  if (applyingRemote) return
  for (const def of LISTS) if (s[def.key] !== prev[def.key]) diffList(def, prev[def.key] as unknown as Item[], s[def.key] as unknown as Item[])
  if (s.attendance !== prev.attendance) diffAttendance(prev.attendance, s.attendance)
  if (s.offDays !== prev.offDays) diffMap('off_days', prev.offDays, s.offDays)
  if (s.templates !== prev.templates) diffMap('templates', prev.templates as Record<string, string>, s.templates as Record<string, string>)
  if (pending.size) schedule()
}

/* ---------- Putting the database's copy into the store ---------- */

function remote(fn: () => void) {
  applyingRemote = true
  try {
    fn()
  } finally {
    applyingRemote = false
  }
}

/** A remote copy, with anything not yet saved from here laid over it. */
function withLocal(key: string, row: Row): Row {
  const waiting = pending.get(key)
  return { ...row, ...inflight.get(key), ...(waiting && 'row' in waiting ? waiting.row : {}) }
}

function putItem(def: ListDef, row: Row) {
  const id = row[def.pk] as string
  if (pending.get(`${def.table}:${id}`)?.kind === 'delete') return
  useStore.setState((s) => {
    const list = s[def.key] as unknown as Item[]
    const i = list.findIndex((x) => x[def.pk] === id)
    const item = fromRow(def, withLocal(`${def.table}:${id}`, row), list[i])
    if (i < 0) return { [def.key]: def.newestFirst ? [item, ...list] : [...list, item] } as Partial<State>
    const next = list.slice()
    next[i] = item
    return { [def.key]: next } as Partial<State>
  })
}

function dropItem(def: ListDef, id: string) {
  useStore.setState((s) => {
    const list = s[def.key] as unknown as Item[]
    return list.some((x) => x[def.pk] === id) ? ({ [def.key]: list.filter((x) => x[def.pk] !== id) } as Partial<State>) : {}
  })
}

/** Attendance, holidays and templates: `row` null removes the entry. */
function putMapRow(table: string, match: Row, row: Row | null) {
  if (table === 'attendance') {
    const emp = match.employee_id as string
    const date = match.date as string
    if (pending.has(`attendance:${emp}:${date}`) || inflight.has(`attendance:${emp}:${date}`)) return
    useStore.setState((s) => {
      const days = { ...s.attendance[emp] }
      if (row) days[date] = attendanceEntry(row)
      else delete days[date]
      return { attendance: { ...s.attendance, [emp]: days } }
    })
  } else if (table === 'off_days' || table === 'templates') {
    const [pk, col, field] = table === 'off_days' ? (['date', 'name', 'offDays'] as const) : (['key', 'text', 'templates'] as const)
    const k = match[pk] as string
    if (pending.has(`${table}:${k}`) || inflight.has(`${table}:${k}`)) return
    useStore.setState((s) => {
      const next: Record<string, string> = { ...(s[field] as Record<string, string>) }
      if (row) next[k] = row[col] as string
      else delete next[k]
      return { [field]: next } as Partial<State>
    })
  }
}

/** Show one record as the database has it now, after something changed it there (the staff-logins function, say). */
export async function reloadRecord(key: ListKey, id: string) {
  const def = LISTS.find((d) => d.key === key)!
  const { data } = await supabase!.from(def.table).select(def.columns ?? '*').eq(def.pk, id).maybeSingle()
  remote(() => (data ? putItem(def, data as unknown as Row) : dropItem(def, id)))
}

const EMPLOYEES = LISTS.find((d) => d.key === 'employees')!

/** Personal and family details as the app keeps them, from a row of employee_details. */
function detailsFrom(row: Row): Item {
  const item: Item = {}
  for (const f of EMPLOYEES.hidden!) if (row[snake(f)] != null) item[f] = row[snake(f)]
  return item
}

function withDetails<T extends object>(e: T, details: Item | undefined): T {
  const next = { ...e } as Item
  for (const f of EMPLOYEES.hidden!) delete next[f]
  return { ...next, ...details } as T
}

const detailTimers = new Map<string, number>()

/**
 * Fetch personal and family details again: one person's after their record changed, or everyone's (`id`
 * left out) after the signed-in person's own record changed, since what they may see may have changed with it.
 */
async function refreshDetails(id?: string) {
  const { data, error } = await supabase!.rpc('employee_details', id ? { p_id: id } : {})
  if (error) return
  const byId = new Map(((data ?? []) as Row[]).map((r) => [r.id as string, detailsFrom(r)]))
  remote(() =>
    useStore.setState((s) => ({
      employees: s.employees.map((e) => {
        if (pending.has(`employees:${e.id}`) || inflight.has(`employees:${e.id}`)) return e
        // Asked about one person and told nothing: this person may not see them, and has nothing to clear.
        if (id && (e.id !== id || !byId.has(id))) return e
        return withDetails(e, byId.get(e.id))
      }),
    })),
  )
}

function scheduleDetails(id?: string) {
  const k = id ?? '*'
  window.clearTimeout(detailTimers.get(k))
  detailTimers.set(k, window.setTimeout(() => void refreshDetails(id), 150))
}

const loginTimers = new Map<string, number>()

/** Fetch one client's logins again (and their passwords, if this person may see them). */
async function refreshLogins(clientId: string) {
  const db = supabase!
  const [{ data: rows }, { data: secrets }] = await Promise.all([
    db.from('client_logins').select('portal, username').eq('client_id', clientId).order('position'),
    db.rpc('client_login_passwords', { p_client_id: clientId }),
  ])
  if (pending.has(`client_logins:${clientId}`)) return
  const pw = new Map(((secrets ?? []) as Row[]).map((r) => [r.portal as string, r.password as string]))
  const credentials: Credential[] = ((rows ?? []) as Row[]).map((r) => ({ portal: r.portal as Portal, username: r.username as string, password: pw.get(r.portal as string) ?? '' }))
  remote(() => useStore.setState((s) => ({ clients: s.clients.map((c) => (c.id === clientId ? { ...c, credentials } : c)) })))
}

function onRemoteChange(p: RealtimePostgresChangesPayload<Row>) {
  const row = p.eventType === 'DELETE' ? null : p.new
  if (row && row.origin === ORIGIN) return
  const keys = (p.eventType === 'DELETE' ? p.old : p.new) as Row
  if (p.table === 'client_logins') {
    // Several logins change together; fetch the client's set once.
    const clientId = keys.client_id as string
    window.clearTimeout(loginTimers.get(clientId))
    loginTimers.set(clientId, window.setTimeout(() => void refreshLogins(clientId), 150))
    return
  }
  const def = LIST_BY_TABLE.get(p.table)
  if (p.table === 'employees' && row) scheduleDetails(keys.id === useStore.getState().currentUserId ? undefined : (keys.id as string))
  remote(() => {
    if (def) {
      if (row) putItem(def, row)
      else dropItem(def, keys[def.pk] as string)
    } else {
      const match = p.table === 'attendance' ? { employee_id: keys.employee_id, date: keys.date } : p.table === 'off_days' ? { date: keys.date } : { key: keys.key }
      putMapRow(p.table, match, row)
    }
  })
}

/* ---------- Loading everything ---------- */

async function fetchAll(table: string, order: Array<[string, boolean]>, columns = '*'): Promise<Row[]> {
  const db = supabase!
  const out: Row[] = []
  // The API hands back at most a thousand rows at a time.
  for (let from = 0; ; from += PAGE) {
    let q = db.from(table).select(columns)
    for (const [col, ascending] of order) q = q.order(col, { ascending })
    const { data, error } = await q.range(from, from + PAGE - 1)
    if (error) throw new Error(`Could not load ${table}: ${error.message}`)
    out.push(...(data as unknown as Row[]))
    if (data.length < PAGE) return out
  }
}

async function loadAll(): Promise<SeedData> {
  const db = supabase!
  const [lists, attendance, offDays, templates, logins, secrets, details] = await Promise.all([
    Promise.all(LISTS.map((def) => fetchAll(def.table, [['seq', !def.newestFirst]], def.columns))),
    fetchAll('attendance', [['employee_id', true], ['date', true]]),
    fetchAll('off_days', [['date', true]]),
    fetchAll('templates', [['key', true]]),
    fetchAll('client_logins', [['client_id', true], ['position', true], ['portal', true]]),
    db.rpc('client_login_passwords').then(({ data, error }) => {
      if (error) throw new Error(`Could not load portal passwords: ${error.message}`)
      return (data ?? []) as Row[]
    }),
    db.rpc('employee_details').then(({ data, error }) => {
      if (error) throw new Error(`Could not load team details: ${error.message}`)
      return (data ?? []) as Row[]
    }),
  ])

  const data = emptyData()
  LISTS.forEach((def, i) => {
    ;(data as unknown as Record<ListKey, Item[]>)[def.key] = lists[i].map((row) => fromRow(def, row))
  })

  const pw = new Map(secrets.map((r) => [`${r.client_id}:${r.portal}`, r.password as string]))
  const byClient = new Map<string, Credential[]>()
  for (const r of logins) {
    const id = r.client_id as string
    if (!byClient.has(id)) byClient.set(id, [])
    byClient.get(id)!.push({ portal: r.portal as Portal, username: r.username as string, password: pw.get(`${id}:${r.portal}`) ?? '' })
  }
  data.clients = data.clients.map((c) => ({ ...c, credentials: byClient.get(c.id) ?? [] }))
  const personal = new Map(details.map((r) => [r.id as string, detailsFrom(r)]))
  data.employees = data.employees.map((e) => ({ ...e, ...personal.get(e.id) }))

  for (const r of attendance) ((data.attendance[r.employee_id as string] ??= {})[r.date as string] = attendanceEntry(r))
  for (const r of offDays) data.offDays[r.date as string] = r.name as string
  for (const r of templates) (data.templates as Record<string, string>)[r.key as string] = r.text as string
  return data
}

/* ---------- Starting and stopping ---------- */

let unsubscribe: (() => void) | undefined
let channel: RealtimeChannel | undefined
let dropped = false

function onBeforeUnload(e: BeforeUnloadEvent) {
  if (isIdle()) return
  void flush(true)
  e.preventDefault()
}

const onOnline = () => void flush(true)

/** After the live connection was lost, changes may have been missed: load everything again once nothing is waiting here. */
async function resync() {
  for (;;) {
    await whenSaved()
    const data = await loadAll()
    if (isIdle()) {
      remote(() => useStore.setState(data))
      return
    }
  }
}

/** Load the firm's data for the person who signed in, then keep it saved and up to date. */
export async function startSync(employeeId: string) {
  const db = supabase
  if (!db) return
  stopListening()
  const data = await loadAll()
  remote(() => useStore.setState({ ...data, currentUserId: employeeId }))
  unsubscribe = useStore.subscribe(onStoreChange)
  window.addEventListener('beforeunload', onBeforeUnload)
  window.addEventListener('online', onOnline)
  dropped = false
  channel = db
    .channel('fsg-db')
    .on('postgres_changes', { event: '*', schema: 'public' }, onRemoteChange)
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        if (dropped) {
          dropped = false
          void resync().catch(() => undefined)
        }
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') dropped = true
    })
}

function stopListening() {
  unsubscribe?.()
  unsubscribe = undefined
  if (channel) void supabase?.removeChannel(channel)
  channel = undefined
  window.removeEventListener('beforeunload', onBeforeUnload)
  window.removeEventListener('online', onOnline)
}

/** Save what is waiting, stop listening and forget the data, before signing out. */
export async function stopSync() {
  await Promise.race([whenSaved(), new Promise((r) => setTimeout(r, 5000))])
  stopListening()
  pending.clear()
  window.clearTimeout(retryTimer)
  paused = false
  remote(() => useStore.setState({ ...emptyData(), currentUserId: '' }))
  useSyncStatus.setState({ saving: false, offline: false, error: null })
}

import { History, LogIn, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PAGE, fetchChanges, useDemoLog, type ChangeQuery } from '../lib/changeLog'
import { cn, fmtDate, fmtDuration, fmtTime, inr, periodLabel, todayISO, addDays } from '../lib/format'
import { ATTENDANCE, DEPARTMENTS, GST_DATA_TYPES, GST_STATUS, LEAD_STATUS, PORTALS, PRIORITIES, ROLES, SIMPLE_STATUS, TASK_STATUS } from '../lib/meta'
import { LIVE } from '../lib/supabase'
import { useCan, useLookup, useStore } from '../store'
import type { ChangeEntry, Employee, Portal } from '../types'
import { Avatar, Button, Card, CardHeader, Empty, Select } from './ui'

/** The kinds of record a person can narrow the log to, with the tables each covers. */
const KINDS: Array<{ value: string; label: string; tables: string[] }> = [
  { value: 'clients', label: 'Client details', tables: ['clients'] },
  { value: 'logins', label: 'Portal logins', tables: ['client_logins'] },
  { value: 'dscs', label: 'DSCs', tables: ['client_dscs'] },
  { value: 'filings', label: 'Filing trackers', tables: ['gst_filings', 'tds_filings', 'it_filings', 'audits', 'services'] },
  { value: 'tasks', label: 'Tasks', tables: ['tasks'] },
  { value: 'leads', label: 'Leads', tables: ['leads'] },
  { value: 'team', label: 'Team', tables: ['employees'] },
  { value: 'attendance', label: 'Attendance & holidays', tables: ['attendance', 'off_days'] },
  { value: 'scopes', label: 'Scopes of work', tables: ['scopes'] },
  { value: 'sign_in', label: 'Sign-ins', tables: ['sign_in'] },
]

/** What the fields are called on screen. Live entries have the database's names in camelCase, sample ones the app's. */
const FIELD: Record<string, string> = {
  name: 'Name',
  category: 'Category',
  profession: 'Profession',
  business: 'Nature of business',
  place: 'Place',
  phone: 'Phone',
  whatsapp: 'WhatsApp',
  email: 'Email',
  gstin: 'GSTIN',
  pan: 'PAN',
  tan: 'TAN',
  gstFrequency: 'GST frequency',
  contactPerson: 'Contact person',
  contactPhone: 'Contact number',
  active: 'Active',
  scopes: 'Scope of work',
  scopeDetails: 'Scope details',
  documents: 'Documents',
  requirementsSent: 'Requirements sent',
  clarifications: 'Clarifications',
  transactions: 'Fee ledger',
  since: 'Client since',
  username: 'Username',
  password: 'Password',
  holder: 'Whose DSC',
  expiry: 'Expiry',
  note: 'Note',
  period: 'Period',
  dataType: 'Data type',
  dataIn: 'Data in',
  dataReminded: 'Data reminders',
  gstr1: 'GSTR-1',
  gstr3b: 'GSTR-3B',
  assigneeId: 'Assigned to',
  prevBalance: 'Old balance',
  fee: 'Fee',
  received: 'Received',
  remark: 'Remark',
  fy: 'FY',
  ay: 'AY',
  payments: 'TDS payments',
  quarters: 'TDS returns',
  kind: 'Kind',
  status: 'Status',
  reconciliation: 'Reconciliation',
  dueDate: 'Due date',
  doneOn: 'Done on',
  party: 'Party',
  details: 'Details',
  committedDate: 'Committed date',
  title: 'Title',
  description: 'Notes',
  department: 'Work head',
  assignedById: 'Assigned by',
  priority: 'Priority',
  progress: 'Progress',
  recurring: 'Repeats',
  createdAt: 'Created',
  remarks: 'Remarks',
  contact: 'Contact',
  source: 'Source',
  ownerId: 'Handled by',
  nextFollowUp: 'Next follow-up',
  role: 'Role',
  reportsTo: 'Reports to',
  responsibilities: 'Usually works on',
  joined: 'Joined',
  dob: 'Date of birth',
  address: 'Address',
  bloodGroup: 'Blood group',
  qualification: 'Qualification',
  family: 'Family details',
  photo: 'Photo',
  permissions: 'Permissions',
  workFrom: 'Starts work',
  workTo: 'Finishes work',
  mark: 'Attendance',
  in: 'Time in',
  out: 'Time out',
  timeIn: 'Time in',
  timeOut: 'Time out',
  ot: 'Overtime',
  otMinutes: 'Overtime',
  onTime: 'On time',
  label: 'Name',
  short: 'Short name',
  group: 'Group',
  scopeGroup: 'Group',
  tracker: 'Tracker',
  detailHint: 'Asks for',
  deadlines: 'Changed due dates',
}

const PEOPLE_FIELDS = new Set(['assigneeId', 'assignedById', 'ownerId', 'reportsTo', 'forId'])
const MONEY = new Set(['fee', 'received', 'prevBalance'])

/** What the record was, in a few words: "GST October 2026", "task GSTR-1 for October". */
function recordName(e: ChangeEntry, emp: (id?: string) => Employee | undefined): string {
  const l = e.label ?? ''
  switch (e.table) {
    case 'clients':
      return `client ${l}`
    case 'client_logins':
      return `${PORTALS[l as Portal]?.label ?? l} login`
    case 'client_dscs':
      return `DSC of ${l}`
    case 'gst_filings':
      return /^\d{4}-\d{2}$/.test(l) ? `GST for ${periodLabel(l)}` : 'GST filing'
    case 'tds_filings':
      return `TDS for FY ${l}`
    case 'it_filings':
      return `income tax for AY ${l}`
    case 'audits':
      return l || 'audit'
    case 'services':
      return l || 'one-time job'
    case 'tasks':
      return `task "${l}"`
    case 'leads':
      return `lead ${l}`
    case 'employees':
      return `${l}'s profile`
    case 'attendance': {
      const who = emp(e.recordId.split(':')[0])?.name ?? 'someone'
      return `${who}'s attendance on ${/^\d{4}-\d{2}-\d{2}$/.test(l) ? fmtDate(l, true) : l}`
    }
    case 'off_days':
      return `holiday on ${/^\d{4}-\d{2}-\d{2}$/.test(l) ? fmtDate(l, true) : l}`
    case 'scopes':
      return `scope ${l}`
    default:
      return l
  }
}

/** Where to see the record now. */
function linkFor(e: ChangeEntry): string | undefined {
  switch (e.table) {
    case 'clients':
      return `/clients/${e.recordId}`
    case 'client_logins':
      return e.clientId && `/clients/${e.clientId}?tab=logins`
    case 'client_dscs':
      return e.clientId && `/clients/${e.clientId}?tab=dsc`
    case 'gst_filings':
      return e.clientId && `/filings/gst?client=${e.clientId}`
    case 'tds_filings':
      return e.clientId && `/filings/tds?client=${e.clientId}`
    case 'it_filings':
      return e.clientId && `/filings/it?client=${e.clientId}`
    case 'audits':
      return e.clientId && `/filings/audit?client=${e.clientId}`
    case 'services':
      return '/filings/services'
    case 'tasks':
      return `/tasks?open=${e.recordId}`
    case 'leads':
      return `/leads?open=${e.recordId}`
    case 'employees':
    case 'sign_in':
      return `/team/${e.recordId}`
    case 'attendance':
      return `/attendance/${e.recordId.split(':')[0]}`
    case 'off_days':
      return '/attendance'
    case 'scopes':
      return '/settings/scopes'
  }
}

const VERB = { add: 'added', change: 'changed', remove: 'removed', sign_in: 'signed in' } as const

function when(at: string): { day: string; time: string } {
  const d = new Date(at)
  const pad = (n: number) => String(n).padStart(2, '0')
  const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const today = todayISO()
  return {
    day: iso === today ? 'Today' : iso === addDays(today, -1) ? 'Yesterday' : fmtDate(iso, true),
    time: fmtTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`),
  }
}

/** The changes on sample data, filtered like the database query would be. */
function useDemoEntries(q: ChangeQuery): ChangeEntry[] {
  const entries = useDemoLog((s) => s.entries)
  return useMemo(
    () =>
      entries.filter(
        (e) =>
          (!q.clientId || e.clientId === q.clientId) &&
          (q.by === undefined || (q.by === '' ? !e.by : e.by === q.by)) &&
          (!q.tables?.length || q.tables.includes(e.table)),
      ),
    [entries, q.clientId, q.by, q.tables],
  )
}

/** The log as the database has it, a page at a time. */
function useLiveEntries(q: ChangeQuery, enabled: boolean) {
  const key = JSON.stringify(q)
  // Bumped by Refresh, to fetch the first page again.
  const [round, setRound] = useState(0)
  const [data, setData] = useState({ of: '', entries: [] as ChangeEntry[], more: false, error: '' })
  const [paging, setPaging] = useState(false)
  const want = `${key}#${round}`
  const failed = (e: unknown) => (e instanceof Error ? e.message : String(e))

  useEffect(() => {
    if (!enabled) return
    let current = true
    fetchChanges(JSON.parse(key) as ChangeQuery).then(
      (page) => current && setData({ of: `${key}#${round}`, entries: page, more: page.length === PAGE, error: '' }),
      (e: unknown) => current && setData({ of: `${key}#${round}`, entries: [], more: false, error: failed(e) }),
    )
    return () => {
      current = false
    }
  }, [enabled, key, round])

  const loadMore = async () => {
    setPaging(true)
    try {
      const page = await fetchChanges(q, data.entries.at(-1)?.id)
      setData((d) => ({ ...d, entries: [...d.entries, ...page], more: page.length === PAGE }))
    } catch (e) {
      setData((d) => ({ ...d, error: failed(e) }))
    } finally {
      setPaging(false)
    }
  }

  return {
    // While a refresh is on its way the old page stays; a different filter starts empty.
    entries: data.of.startsWith(`${key}#`) ? data.entries : [],
    busy: paging || data.of !== want,
    more: data.more,
    error: data.of.startsWith(`${key}#`) ? data.error : '',
    reload: () => setRound((r) => r + 1),
    loadMore: () => void loadMore(),
  }
}

/**
 * Who changed what: everything, or one client's records (their details, portal logins, DSCs, filings and tasks).
 * Passwords and personal details show only that they changed.
 */
export default function ChangeHistory({ clientId, filters }: { clientId?: string; filters?: boolean }) {
  const employees = useStore((s) => s.employees)
  const fees = useCan()('view_fees')
  const { emp, client } = useLookup()
  const [by, setBy] = useState<string | undefined>()
  const [kind, setKind] = useState('')
  const q = useMemo<ChangeQuery>(() => ({ clientId, by, tables: KINDS.find((k) => k.value === kind)?.tables }), [clientId, by, kind])
  const demo = useDemoEntries(q)
  const live = useLiveEntries(q, LIVE)
  const entries = LIVE ? live.entries : demo

  const show = (field: string, v: unknown, table: string): ReactNode => {
    if (v === null || v === undefined || v === '') return <span className="text-ink-400">blank</span>
    if (PEOPLE_FIELDS.has(field)) return emp(v as string)?.name ?? 'someone'
    if (MONEY.has(field)) return fees ? inr(Number(v)) : 'an amount'
    if (typeof v === 'boolean') return field === 'onTime' ? (v ? 'on time' : 'late') : v ? 'yes' : 'no'
    if (field === 'ot' || field === 'otMinutes') return fmtDuration(Number(v))
    if (field === 'progress') return `${v}%`
    const s = String(v)
    if (field === 'gstr1' || field === 'gstr3b') return GST_STATUS[s as keyof typeof GST_STATUS]?.label ?? s
    if (field === 'status')
      return (table === 'tasks' ? TASK_STATUS : table === 'leads' ? LEAD_STATUS : SIMPLE_STATUS)[s as never]?.['label'] ?? s
    if (field === 'mark') return ATTENDANCE[s as keyof typeof ATTENDANCE]?.label ?? s
    if (field === 'priority') return PRIORITIES[s as keyof typeof PRIORITIES]?.label ?? s
    if (field === 'department') return DEPARTMENTS[s as keyof typeof DEPARTMENTS]?.label ?? s
    if (field === 'role') return ROLES[s as keyof typeof ROLES]?.label ?? s
    if (field === 'dataType') return GST_DATA_TYPES.find((d) => d.value === s)?.label ?? s
    if (field === 'gstFrequency') return s === 'Q' ? 'quarterly' : 'monthly'
    if ((field === 'in' || field === 'out' || field === 'timeIn' || field === 'timeOut' || field === 'workFrom' || field === 'workTo') && /^\d{2}:\d{2}$/.test(s)) return fmtTime(s)
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return fmtDate(s, true)
    return `“${s}”`
  }

  const days = useMemo(() => {
    const out: Array<{ day: string; items: ChangeEntry[] }> = []
    for (const e of entries) {
      const { day } = when(e.at)
      if (out.at(-1)?.day !== day) out.push({ day, items: [] })
      out.at(-1)!.items.push(e)
    }
    return out
  }, [entries])

  return (
    <Card>
      <CardHeader
        title={clientId ? 'History' : 'Change history'}
        hint={
          clientId
            ? "Who changed this client's details, portal logins, DSCs, filings and tasks, and when"
            : 'Who changed what in the app, and when. Passwords and personal details show only that they changed.'
        }
        action={
          LIVE && (
            <Button size="sm" variant="ghost" icon={<RefreshCw size={14} className={cn(live.busy && 'animate-spin')} />} onClick={live.reload} disabled={live.busy}>
              Refresh
            </Button>
          )
        }
      />
      {filters && (
        <div className="flex flex-wrap gap-2 border-t border-ink-100 px-5 py-3">
          <Select small fit value={by ?? '*'} onChange={(e) => setBy(e.target.value === '*' ? undefined : e.target.value)} aria-label="Changed by">
            <option value="*">Anyone</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
            <option value="">Outside the app</option>
          </Select>
          <Select small fit value={kind} onChange={(e) => setKind(e.target.value)} aria-label="What changed">
            <option value="">Everything</option>
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </Select>
        </div>
      )}
      {LIVE && live.error ? (
        <p className="border-t border-ink-100 px-5 py-4 text-[13px] text-rose-700">Could not load the history: {live.error}</p>
      ) : entries.length === 0 ? (
        <Empty
          icon={<History size={20} />}
          title={LIVE && live.busy ? 'Loading…' : 'Nothing recorded yet'}
          hint={LIVE ? 'Changes show here as people make them.' : 'On sample data, changes made in this browser show here.'}
        />
      ) : (
        <div className="border-t border-ink-100">
          {days.map(({ day, items }) => (
            <section key={day}>
              <h3 className="sticky top-14 z-[1] bg-ink-50/95 px-5 py-1.5 text-[11px] font-bold tracking-wider text-ink-500 uppercase backdrop-blur">{day}</h3>
              <ol className="divide-y divide-ink-100">
                {items.map((e) => {
                  const who = emp(e.by)
                  const to = linkFor(e)
                  const c = !clientId && e.table !== 'clients' ? client(e.clientId) : undefined
                  const fields = Object.entries(e.changes ?? {}).filter(([f]) => f !== 'hue' && f !== 'position')
                  return (
                    <li key={e.id} className="flex gap-3 px-5 py-2.5">
                      {who ? (
                        <Avatar name={who.name} hue={who.hue} photo={who.photo} size={26} />
                      ) : (
                        <span className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-ink-100 text-ink-400">
                          <History size={13} />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] text-ink-700">
                          <span className="font-semibold text-ink-900">{who?.name ?? 'Outside the app'}</span>{' '}
                          {e.action === 'sign_in' ? (
                            <span className="inline-flex items-center gap-1">
                              <LogIn size={13} className="text-ink-400" /> signed in
                            </span>
                          ) : (
                            <>
                              {VERB[e.action]}{' '}
                              {to ? (
                                <Link to={to} className="font-semibold text-brand-700 hover:underline">
                                  {recordName(e, emp)}
                                </Link>
                              ) : (
                                <span className="font-semibold">{recordName(e, emp)}</span>
                              )}
                              {c && (
                                <>
                                  {' '}
                                  of{' '}
                                  <Link to={`/clients/${c.id}`} className="font-semibold text-ink-800 hover:underline">
                                    {c.name}
                                  </Link>
                                </>
                              )}
                            </>
                          )}
                          <span className="tnum ml-2 text-xs text-ink-400">{when(e.at).time}</span>
                        </p>
                        {fields.length > 0 && e.action === 'add' && (
                          // What a new record started with, on one line.
                          <p className="mt-0.5 text-xs text-ink-500">
                            {fields.map(([f, v], i) => (
                              <span key={f}>
                                {i > 0 && ' · '}
                                <span className="font-semibold text-ink-600">{FIELD[f] ?? f}</span>
                                {v && <>: {show(f, v[1], e.table)}</>}
                              </span>
                            ))}
                          </p>
                        )}
                        {fields.length > 0 && e.action !== 'add' && (
                          <ul className="mt-0.5 space-y-0.5 text-xs text-ink-500">
                            {fields.map(([f, v]) => (
                              <li key={f}>
                                <span className="font-semibold text-ink-600">{FIELD[f] ?? f}</span>
                                {v === null ? (
                                  f === 'password' ? ' changed' : ' updated'
                                ) : (
                                  <>
                                    : {show(f, v[0], e.table)} → {show(f, v[1], e.table)}
                                  </>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ol>
            </section>
          ))}
          {LIVE && live.more && (
            <div className="border-t border-ink-100 px-5 py-3 text-center">
              <Button size="sm" onClick={live.loadMore} disabled={live.busy}>
                {live.busy ? 'Loading…' : 'Show older'}
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

import { Check, Plus, Search, SearchX, X } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { Due } from '../components/bits'
import { Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Segmented, Select, StatusSelect, Td, Th } from '../components/ui'
import { itDueDate } from '../lib/deadlines'
import { addDays, cn, currentGstPeriod, financialYear, inr, periodLabel, todayISO } from '../lib/format'
import { GST_STATUS, SERVICE_KINDS, SIMPLE_STATUS, options, type Tone, type TrackerTab } from '../lib/meta'
import { useStore } from '../store'
import type { AuditFiling, Client, GstFiling, ItFiling, ServiceKind, SimpleStatus, TdsPayment } from '../types'

/* ---------- Small inline editors shared by every tracker ---------- */

function AssigneeSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const employees = useStore((s) => s.employees)
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Assigned to"
      className="chevron h-7 max-w-24 appearance-none truncate rounded-md bg-transparent pr-5 pl-1.5 text-[13px] font-medium text-ink-700 hover:bg-ink-100 focus:ring-2 focus:ring-brand-500 focus:outline-none"
    >
      {employees.map((e) => (
        <option key={e.id} value={e.id}>
          {e.name}
        </option>
      ))}
    </select>
  )
}

function InlineText({ value, onChange, placeholder = 'Add remark' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label="Remark"
      className="h-7 w-full min-w-28 rounded-md bg-transparent px-1.5 text-[13px] text-ink-700 placeholder:text-ink-300 hover:bg-ink-100 focus:bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
    />
  )
}

function Money({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  return (
    <input
      type="number"
      min={0}
      step={100}
      value={value}
      onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
      aria-label={label}
      className="tnum h-7 w-[68px] rounded-md bg-transparent px-1.5 text-right text-[13px] font-medium text-ink-800 hover:bg-ink-100 focus:bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
    />
  )
}

function Tick({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'flex size-5 items-center justify-center rounded-md transition-colors',
        checked ? 'bg-emerald-500 text-white' : 'bg-white ring-1 ring-ink-300 ring-inset hover:ring-ink-400',
      )}
    >
      {checked && <Check size={13} strokeWidth={3.5} />}
    </button>
  )
}

function ClientCell({ client, sub }: { client?: Client; sub?: ReactNode }) {
  if (!client) return <span className="text-ink-400">Unknown client</span>
  return (
    <div className="min-w-0">
      <Link to={`/clients/${client.id}`} title={client.name} className="block max-w-40 truncate font-semibold 2xl:max-w-64 text-ink-900 hover:text-brand-700 hover:underline">
        {client.name}
      </Link>
      {sub && <p className="tnum max-w-40 truncate text-xs text-ink-500 2xl:max-w-64">{sub}</p>}
    </div>
  )
}

function Summary({ items }: { items: Array<{ label: string; value: ReactNode; tone?: Tone }> }) {
  const color: Partial<Record<Tone, string>> = { red: 'text-rose-600', amber: 'text-amber-700', green: 'text-emerald-700' }
  return (
    <dl className="grid grid-cols-2 divide-ink-100 border-b border-ink-100 sm:grid-cols-4 sm:divide-x">
      {items.map((it) => (
        <div key={it.label} className="px-5 py-3">
          <dt className="text-xs font-semibold text-ink-500">{it.label}</dt>
          <dd className={cn('tnum mt-0.5 text-lg font-extrabold', (it.tone && color[it.tone]) || 'text-ink-900')}>{it.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function TableShell({ minWidth, head, children }: { minWidth: number; head: ReactNode; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm [&_td]:px-2 [&_th]:px-2" style={{ minWidth }}>
        <thead className="border-b border-ink-100 bg-ink-50/60">
          <tr>{head}</tr>
        </thead>
        <tbody className="divide-y divide-ink-100">{children}</tbody>
      </table>
    </div>
  )
}

function useClientMap() {
  const clients = useStore((s) => s.clients)
  return useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients])
}

/* ---------- Filters shared by every tracker ---------- */

/** Search and "assigned to" live here; `?client=` narrows the tracker to one client, e.g. from a client's scope of work. */
function useFilters() {
  const [params, setParams] = useSearchParams()
  const clients = useClientMap()
  const [q, setQ] = useState('')
  const [assignee, setAssignee] = useState('')
  const clientId = params.get('client') ?? ''
  const term = q.trim().toLowerCase()
  const clearClient = () => setParams({}, { replace: true })

  return {
    q,
    setQ,
    assignee,
    setAssignee,
    client: clients.get(clientId),
    clientId,
    clearClient,
    dirty: !!(term || assignee || clientId),
    reset: () => {
      setQ('')
      setAssignee('')
      if (clientId) clearClient()
    },
    /** `party` covers one-time jobs for people who are not clients yet. */
    match: (row: { clientId?: string; assigneeId: string }, party?: string) => {
      if (clientId && row.clientId !== clientId) return false
      if (assignee && row.assigneeId !== assignee) return false
      if (!term) return true
      const c = clients.get(row.clientId ?? '')
      return [party, c?.name, c?.code, c?.place, c?.gstin, c?.pan, c?.tan].some((v) => v?.toLowerCase().includes(term))
    },
  }
}

type Filters = ReturnType<typeof useFilters>

/** `lead` sits before the search box (a period or a set of tabs); children are the tracker's own filters. */
function FilterBar({ f, lead, children }: { f: Filters; lead?: ReactNode; children?: ReactNode }) {
  const employees = useStore((s) => s.employees)
  return (
    <div className="border-b border-ink-100">
      <div className="flex flex-wrap items-center gap-2 p-3">
        {lead}
        <div className="relative min-w-44 flex-1">
          <Search size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-400" />
          <Input small value={f.q} onChange={(e) => f.setQ(e.target.value)} placeholder="Search client, code, place…" aria-label="Search this tracker" className="pl-8" />
        </div>
        {children}
        <Select small fit value={f.assignee} onChange={(e) => f.setAssignee(e.target.value)} aria-label="Assigned to">
          <option value="">Assigned to anyone</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </Select>
      </div>
      {f.clientId && (
        <p className="flex flex-wrap items-center gap-2 px-3 pb-3 text-[13px] text-ink-600">
          Showing only
          <span className="inline-flex items-center gap-1 rounded-md bg-brand-50 py-0.5 pr-1 pl-2 font-semibold text-brand-800">
            {f.client ? (
              <Link to={`/clients/${f.client.id}`} className="hover:underline">
                {f.client.name}
              </Link>
            ) : (
              'a client that no longer exists'
            )}
            <button type="button" onClick={f.clearClient} aria-label="Show all clients" title="Show all clients" className="rounded p-0.5 hover:bg-brand-100">
              <X size={13} />
            </button>
          </span>
        </p>
      )}
    </div>
  )
}

/** One of the tracker's own filters: a compact select whose first option means "no filter". */
function FilterSelect<K extends string>({ value, onChange, label, any, items }: { value: K | ''; onChange: (v: K | '') => void; label: string; any: string; items: Array<{ value: K; label: string }> }) {
  return (
    <Select small fit value={value} onChange={(e) => onChange(e.target.value as K | '')} aria-label={label}>
      <option value="">{any}</option>
      {items.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  )
}

function NoMatch({ onClear }: { onClear: () => void }) {
  return <Empty icon={<SearchX size={20} />} title="Nothing matches these filters" hint="Try a different search, or clear the filters to see every row." action={<Button onClick={onClear}>Clear filters</Button>} />
}

function Footer({ shown, total, dirty, onClear, children }: { shown: number; total: number; dirty: boolean; onClear: () => void; children?: ReactNode }) {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-ink-100 px-5 py-2.5 text-xs text-ink-500">
      <span className="tnum font-semibold text-ink-600">
        Showing {shown} of {total}
      </span>
      {dirty && (
        <button type="button" onClick={onClear} className="font-semibold text-brand-700 hover:underline">
          Clear filters
        </button>
      )}
      {children && <span className="min-w-0 sm:ml-auto">{children}</span>}
    </p>
  )
}

const SIMPLE_ITEMS = options(SIMPLE_STATUS)
const isClosed = (s: SimpleStatus) => s === 'filed' || s === 'completed'

/* ---------- GST ---------- */

type GstView = 'pending' | 'gstr1' | 'gstr3b' | 'no_data' | 'filed'

const GST_VIEWS: Array<{ value: GstView; label: string }> = [
  { value: 'pending', label: 'Anything pending' },
  { value: 'gstr1', label: 'GSTR-1 pending' },
  { value: 'gstr3b', label: 'GSTR-3B pending' },
  { value: 'no_data', label: 'No data yet' },
  { value: 'filed', label: 'Both filed' },
]

function GstTracker() {
  const gst = useStore((s) => s.gst)
  const updateGst = useStore((s) => s.updateGst)
  const clients = useClientMap()
  const f = useFilters()
  const current = currentGstPeriod()
  const periods = useMemo(() => [...new Set([current, ...gst.map((g) => g.period)])].sort().reverse(), [gst, current])
  const [period, setPeriod] = useState(current)
  const [view, setView] = useState<GstView | ''>('')
  const [freq, setFreq] = useState<'M' | 'Q' | ''>('')
  const [owing, setOwing] = useState(false)

  const isDone = (s: GstFiling['gstr1']) => s === 'filed' || s === 'nil' || s === 'na'
  const balance = (g: GstFiling) => g.prevBalance + g.fee - g.received
  const inView = (g: GstFiling) =>
    !view ||
    (view === 'pending' && (!isDone(g.gstr1) || !isDone(g.gstr3b))) ||
    (view === 'gstr1' && !isDone(g.gstr1)) ||
    (view === 'gstr3b' && !isDone(g.gstr3b)) ||
    (view === 'no_data' && g.gstr1 === 'data_pending') ||
    (view === 'filed' && g.gstr1 !== 'na' && isDone(g.gstr1) && isDone(g.gstr3b))

  const all = useMemo(() => gst.filter((g) => g.period === period), [gst, period])
  const rows = all.filter(
    (g) => f.match(g) && inView(g) && (!freq || (clients.get(g.clientId)?.gstFrequency ?? 'M') === freq) && (!owing || balance(g) > 0),
  )
  const live = rows.filter((g) => g.gstr1 !== 'na')
  const filed = (k: 'gstr1' | 'gstr3b') => live.filter((g) => g[k] === 'filed' || g[k] === 'nil').length
  const dirty = f.dirty || !!view || !!freq || owing
  const clear = () => {
    f.reset()
    setView('')
    setFreq('')
    setOwing(false)
  }

  return (
    <Card>
      <FilterBar
        f={f}
        lead={
          <Select small fit value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Return period" className="font-semibold">
            {periods.map((p) => (
              <option key={p} value={p}>
                {periodLabel(p)}
              </option>
            ))}
          </Select>
        }
      >
        <FilterSelect value={view} onChange={setView} label="Filing status" any="Any status" items={GST_VIEWS} />
        <FilterSelect
          value={freq}
          onChange={setFreq}
          label="Return frequency"
          any="Monthly & quarterly"
          items={[
            { value: 'M', label: 'Monthly' },
            { value: 'Q', label: 'Quarterly' },
          ]}
        />
        <label className="flex h-8 items-center gap-2 px-1 text-[13px] font-semibold text-ink-600">
          <Tick checked={owing} onChange={setOwing} label="Show only clients with a fee balance" />
          Fee balance
        </label>
      </FilterBar>
      <Summary
        items={[
          { label: 'GSTR-1 filed', value: `${filed('gstr1')} / ${live.length}` },
          { label: 'GSTR-3B filed', value: `${filed('gstr3b')} / ${live.length}` },
          { label: 'No data yet', value: live.filter((g) => g.gstr1 === 'data_pending').length, tone: live.some((g) => g.gstr1 === 'data_pending') ? 'red' : undefined },
          { label: 'Fee balance', value: inr(rows.reduce((s, g) => s + Math.max(0, balance(g)), 0)), tone: 'amber' },
        ]}
      />
      {rows.length === 0 ? (
        <NoMatch onClear={clear} />
      ) : (
        <TableShell
          minWidth={900}
          head={
            <>
              <Th>Client</Th>
              <Th>GSTR-1</Th>
              <Th>GSTR-3B</Th>
              <Th>Assigned</Th>
              <Th align="right">Fee</Th>
              <Th align="right">Received</Th>
              <Th align="right">Balance</Th>
              <Th>Remark</Th>
            </>
          }
        >
          {rows.map((g) => {
            const c = clients.get(g.clientId)
            const bal = balance(g)
            return (
              <tr key={g.id} className={cn(g.gstr1 === 'na' && 'bg-ink-50/50 text-ink-400')}>
                <Td>
                  <ClientCell
                    client={c}
                    sub={
                      <>
                        {c?.gstin} · {c?.gstFrequency === 'Q' ? 'Quarterly' : 'Monthly'}
                      </>
                    }
                  />
                </Td>
                <Td>
                  <StatusSelect label="GSTR-1 status" value={g.gstr1} options={options(GST_STATUS)} onChange={(gstr1) => updateGst(g.id, { gstr1 })} />
                </Td>
                <Td>
                  <StatusSelect label="GSTR-3B status" value={g.gstr3b} options={options(GST_STATUS)} onChange={(gstr3b) => updateGst(g.id, { gstr3b })} />
                </Td>
                <Td>
                  <AssigneeSelect value={g.assigneeId} onChange={(assigneeId) => updateGst(g.id, { assigneeId })} />
                </Td>
                <Td className="tnum text-right whitespace-nowrap text-ink-600">
                  {g.fee ? inr(g.fee) : '—'}
                  {g.prevBalance > 0 && <p className="text-xs text-amber-700">+{inr(g.prevBalance)} old</p>}
                </Td>
                <Td className="text-right">
                  <Money value={g.received} onChange={(received) => updateGst(g.id, { received })} label="Fee received" />
                </Td>
                <Td className={cn('tnum text-right font-bold', bal > 0 ? 'text-amber-700' : 'text-ink-400')}>{bal > 0 ? inr(bal) : '—'}</Td>
                <Td>
                  <InlineText value={g.remark} onChange={(remark) => updateGst(g.id, { remark })} />
                </Td>
              </tr>
            )
          })}
        </TableShell>
      )}
      <Footer shown={rows.length} total={all.length} dirty={dirty} onClear={clear}>
        Statuses, fees received and remarks save as you change them.
      </Footer>
    </Card>
  )
}

/* ---------- TDS ---------- */

const PAYMENT: Array<{ value: TdsPayment; label: string; tone: Tone }> = [
  { value: 'paid', label: 'Paid', tone: 'green' },
  { value: 'due', label: 'Due', tone: 'amber' },
  { value: 'na', label: 'N/A', tone: 'neutral' },
]

const QUARTERS = [0, 1, 2, 3].map((n) => ({ value: String(n), label: `Q${n + 1} return` }))

function TdsTracker() {
  const tds = useStore((s) => s.tds)
  const updateTds = useStore((s) => s.updateTds)
  const clients = useClientMap()
  const f = useFilters()
  const current = currentGstPeriod()
  const months = useMemo(() => [...new Set([current, ...tds.flatMap((t) => Object.keys(t.payments))])].sort().reverse(), [tds, current])
  const [month, setMonth] = useState(current)
  const [payment, setPayment] = useState<TdsPayment | ''>('')
  const [quarter, setQuarter] = useState('')
  const [status, setStatus] = useState<SimpleStatus | ''>('')
  const fy = tds[0]?.fy ?? financialYear()
  const monthLabel = periodLabel(month, true)
  // A month with nothing recorded has not been deposited yet.
  const paymentFor = (t: (typeof tds)[number]) => t.payments[month] ?? 'due'

  const rows = tds.filter(
    (t) =>
      f.match(t) &&
      (!payment || paymentFor(t) === payment) &&
      // With a quarter picked the status applies to it; without one, to any quarter.
      (!status || (quarter ? t.quarters[Number(quarter)] === status : t.quarters.includes(status))),
  )
  const dirty = f.dirty || !!payment || !!quarter || !!status
  const clear = () => {
    f.reset()
    setPayment('')
    setQuarter('')
    setStatus('')
  }
  const shownQuarters = quarter ? [Number(quarter)] : [0, 1, 2, 3]

  return (
    <Card>
      <FilterBar
        f={f}
        lead={
          <Select small fit value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Payment month" className="font-semibold">
            {months.map((m) => (
              <option key={m} value={m}>
                {periodLabel(m)}
              </option>
            ))}
          </Select>
        }
      >
        <FilterSelect value={payment} onChange={setPayment} label="Payment" any="Any payment" items={PAYMENT} />
        <FilterSelect value={quarter} onChange={setQuarter} label="Quarter" any="All quarters" items={QUARTERS} />
        <FilterSelect value={status} onChange={setStatus} label="Return status" any="Any return status" items={SIMPLE_ITEMS} />
      </FilterBar>
      <Summary
        items={[
          { label: 'Deductors', value: rows.length },
          { label: `${monthLabel} payment due`, value: rows.filter((t) => paymentFor(t) === 'due').length, tone: 'amber' },
          { label: 'Q1 returns done', value: `${rows.filter((t) => isClosed(t.quarters[0])).length} / ${rows.length}` },
          { label: 'Q2 returns done', value: `${rows.filter((t) => isClosed(t.quarters[1])).length} / ${rows.length}` },
        ]}
      />
      {rows.length === 0 ? (
        <NoMatch onClear={clear} />
      ) : (
        <TableShell
          minWidth={quarter ? 720 : 960}
          head={
            <>
              <Th>Client</Th>
              <Th>{monthLabel} payment</Th>
              {shownQuarters.map((q) => (
                <Th key={q}>Q{q + 1} return</Th>
              ))}
              <Th>Assigned</Th>
              <Th>Remark</Th>
            </>
          }
        >
          {rows.map((t) => {
            const c = clients.get(t.clientId)
            return (
              <tr key={t.id}>
                <Td>
                  <ClientCell client={c} sub={<>TAN {c?.tan}</>} />
                </Td>
                <Td>
                  <StatusSelect
                    label={`TDS payment for ${monthLabel}`}
                    value={paymentFor(t)}
                    options={PAYMENT}
                    onChange={(v) => updateTds(t.id, { payments: { ...t.payments, [month]: v } })}
                  />
                </Td>
                {shownQuarters.map((i) => (
                  <Td key={i}>
                    <StatusSelect
                      label={`Q${i + 1} return`}
                      value={t.quarters[i]}
                      options={SIMPLE_ITEMS}
                      onChange={(v) => {
                        const quarters = [...t.quarters] as typeof t.quarters
                        quarters[i] = v
                        updateTds(t.id, { quarters })
                      }}
                    />
                  </Td>
                ))}
                <Td>
                  <AssigneeSelect value={t.assigneeId} onChange={(assigneeId) => updateTds(t.id, { assigneeId })} />
                </Td>
                <Td>
                  <InlineText value={t.remark} onChange={(remark) => updateTds(t.id, { remark })} />
                </Td>
              </tr>
            )
          })}
        </TableShell>
      )}
      <Footer shown={rows.length} total={tds.length} dirty={dirty} onClear={clear}>
        FY {fy} · payment every month, return every quarter. Income tax and TRACES logins sit on each client's page.
      </Footer>
    </Card>
  )
}

/* ---------- Income tax ---------- */

function ItTracker() {
  const it = useStore((s) => s.it)
  const updateIt = useStore((s) => s.updateIt)
  const clients = useClientMap()
  const f = useFilters()
  const [kind, setKind] = useState<'all' | ItFiling['kind']>('all')
  const [status, setStatus] = useState<SimpleStatus | ''>('')
  const [owing, setOwing] = useState(false)
  const done = (r: ItFiling) => isClosed(r.status)

  // The tabs count what the other filters leave, so the numbers match the table.
  const matched = it.filter((r) => f.match(r) && (!status || r.status === status) && (!owing || r.fee - r.received > 0))
  const rows = kind === 'all' ? matched : matched.filter((r) => r.kind === kind)
  const dirty = f.dirty || kind !== 'all' || !!status || owing
  const clear = () => {
    f.reset()
    setKind('all')
    setStatus('')
    setOwing(false)
  }

  return (
    <Card>
      <FilterBar
        f={f}
        lead={
          <Segmented
            value={kind}
            onChange={setKind}
            items={[
              { value: 'all', label: 'All', count: matched.length },
              { value: 'non_audit', label: 'Non-audit', count: matched.filter((r) => r.kind === 'non_audit').length },
              { value: 'audit', label: 'Audit cases', count: matched.filter((r) => r.kind === 'audit').length },
            ]}
          />
        }
      >
        <FilterSelect value={status} onChange={setStatus} label="Return status" any="Any status" items={SIMPLE_ITEMS} />
        <label className="flex h-8 items-center gap-2 px-1 text-[13px] font-semibold text-ink-600">
          <Tick checked={owing} onChange={setOwing} label="Show only returns with a fee balance" />
          Fee balance
        </label>
      </FilterBar>
      <Summary
        items={[
          { label: 'Returns', value: rows.length },
          { label: 'Filed or completed', value: `${rows.filter(done).length} / ${rows.length}` },
          { label: 'Pending', value: rows.filter((r) => r.status === 'pending').length, tone: 'amber' },
          { label: 'Fee balance', value: inr(rows.reduce((s, r) => s + (done(r) ? Math.max(0, r.fee - r.received) : 0), 0)), tone: 'amber' },
        ]}
      />
      {rows.length === 0 ? (
        <NoMatch onClear={clear} />
      ) : (
        <TableShell
          minWidth={1000}
          head={
            <>
              <Th>Client</Th>
              <Th>Type</Th>
              <Th>Due</Th>
              <Th>Status</Th>
              <Th>Assigned</Th>
              <Th align="right">Fee</Th>
              <Th align="right">Received</Th>
              <Th>Remark</Th>
            </>
          }
        >
          {rows.map((r) => {
            const c = clients.get(r.clientId)
            return (
              <tr key={r.id}>
                <Td>
                  <ClientCell client={c} sub={<>{c?.category}{c?.profession ? ` · ${c.profession}` : ''}</>} />
                </Td>
                <Td>
                  <Badge tone={r.kind === 'audit' ? 'amber' : 'neutral'}>{r.kind === 'audit' ? 'Audit case' : 'Non-audit'}</Badge>
                </Td>
                <Td className="text-[13px]">
                  <Due date={itDueDate(r, c)} done={done(r)} compact />
                </Td>
                <Td>
                  <StatusSelect label="Return status" value={r.status} options={SIMPLE_ITEMS} onChange={(status) => updateIt(r.id, { status })} />
                </Td>
                <Td>
                  <AssigneeSelect value={r.assigneeId} onChange={(assigneeId) => updateIt(r.id, { assigneeId })} />
                </Td>
                <Td className="tnum text-right text-ink-600">{inr(r.fee)}</Td>
                <Td className="text-right">
                  <Money value={r.received} onChange={(received) => updateIt(r.id, { received })} label="Fee received" />
                </Td>
                <Td>
                  <InlineText value={r.remark} onChange={(remark) => updateIt(r.id, { remark })} placeholder={r.status === 'pending' ? 'Why is it pending?' : 'Add remark'} />
                </Td>
              </tr>
            )
          })}
        </TableShell>
      )}
      <Footer shown={rows.length} total={it.length} dirty={dirty} onClear={clear}>
        AY {it[0]?.ay ?? financialYear()} · non-audit individuals 31 Jul, proprietorships 31 Aug, audit cases 31 Oct. The government may extend these dates.
      </Footer>
    </Card>
  )
}

/* ---------- Audit ---------- */

const AUDIT_KINDS: Array<{ value: AuditFiling['kind']; label: string }> = (['Tax audit', 'Statutory audit', 'Internal audit', 'Nil audit'] as const).map((k) => ({ value: k, label: k }))

function AuditTracker() {
  const audits = useStore((s) => s.audits)
  const updateAudit = useStore((s) => s.updateAudit)
  const clients = useClientMap()
  const f = useFilters()
  const [kind, setKind] = useState<AuditFiling['kind'] | ''>('')
  const [status, setStatus] = useState<SimpleStatus | ''>('')
  const [recon, setRecon] = useState<'open' | 'done' | ''>('')

  const rows = audits.filter(
    (a) => f.match(a) && (!kind || a.kind === kind) && (!status || a.status === status) && (!recon || a.reconciliation === (recon === 'done')),
  )
  const dirty = f.dirty || !!kind || !!status || !!recon
  const clear = () => {
    f.reset()
    setKind('')
    setStatus('')
    setRecon('')
  }

  return (
    <Card>
      <FilterBar f={f}>
        <FilterSelect value={kind} onChange={setKind} label="Kind of audit" any="Every kind of audit" items={AUDIT_KINDS.filter((k) => audits.some((a) => a.kind === k.value))} />
        <FilterSelect value={status} onChange={setStatus} label="Audit status" any="Any status" items={SIMPLE_ITEMS} />
        <FilterSelect
          value={recon}
          onChange={setRecon}
          label="Reconciliation"
          any="Any reconciliation"
          items={[
            { value: 'open', label: 'Reconciliation open' },
            { value: 'done', label: 'Reconciled' },
          ]}
        />
      </FilterBar>
      <Summary
        items={[
          { label: 'Audits', value: rows.length },
          { label: 'Filed or completed', value: `${rows.filter((a) => isClosed(a.status)).length} / ${rows.length}` },
          { label: 'Reconciliation open', value: rows.filter((a) => !a.reconciliation).length, tone: 'amber' },
          { label: 'Internal audits awaiting data', value: rows.filter((a) => a.kind === 'Internal audit' && !a.dataReceived).length },
        ]}
      />
      {rows.length === 0 ? (
        <NoMatch onClear={clear} />
      ) : (
        <TableShell
          minWidth={980}
          head={
            <>
              <Th>Client</Th>
              <Th>Audit</Th>
              <Th>Due</Th>
              <Th align="center">Data in</Th>
              <Th align="center">Reconciled</Th>
              <Th>Status</Th>
              <Th>Assigned</Th>
              <Th>Remark</Th>
            </>
          }
        >
          {rows.map((a) => {
            const c = clients.get(a.clientId)
            const closed = isClosed(a.status)
            return (
              <tr key={a.id}>
                <Td>
                  <ClientCell client={c} sub={<>FY {a.fy}</>} />
                </Td>
                <Td>
                  <Badge tone={a.kind === 'Internal audit' ? 'violet' : 'amber'}>{a.kind}</Badge>
                </Td>
                <Td className="text-[13px]">
                  <Due date={a.dueDate} done={closed} compact={closed} />
                </Td>
                <Td>
                  <span className="flex justify-center">
                    {a.kind === 'Internal audit' ? (
                      <Tick checked={a.dataReceived} onChange={(dataReceived) => updateAudit(a.id, { dataReceived })} label="Data received" />
                    ) : (
                      <span className="text-ink-300">—</span>
                    )}
                  </span>
                </Td>
                <Td>
                  <span className="flex justify-center">
                    <Tick checked={a.reconciliation} onChange={(reconciliation) => updateAudit(a.id, { reconciliation })} label="Reconciliation done" />
                  </span>
                </Td>
                <Td>
                  <StatusSelect label="Audit status" value={a.status} options={SIMPLE_ITEMS} onChange={(status) => updateAudit(a.id, { status })} />
                </Td>
                <Td>
                  <AssigneeSelect value={a.assigneeId} onChange={(assigneeId) => updateAudit(a.id, { assigneeId })} />
                </Td>
                <Td>
                  <InlineText value={a.remark} onChange={(remark) => updateAudit(a.id, { remark })} />
                </Td>
              </tr>
            )
          })}
        </TableShell>
      )}
      <Footer shown={rows.length} total={audits.length} dirty={dirty} onClear={clear} />
    </Card>
  )
}

/* ---------- One-time services ---------- */

function ServiceForm({ onClose, clientId = '' }: { onClose: () => void; clientId?: string }) {
  const addService = useStore((s) => s.addService)
  const clients = useStore((s) => s.clients)
  const employees = useStore((s) => s.employees)
  const [f, setF] = useState({
    clientId,
    party: '',
    kind: SERVICE_KINDS[0] as ServiceKind,
    details: '',
    committedDate: addDays(todayISO(), 10),
    assigneeId: employees.find((e) => e.id === 'e-anna')?.id ?? employees[0].id,
    fee: 3000,
  })
  const party = f.clientId ? (clients.find((c) => c.id === f.clientId)?.name ?? '') : f.party.trim()

  return (
    <Modal
      title="New one-time job"
      subtitle="Registrations, incorporations and other work with a date committed to the customer."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!party || ((f.kind === 'Certification' || f.kind === 'Other') && !f.details.trim())}
            onClick={() => {
              addService({ party, clientId: f.clientId || undefined, kind: f.kind, details: f.details.trim() || undefined, committedDate: f.committedDate, assigneeId: f.assigneeId, fee: f.fee, received: 0, status: 'to_begin', remark: '' })
              onClose()
            }}
          >
            Add job
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Service">
          <Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as ServiceKind })}>
            {SERVICE_KINDS.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </Select>
        </Field>
        <Field label="Details" hint={f.kind === 'Certification' || f.kind === 'Other' ? 'say which' : 'optional'}>
          <Input
            value={f.details}
            onChange={(e) => setF({ ...f, details: e.target.value })}
            placeholder={f.kind === 'Certification' ? 'e.g. ISO 9001 renewal' : f.kind === 'Other' ? 'What is the job?' : ''}
          />
        </Field>
        <Field label="Existing client">
          <Select value={f.clientId} onChange={(e) => setF({ ...f, clientId: e.target.value })}>
            <option value="">Not a client yet</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Or party name">
          <Input value={f.party} onChange={(e) => setF({ ...f, party: e.target.value })} disabled={!!f.clientId} placeholder="New customer" />
        </Field>
        <Field label="Date committed to customer">
          <Input type="date" value={f.committedDate} onChange={(e) => setF({ ...f, committedDate: e.target.value })} />
        </Field>
        <Field label="Assign to">
          <Select value={f.assigneeId} onChange={(e) => setF({ ...f, assigneeId: e.target.value })}>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Fee (₹)">
          <Input type="number" min={0} step={500} value={f.fee} onChange={(e) => setF({ ...f, fee: Math.max(0, Number(e.target.value) || 0) })} />
        </Field>
      </div>
    </Modal>
  )
}

function ServiceTracker() {
  const services = useStore((s) => s.services)
  const updateService = useStore((s) => s.updateService)
  const f = useFilters()
  const [adding, setAdding] = useState(false)
  const [kind, setKind] = useState<ServiceKind | ''>('')
  const [status, setStatus] = useState<SimpleStatus | ''>('')
  const [late, setLate] = useState(false)
  const today = todayISO()
  const overdue = (s: (typeof services)[number]) => s.status !== 'completed' && s.committedDate < today

  const rows = useMemo(
    () => [...services].sort((a, b) => Number(a.status === 'completed') - Number(b.status === 'completed') || a.committedDate.localeCompare(b.committedDate)),
    [services],
  ).filter((s) => f.match(s, `${s.party} ${s.kind} ${s.details ?? ''}`) && (!kind || s.kind === kind) && (!status || s.status === status) && (!late || overdue(s)))
  const open = rows.filter((s) => s.status !== 'completed')
  const dirty = f.dirty || !!kind || !!status || late
  const clear = () => {
    f.reset()
    setKind('')
    setStatus('')
    setLate(false)
  }

  return (
    <Card>
      <FilterBar f={f}>
        <FilterSelect value={kind} onChange={setKind} label="Service" any="Every service" items={SERVICE_KINDS.map((k) => ({ value: k, label: k }))} />
        <FilterSelect value={status} onChange={setStatus} label="Job status" any="Any status" items={SIMPLE_ITEMS} />
        <label className="flex h-8 items-center gap-2 px-1 text-[13px] font-semibold text-ink-600">
          <Tick checked={late} onChange={setLate} label="Show only jobs past their committed date" />
          Past committed date
        </label>
        <Button size="sm" variant="primary" icon={<Plus size={15} />} onClick={() => setAdding(true)}>
          Add job
        </Button>
      </FilterBar>
      <Summary
        items={[
          { label: 'Open jobs', value: open.length },
          { label: 'Past committed date', value: open.filter(overdue).length, tone: 'red' },
          { label: 'Completed', value: rows.length - open.length, tone: 'green' },
          { label: 'Fee balance', value: inr(rows.reduce((sum, s) => sum + Math.max(0, s.fee - s.received), 0)), tone: 'amber' },
        ]}
      />
      {rows.length === 0 ? (
        f.client && !kind && !status && !late && !f.q.trim() && !f.assignee ? (
          <Empty
            title={`No one-time jobs for ${f.client.name} yet`}
            hint="Add the registration, certificate or application this client has asked for."
            action={
              <Button variant="primary" icon={<Plus size={15} />} onClick={() => setAdding(true)}>
                Add job
              </Button>
            }
          />
        ) : (
          <NoMatch onClear={clear} />
        )
      ) : (
        <TableShell
          minWidth={1000}
          head={
            <>
              <Th>Party</Th>
              <Th>Service</Th>
              <Th>Committed date</Th>
              <Th>Status</Th>
              <Th>Assigned</Th>
              <Th align="right">Fee</Th>
              <Th align="right">Received</Th>
              <Th>Remark</Th>
            </>
          }
        >
          {rows.map((s) => (
            <tr key={s.id}>
              <Td>
                {s.clientId ? (
                  <Link to={`/clients/${s.clientId}`} className="font-semibold text-ink-900 hover:text-brand-700 hover:underline">
                    {s.party}
                  </Link>
                ) : (
                  <span className="font-semibold text-ink-900">
                    {s.party} <Badge className="ml-1">Not a client yet</Badge>
                  </span>
                )}
              </Td>
              <Td>
                <Badge tone="green">{s.kind}</Badge>
                {s.details && <p className="mt-0.5 max-w-52 truncate text-xs text-ink-500" title={s.details}>{s.details}</p>}
              </Td>
              <Td className="text-[13px]">
                <Due date={s.committedDate} done={s.status === 'completed'} />
              </Td>
              <Td>
                <StatusSelect label="Job status" value={s.status} options={SIMPLE_ITEMS} onChange={(status) => updateService(s.id, { status })} />
              </Td>
              <Td>
                <AssigneeSelect value={s.assigneeId} onChange={(assigneeId) => updateService(s.id, { assigneeId })} />
              </Td>
              <Td className="tnum text-right text-ink-600">{inr(s.fee)}</Td>
              <Td className="text-right">
                <Money value={s.received} onChange={(received) => updateService(s.id, { received })} label="Fee received" />
              </Td>
              <Td>
                <InlineText value={s.remark} onChange={(remark) => updateService(s.id, { remark })} />
              </Td>
            </tr>
          ))}
        </TableShell>
      )}
      <Footer shown={rows.length} total={services.length} dirty={dirty} onClear={clear}>
        Registrations, incorporations, trademark, FSSAI, DSC, legal metrology, certifications, PAN and TAN applications
      </Footer>
      {adding && <ServiceForm clientId={f.client?.id} onClose={() => setAdding(false)} />}
    </Card>
  )
}

/* ---------- Page ---------- */

const PAGES: Record<TrackerTab, { title: string; subtitle: string; body: () => ReactNode }> = {
  gst: { title: 'GST filing', subtitle: 'Monthly · GSTR-1 by the 11th and GSTR-3B by the 20th, staff cut-off a day earlier.', body: () => <GstTracker /> },
  tds: { title: 'TDS', subtitle: 'Payment every month, return every quarter.', body: () => <TdsTracker /> },
  it: { title: 'Income tax', subtitle: 'Yearly returns, audit and non-audit cases.', body: () => <ItTracker /> },
  audit: { title: 'Audit', subtitle: 'Tax, statutory and internal audits with reconciliation.', body: () => <AuditTracker /> },
  services: { title: 'One-time work', subtitle: 'Jobs with a date committed to the customer.', body: () => <ServiceTracker /> },
}

export default function Compliance() {
  const { tab } = useParams()
  const page = PAGES[tab as TrackerTab]
  if (!tab) return <Navigate to="/filings/gst" replace />
  if (!page)
    return (
      <Card>
        <Empty title="No such tracker" hint="Pick GST, TDS, Income tax, Audit or One-time from the sidebar." />
      </Card>
    )
  return (
    <>
      <PageHeader title={page.title} subtitle={page.subtitle} />
      {page.body()}
    </>
  )
}

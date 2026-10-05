import { Check, Inbox, Plus, Search, SearchX, X } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { Due } from '../components/bits'
import { Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Segmented, Select, StatusSelect, Td, Th } from '../components/ui'
import { itDueDate } from '../lib/deadlines'
import { addDays, cn, currentGstPeriod, financialYear, fmtDate, inr, periodLabel, shiftPeriod, todayISO } from '../lib/format'
import { GST_DATA_TYPES, GST_STATUS, SERVICE_KINDS, SIMPLE_STATUS, options, type Tone, type TrackerTab } from '../lib/meta'
import { useCan, useStore } from '../store'
import type { AuditFiling, Client, GstDataType, GstFiling, ItFiling, ServiceKind, SimpleStatus, TdsPayment } from '../types'

/* ---------- Small inline editors shared by every tracker ---------- */

function AssigneeSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const employees = useStore((s) => s.employees)
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Assigned to"
      className="chevron h-7 max-w-24 appearance-none truncate rounded-md bg-transparent pr-5 pl-1.5 text-[13px] font-medium text-ink-700 hover:bg-ink-100 focus:ring-2 focus:ring-brand-500 focus:outline-none @max-3xl:-ml-1.5 @max-3xl:max-w-full"
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
      className="h-7 w-full min-w-28 rounded-md bg-transparent px-1.5 text-[13px] text-ink-700 placeholder:text-ink-300 hover:bg-ink-100 focus:bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none @max-3xl:bg-white @max-3xl:ring-1 @max-3xl:ring-ink-200 @max-3xl:ring-inset"
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
      className="tnum h-7 w-[68px] rounded-md bg-transparent px-1.5 text-right text-[13px] font-medium text-ink-800 hover:bg-ink-100 focus:bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none @max-3xl:w-24 @max-3xl:bg-white @max-3xl:text-left @max-3xl:ring-1 @max-3xl:ring-ink-200 @max-3xl:ring-inset"
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

/**
 * The day the client's data came in. Until then a button marks it in today, which is when it usually happens;
 * after that the date can be changed, or cleared to mark it not in again.
 */
function DataIn({ value, onChange }: { value?: string; onChange: (date?: string) => void }) {
  if (!value)
    return (
      <button
        type="button"
        onClick={() => onChange(todayISO())}
        title="Not in yet. Click when it arrives: it is dated today, and the date can be changed after."
        className="inline-flex h-7 items-center gap-1.5 rounded-md px-1.5 text-[13px] font-semibold whitespace-nowrap text-amber-700 hover:bg-amber-50 @max-3xl:-ml-1.5"
      >
        <Inbox size={14} />
        Mark in
      </button>
    )
  return (
    <input
      type="date"
      value={value}
      max={todayISO()}
      onChange={(e) => onChange(e.target.value || undefined)}
      aria-label="Data came in on"
      title={`Data in ${fmtDate(value, true)}. Clear the date to mark it not in.`}
      className="tnum h-7 w-[124px] rounded-md bg-transparent px-1.5 text-[13px] font-medium text-ink-700 hover:bg-ink-100 focus:bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none @max-3xl:-ml-1.5"
    />
  )
}

function DataTypeSelect({ value, onChange }: { value?: GstDataType; onChange: (v?: GstDataType) => void }) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange((e.target.value || undefined) as GstDataType | undefined)}
      aria-label="Data type"
      className={cn(
        'chevron h-7 max-w-full appearance-none rounded-md bg-transparent pr-5 pl-1.5 text-[13px] font-medium hover:bg-ink-100 focus:ring-2 focus:ring-brand-500 focus:outline-none @max-3xl:-ml-1.5',
        value ? 'text-ink-700' : 'text-ink-400',
      )}
    >
      <option value="">Not set</option>
      {GST_DATA_TYPES.map((d) => (
        <option key={d.value} value={d.value}>
          {d.label}
        </option>
      ))}
    </select>
  )
}

function ClientCell({ client, sub }: { client?: Client; sub?: ReactNode }) {
  if (!client) return <span className="text-ink-400">Unknown client</span>
  return (
    <div className="min-w-0">
      <Link to={`/clients/${client.id}`} title={client.name} className="block truncate font-semibold text-ink-900 hover:text-brand-700 hover:underline @3xl:max-w-40 @3xl:2xl:max-w-64">
        {client.name}
      </Link>
      {sub && <p className="tnum truncate text-xs text-ink-500 @3xl:max-w-40 @3xl:2xl:max-w-64">{sub}</p>}
    </div>
  )
}

const SUMMARY_COLS: Record<number, string> = { 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-4', 5: 'sm:grid-cols-5', 6: 'sm:grid-cols-3 xl:grid-cols-6' }

/** A handful of figures across the top of a tracker. Pass `false` for one that does not apply to this viewer. */
function Summary({ items }: { items: Array<{ label: string; value: ReactNode; tone?: Tone } | false> }) {
  const color: Partial<Record<Tone, string>> = { red: 'text-rose-600', amber: 'text-amber-700', green: 'text-emerald-700' }
  const shown = items.filter((it) => it !== false)
  return (
    <dl className={cn('grid grid-cols-2 divide-ink-100 border-b border-ink-100 sm:divide-x', SUMMARY_COLS[shown.length])}>
      {shown.map((it) => (
        <div key={it.label} className="px-5 py-3">
          <dt className="text-xs font-semibold text-ink-500">{it.label}</dt>
          <dd className={cn('tnum mt-0.5 text-lg font-extrabold', (it.tone && color[it.tone]) || 'text-ink-900')}>{it.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function TableShell({ minWidth, head, foot, children }: { minWidth: number; head: ReactNode; foot?: ReactNode; children: ReactNode }) {
  return (
    <div className="@container overflow-x-auto">
      <table className="stack w-full text-sm [&_td]:px-2 [&_th]:px-2" style={{ minWidth }}>
        <thead className="border-b border-ink-100 bg-ink-50/60">
          <tr>{head}</tr>
        </thead>
        <tbody className="divide-y divide-ink-100">{children}</tbody>
        {foot && <tfoot className="border-t border-ink-200 bg-ink-50/60">{foot}</tfoot>}
      </table>
    </div>
  )
}

/**
 * The sum of the rows on screen, lined up under the fee columns. `lead` is how many columns come before Fee
 * and `trail` how many after Received. Where the table has no Balance column the balance is spelt out at the end.
 */
function Totals({ lead, trail, count, fee, old = 0, received, balance, balanceColumn }: { lead: number; trail: number; count: number; fee: number; old?: number; received: number; balance: number; balanceColumn?: boolean }) {
  const cell = 'py-2.5 first:pl-5 last:pr-5'
  const due = <span className={balance > 0 ? 'text-amber-700' : 'text-ink-500'}>{inr(balance)}</span>
  return (
    <tr className="text-[13px] font-bold text-ink-800">
      <td colSpan={lead} className={cell}>
        Total <span className="font-medium text-ink-500">· {count === 1 ? '1 row' : `${count} rows`}</span>
      </td>
      <td data-label="Fee" className={cn(cell, 'tnum text-right whitespace-nowrap')}>
        {inr(fee)}
        {old > 0 && <p className="text-xs font-semibold text-amber-700">+{inr(old)} old</p>}
      </td>
      <td data-label="Received" className={cn(cell, 'tnum text-right whitespace-nowrap')}>
        {/* The amounts above sit inside input boxes; this lines the total up with them. */}
        <span className="@3xl:pr-1.5">{inr(received)}</span>
      </td>
      {balanceColumn && (
        <td data-label="Balance" className={cn(cell, 'tnum text-right whitespace-nowrap')}>
          {due}
        </td>
      )}
      {/* As cards, the label above the figure already says "Balance". */}
      <td data-label="Balance" colSpan={balanceColumn ? trail - 1 : trail} className={cn(cell, 'tnum whitespace-nowrap')}>
        {!balanceColumn && (
          <>
            <span className="font-medium text-ink-500 @max-3xl:hidden">Balance </span>
            {due}
          </>
        )}
      </td>
    </tr>
  )
}

function useClientMap() {
  const clients = useStore((s) => s.clients)
  return useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients])
}

/* ---------- Filters shared by every tracker ---------- */

/**
 * Search and "assigned to" live here. Two of them sit in the address so other pages can link straight to a narrowed
 * tracker: `?client=` from a client's scope of work, `?assignee=` from a person's page.
 */
function useFilters() {
  const [params, setParams] = useSearchParams()
  const clients = useClientMap()
  const [q, setQ] = useState('')
  const clientId = params.get('client') ?? ''
  const assignee = params.get('assignee') ?? ''
  const term = q.trim().toLowerCase()
  const setParam = (key: string, value: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true },
    )

  return {
    q,
    setQ,
    assignee,
    setAssignee: (id: string) => setParam('assignee', id),
    client: clients.get(clientId),
    clientId,
    clearClient: () => setParam('client', ''),
    dirty: !!(term || assignee || clientId),
    reset: () => {
      setQ('')
      if (clientId || assignee) setParams({}, { replace: true })
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
        <div className="relative min-w-44 flex-1 max-sm:basis-full">
          <Search size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-400" />
          <Input small value={f.q} onChange={(e) => f.setQ(e.target.value)} placeholder="Search client, code, place…" aria-label="Search this tracker" className="pl-8" />
        </div>
        {children}
        <Select small fit value={f.assignee} onChange={(e) => f.setAssignee(e.target.value)} aria-label="Assigned to" className="max-sm:min-w-0 max-sm:flex-1 max-sm:basis-[40%]">
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
    <Select small fit value={value} onChange={(e) => onChange(e.target.value as K | '')} aria-label={label} className="max-sm:min-w-0 max-sm:flex-1 max-sm:basis-[40%]">
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
  { value: 'no_data', label: 'Data not in' },
  { value: 'filed', label: 'Both filed' },
]

function GstTracker() {
  const gst = useStore((s) => s.gst)
  const updateGst = useStore((s) => s.updateGst)
  const clients = useClientMap()
  const fees = useCan()('view_fees')
  const f = useFilters()
  const current = currentGstPeriod()
  const periods = useMemo(() => [...new Set([current, ...gst.map((g) => g.period)])].sort().reverse(), [gst, current])
  const [period, setPeriod] = useState(current)
  const [view, setView] = useState<GstView | ''>('')
  const [freq, setFreq] = useState<'M' | 'Q' | ''>('')
  const [dataType, setDataType] = useState<GstDataType | ''>('')
  const [owing, setOwing] = useState(false)
  // Once the data is in, a return that was waiting for it can begin.
  const setDataIn = (g: GstFiling, dataIn?: string) =>
    updateGst(g.id, {
      dataIn,
      ...(dataIn && g.gstr1 === 'data_pending' && { gstr1: 'to_begin' }),
      ...(dataIn && g.gstr3b === 'data_pending' && { gstr3b: 'to_begin' }),
    })

  const isDone = (s: GstFiling['gstr1']) => s === 'filed' || s === 'nil' || s === 'na'
  const balance = (g: GstFiling) => g.prevBalance + g.fee - g.received
  const inView = (g: GstFiling) =>
    !view ||
    (view === 'pending' && (!isDone(g.gstr1) || !isDone(g.gstr3b))) ||
    (view === 'gstr1' && !isDone(g.gstr1)) ||
    (view === 'gstr3b' && !isDone(g.gstr3b)) ||
    (view === 'no_data' && g.gstr1 !== 'na' && !g.dataIn) ||
    (view === 'filed' && g.gstr1 !== 'na' && isDone(g.gstr1) && isDone(g.gstr3b))

  const all = useMemo(() => gst.filter((g) => g.period === period), [gst, period])
  const rows = all.filter(
    (g) =>
      f.match(g) &&
      inView(g) &&
      (!freq || (clients.get(g.clientId)?.gstFrequency ?? 'M') === freq) &&
      (!dataType || g.dataType === dataType) &&
      (!owing || (fees && balance(g) > 0)),
  )
  const live = rows.filter((g) => g.gstr1 !== 'na')
  const filed = (k: 'gstr1' | 'gstr3b') => live.filter((g) => g[k] === 'filed' || g[k] === 'nil').length
  const notIn = live.filter((g) => !g.dataIn).length
  const dirty = f.dirty || !!view || !!freq || !!dataType || owing
  const clear = () => {
    f.reset()
    setView('')
    setFreq('')
    setDataType('')
    setOwing(false)
  }

  return (
    <Card>
      <FilterBar
        f={f}
        lead={
          <Select small fit value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Return period" className="font-semibold max-sm:w-full">
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
        <FilterSelect value={dataType} onChange={setDataType} label="Data type" any="Any data type" items={GST_DATA_TYPES} />
        {fees && (
          <label className="flex h-8 items-center gap-2 px-1 text-[13px] font-semibold text-ink-600">
            <Tick checked={owing} onChange={setOwing} label="Show only clients with a fee balance" />
            Fee balance
          </label>
        )}
      </FilterBar>
      <Summary
        items={[
          { label: 'GSTR-1 filed', value: `${filed('gstr1')} / ${live.length}` },
          { label: 'GSTR-3B filed', value: `${filed('gstr3b')} / ${live.length}` },
          { label: 'Data not in', value: notIn, tone: notIn ? 'red' : undefined },
          fees && { label: 'Fee balance', value: inr(rows.reduce((s, g) => s + Math.max(0, balance(g)), 0)), tone: 'amber' },
        ]}
      />
      {rows.length === 0 ? (
        <NoMatch onClear={clear} />
      ) : (
        <TableShell
          minWidth={fees ? 1180 : 900}
          head={
            <>
              <Th>Client</Th>
              <Th>Data in</Th>
              <Th>Data type</Th>
              <Th>GSTR-1</Th>
              <Th>GSTR-3B</Th>
              <Th>Assigned</Th>
              {fees && (
                <>
                  <Th align="right">Fee</Th>
                  <Th align="right">Received</Th>
                  <Th align="right">Balance</Th>
                </>
              )}
              <Th>Remark</Th>
            </>
          }
          foot={
            fees && <Totals
              lead={6}
              trail={2}
              balanceColumn
              count={rows.length}
              fee={rows.reduce((s, g) => s + g.fee, 0)}
              old={rows.reduce((s, g) => s + g.prevBalance, 0)}
              received={rows.reduce((s, g) => s + g.received, 0)}
              balance={rows.reduce((s, g) => s + Math.max(0, balance(g)), 0)}
            />
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
                <Td label="Data in">{g.gstr1 === 'na' ? <span className="text-ink-300">—</span> : <DataIn value={g.dataIn} onChange={(d) => setDataIn(g, d)} />}</Td>
                <Td label="Data type">{g.gstr1 === 'na' ? <span className="text-ink-300">—</span> : <DataTypeSelect value={g.dataType} onChange={(dataType) => updateGst(g.id, { dataType })} />}</Td>
                <Td label="GSTR-1">
                  <StatusSelect label="GSTR-1 status" value={g.gstr1} options={options(GST_STATUS)} onChange={(gstr1) => updateGst(g.id, { gstr1 })} />
                </Td>
                <Td label="GSTR-3B">
                  <StatusSelect label="GSTR-3B status" value={g.gstr3b} options={options(GST_STATUS)} onChange={(gstr3b) => updateGst(g.id, { gstr3b })} />
                </Td>
                <Td label="Assigned">
                  <AssigneeSelect value={g.assigneeId} onChange={(assigneeId) => updateGst(g.id, { assigneeId })} />
                </Td>
                {fees && (
                  <>
                    <Td label="Fee" className="tnum text-right whitespace-nowrap text-ink-600">
                      {g.fee ? inr(g.fee) : '—'}
                      {g.prevBalance > 0 && <p className="text-xs text-amber-700">+{inr(g.prevBalance)} old</p>}
                    </Td>
                    <Td label="Received" className="text-right">
                      <Money value={g.received} onChange={(received) => updateGst(g.id, { received })} label="Fee received" />
                    </Td>
                    <Td label="Balance" className={cn('tnum text-right font-bold', bal > 0 ? 'text-amber-700' : 'text-ink-400')}>{bal > 0 ? inr(bal) : '—'}</Td>
                  </>
                )}
                <Td label="Remark" className="col-span-full">
                  <InlineText value={g.remark} onChange={(remark) => updateGst(g.id, { remark })} />
                </Td>
              </tr>
            )
          })}
        </TableShell>
      )}
      <Footer shown={rows.length} total={all.length} dirty={dirty} onClear={clear}>
        Data in, statuses{fees && ', fees received'} and remarks save as you change them. Marking the data in moves a return waiting for it to To begin.
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
  const fees = useCan()('view_fees')
  const f = useFilters()
  const current = currentGstPeriod()
  const months = useMemo(() => [...new Set([current, ...tds.flatMap((t) => Object.keys(t.payments))])].sort().reverse(), [tds, current])
  const [month, setMonth] = useState(current)
  const [payment, setPayment] = useState<TdsPayment | ''>('')
  const [quarter, setQuarter] = useState('')
  const [status, setStatus] = useState<SimpleStatus | ''>('')
  const [owing, setOwing] = useState(false)
  const [notIn, setNotIn] = useState(false)
  const fy = tds[0]?.fy ?? financialYear()
  // Just the month's name ("September"): the year is in the month picker, and "Sep 26" would read like a date.
  const monthLabel = periodLabel(month).split(' ')[0]
  // A month with nothing recorded has not been deposited yet.
  const paymentFor = (t: (typeof tds)[number]) => t.payments[month] ?? 'due'
  /** Deposits made this financial year: April up to the month being worked on, leaving out months marked N/A. */
  const paidSoFar = (t: (typeof tds)[number]) => {
    const y = Number(t.fy.slice(0, 4))
    let paid = 0
    let months = 0
    for (let m = `${y}-04`; m <= current && m <= `${y + 1}-03`; m = shiftPeriod(m, 1)) {
      if (t.payments[m] === 'na') continue
      months++
      if (t.payments[m] === 'paid') paid++
    }
    return { paid, months }
  }
  const owed = (t: (typeof tds)[number]) => Math.max(0, t.fee - t.received)
  const setDataIn = (t: (typeof tds)[number], date?: string) => {
    const dataIn = { ...t.dataIn }
    if (date) dataIn[month] = date
    else delete dataIn[month]
    updateTds(t.id, { dataIn })
  }

  const rows = tds.filter(
    (t) =>
      f.match(t) &&
      (!payment || paymentFor(t) === payment) &&
      // With a quarter picked the status applies to it; without one, to any quarter.
      (!status || (quarter ? t.quarters[Number(quarter)] === status : t.quarters.includes(status))) &&
      (!notIn || !t.dataIn[month]) &&
      (!owing || (fees && owed(t) > 0)),
  )
  const feeBalance = rows.reduce((s, t) => s + owed(t), 0)
  const dirty = f.dirty || !!payment || !!quarter || !!status || owing || notIn
  const clear = () => {
    f.reset()
    setPayment('')
    setQuarter('')
    setStatus('')
    setOwing(false)
    setNotIn(false)
  }
  const shownQuarters = quarter ? [Number(quarter)] : [0, 1, 2, 3]

  return (
    <Card>
      <FilterBar
        f={f}
        lead={
          <Select small fit value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Payment month" className="font-semibold max-sm:w-full">
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
        <label className="flex h-8 items-center gap-2 px-1 text-[13px] font-semibold text-ink-600">
          <Tick checked={notIn} onChange={setNotIn} label={`Show only deductors whose ${monthLabel} data is not in`} />
          Data not in
        </label>
        {fees && (
          <label className="flex h-8 items-center gap-2 px-1 text-[13px] font-semibold text-ink-600">
            <Tick checked={owing} onChange={setOwing} label="Show only deductors with a fee balance" />
            Fee balance
          </label>
        )}
      </FilterBar>
      <Summary
        items={[
          { label: `${monthLabel} paid`, value: `${rows.filter((t) => paymentFor(t) === 'paid').length} / ${rows.length}`, tone: 'green' },
          { label: `${monthLabel} payment due`, value: rows.filter((t) => paymentFor(t) === 'due').length, tone: 'amber' },
          { label: `${monthLabel} data not in`, value: rows.filter((t) => !t.dataIn[month]).length, tone: 'red' },
          { label: 'Q1 returns done', value: `${rows.filter((t) => isClosed(t.quarters[0])).length} / ${rows.length}` },
          { label: 'Q2 returns done', value: `${rows.filter((t) => isClosed(t.quarters[1])).length} / ${rows.length}` },
          fees && { label: 'Fee balance', value: inr(feeBalance), tone: 'amber' },
        ]}
      />
      {rows.length === 0 ? (
        <NoMatch onClear={clear} />
      ) : (
        <TableShell
          minWidth={(quarter ? 860 : 1100) + (fees ? 140 : 0)}
          head={
            <>
              <Th>Client</Th>
              <Th>{monthLabel} data in</Th>
              <Th>{monthLabel} payment</Th>
              {shownQuarters.map((q) => (
                <Th key={q}>Q{q + 1} return</Th>
              ))}
              <Th>Assigned</Th>
              {fees && (
                <>
                  <Th align="right">Fee</Th>
                  <Th align="right">Received</Th>
                </>
              )}
              <Th>Remark</Th>
            </>
          }
          foot={
            fees && <Totals
              lead={shownQuarters.length + 4}
              trail={1}
              count={rows.length}
              fee={rows.reduce((s, t) => s + t.fee, 0)}
              received={rows.reduce((s, t) => s + t.received, 0)}
              balance={feeBalance}
            />
          }
        >
          {rows.map((t) => {
            const c = clients.get(t.clientId)
            const year = paidSoFar(t)
            return (
              <tr key={t.id}>
                <Td>
                  <ClientCell client={c} sub={<>TAN {c?.tan}</>} />
                </Td>
                <Td label={`${monthLabel} data in`}>
                  <DataIn value={t.dataIn[month]} onChange={(d) => setDataIn(t, d)} />
                </Td>
                <Td label={`${monthLabel} payment`}>
                  <StatusSelect
                    label={`TDS payment for ${monthLabel}`}
                    value={paymentFor(t)}
                    options={PAYMENT}
                    onChange={(v) => updateTds(t.id, { payments: { ...t.payments, [month]: v } })}
                  />
                  {year.months > 0 && (
                    <p className={cn('tnum mt-0.5 text-xs whitespace-nowrap', year.paid < year.months ? 'text-amber-700' : 'text-ink-500')} title={`Deposits made in FY ${t.fy} so far`}>
                      {year.paid} of {year.months} months paid
                    </p>
                  )}
                </Td>
                {shownQuarters.map((i) => (
                  <Td label={`Q${i + 1} return`} key={i}>
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
                <Td label="Assigned">
                  <AssigneeSelect value={t.assigneeId} onChange={(assigneeId) => updateTds(t.id, { assigneeId })} />
                </Td>
                {fees && (
                  <>
                    <Td label="Fee" className="tnum text-right text-ink-600">{t.fee ? inr(t.fee) : '—'}</Td>
                    <Td label="Received" className="text-right">
                      <Money value={t.received} onChange={(received) => updateTds(t.id, { received })} label="Fee received" />
                    </Td>
                  </>
                )}
                <Td label="Remark" className="col-span-full">
                  <InlineText value={t.remark} onChange={(remark) => updateTds(t.id, { remark })} />
                </Td>
              </tr>
            )
          })}
        </TableShell>
      )}
      <Footer shown={rows.length} total={tds.length} dirty={dirty} onClear={clear}>
        FY {fy} · deduction details and payment every month, return every quarter{fees && ' · the fee is what has been billed this year so far'}. Income tax and TRACES logins sit on each client's page.
      </Footer>
    </Card>
  )
}

/* ---------- Income tax ---------- */

function ItTracker() {
  const it = useStore((s) => s.it)
  const updateIt = useStore((s) => s.updateIt)
  const clients = useClientMap()
  const fees = useCan()('view_fees')
  const f = useFilters()
  const [kind, setKind] = useState<'all' | ItFiling['kind']>('all')
  const [status, setStatus] = useState<SimpleStatus | ''>('')
  const [owing, setOwing] = useState(false)
  const [notIn, setNotIn] = useState(false)
  const done = (r: ItFiling) => isClosed(r.status)

  // The tabs count what the other filters leave, so the numbers match the table.
  const matched = it.filter((r) => f.match(r) && (!status || r.status === status) && (!notIn || !r.dataIn) && (!owing || (fees && r.fee - r.received > 0)))
  const rows = kind === 'all' ? matched : matched.filter((r) => r.kind === kind)
  // A return's fee falls due once it is filed.
  const feeBalance = rows.reduce((s, r) => s + (done(r) ? Math.max(0, r.fee - r.received) : 0), 0)
  const dirty = f.dirty || kind !== 'all' || !!status || owing || notIn
  const clear = () => {
    f.reset()
    setKind('all')
    setStatus('')
    setOwing(false)
    setNotIn(false)
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
          <Tick checked={notIn} onChange={setNotIn} label="Show only returns whose data is not in" />
          Data not in
        </label>
        {fees && (
          <label className="flex h-8 items-center gap-2 px-1 text-[13px] font-semibold text-ink-600">
            <Tick checked={owing} onChange={setOwing} label="Show only returns with a fee balance" />
            Fee balance
          </label>
        )}
      </FilterBar>
      <Summary
        items={[
          { label: 'Returns', value: rows.length },
          { label: 'Data not in', value: rows.filter((r) => !r.dataIn && !done(r)).length, tone: 'red' },
          { label: 'Filed or completed', value: `${rows.filter(done).length} / ${rows.length}` },
          { label: 'Pending', value: rows.filter((r) => r.status === 'pending').length, tone: 'amber' },
          fees && { label: 'Fee balance', value: inr(feeBalance), tone: 'amber' },
        ]}
      />
      {rows.length === 0 ? (
        <NoMatch onClear={clear} />
      ) : (
        <TableShell
          minWidth={fees ? 1140 : 900}
          head={
            <>
              <Th>Client</Th>
              <Th>Type</Th>
              <Th>Due</Th>
              <Th>Data in</Th>
              <Th>Status</Th>
              <Th>Assigned</Th>
              {fees && (
                <>
                  <Th align="right">Fee</Th>
                  <Th align="right">Received</Th>
                </>
              )}
              <Th>Remark</Th>
            </>
          }
          foot={fees && <Totals lead={6} trail={1} count={rows.length} fee={rows.reduce((s, r) => s + r.fee, 0)} received={rows.reduce((s, r) => s + r.received, 0)} balance={feeBalance} />}
        >
          {rows.map((r) => {
            const c = clients.get(r.clientId)
            return (
              <tr key={r.id}>
                <Td>
                  <ClientCell client={c} sub={<>{c?.category}{c?.profession ? ` · ${c.profession}` : ''}</>} />
                </Td>
                <Td label="Type">
                  <Badge tone={r.kind === 'audit' ? 'amber' : 'neutral'}>{r.kind === 'audit' ? 'Audit case' : 'Non-audit'}</Badge>
                </Td>
                <Td label="Due" className="text-[13px]">
                  <Due date={itDueDate(r, c)} done={done(r)} compact />
                </Td>
                <Td label="Data in">
                  <DataIn value={r.dataIn} onChange={(dataIn) => updateIt(r.id, { dataIn })} />
                </Td>
                <Td label="Status">
                  <StatusSelect label="Return status" value={r.status} options={SIMPLE_ITEMS} onChange={(status) => updateIt(r.id, { status })} />
                </Td>
                <Td label="Assigned">
                  <AssigneeSelect value={r.assigneeId} onChange={(assigneeId) => updateIt(r.id, { assigneeId })} />
                </Td>
                {fees && (
                  <>
                    <Td label="Fee" className="tnum text-right text-ink-600">{inr(r.fee)}</Td>
                    <Td label="Received" className="text-right">
                      <Money value={r.received} onChange={(received) => updateIt(r.id, { received })} label="Fee received" />
                    </Td>
                  </>
                )}
                <Td label="Remark" className="col-span-full">
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
  const fees = useCan()('view_fees')
  const f = useFilters()
  const [kind, setKind] = useState<AuditFiling['kind'] | ''>('')
  const [status, setStatus] = useState<SimpleStatus | ''>('')
  const [recon, setRecon] = useState<'open' | 'done' | ''>('')
  const [owing, setOwing] = useState(false)
  const [notIn, setNotIn] = useState(false)
  // As with returns, an audit's fee falls due once it is signed off; what comes in earlier is an advance.
  const owed = (a: AuditFiling) => (isClosed(a.status) ? Math.max(0, a.fee - a.received) : 0)

  const rows = audits.filter(
    (a) =>
      f.match(a) &&
      (!kind || a.kind === kind) &&
      (!status || a.status === status) &&
      (!recon || a.reconciliation === (recon === 'done')) &&
      (!notIn || !a.dataIn) &&
      (!owing || (fees && owed(a) > 0)),
  )
  const feeBalance = rows.reduce((s, a) => s + owed(a), 0)
  const dirty = f.dirty || !!kind || !!status || !!recon || owing || notIn
  const clear = () => {
    f.reset()
    setKind('')
    setStatus('')
    setRecon('')
    setOwing(false)
    setNotIn(false)
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
        <label className="flex h-8 items-center gap-2 px-1 text-[13px] font-semibold text-ink-600">
          <Tick checked={notIn} onChange={setNotIn} label="Show only audits whose data is not in" />
          Data not in
        </label>
        {fees && (
          <label className="flex h-8 items-center gap-2 px-1 text-[13px] font-semibold text-ink-600">
            <Tick checked={owing} onChange={setOwing} label="Show only audits with a fee balance" />
            Fee balance
          </label>
        )}
      </FilterBar>
      <Summary
        items={[
          { label: 'Audits', value: rows.length },
          { label: 'Filed or completed', value: `${rows.filter((a) => isClosed(a.status)).length} / ${rows.length}` },
          { label: 'Reconciliation open', value: rows.filter((a) => !a.reconciliation).length, tone: 'amber' },
          { label: 'Data not in', value: rows.filter((a) => !a.dataIn).length, tone: 'red' },
          fees && { label: 'Fee balance', value: inr(feeBalance), tone: 'amber' },
        ]}
      />
      {rows.length === 0 ? (
        <NoMatch onClear={clear} />
      ) : (
        <TableShell
          minWidth={fees ? 1180 : 960}
          head={
            <>
              <Th>Client</Th>
              <Th>Audit</Th>
              <Th>Due</Th>
              <Th>Data in</Th>
              <Th align="center">Reconciled</Th>
              <Th>Status</Th>
              <Th>Assigned</Th>
              {fees && (
                <>
                  <Th align="right">Fee</Th>
                  <Th align="right">Received</Th>
                </>
              )}
              <Th>Remark</Th>
            </>
          }
          foot={fees && <Totals lead={7} trail={1} count={rows.length} fee={rows.reduce((s, a) => s + a.fee, 0)} received={rows.reduce((s, a) => s + a.received, 0)} balance={feeBalance} />}
        >
          {rows.map((a) => {
            const c = clients.get(a.clientId)
            const closed = isClosed(a.status)
            return (
              <tr key={a.id}>
                <Td>
                  <ClientCell client={c} sub={<>FY {a.fy}</>} />
                </Td>
                <Td label="Audit">
                  <Badge tone={a.kind === 'Internal audit' ? 'violet' : 'amber'}>{a.kind}</Badge>
                </Td>
                <Td label="Due" className="text-[13px]">
                  <Due date={a.dueDate} done={closed} compact={closed} />
                </Td>
                <Td label="Data in">
                  <DataIn value={a.dataIn} onChange={(dataIn) => updateAudit(a.id, { dataIn })} />
                </Td>
                <Td label="Reconciled">
                  <span className="flex justify-center">
                    <Tick checked={a.reconciliation} onChange={(reconciliation) => updateAudit(a.id, { reconciliation })} label="Reconciliation done" />
                  </span>
                </Td>
                <Td label="Status">
                  <StatusSelect label="Audit status" value={a.status} options={SIMPLE_ITEMS} onChange={(status) => updateAudit(a.id, { status })} />
                </Td>
                <Td label="Assigned">
                  <AssigneeSelect value={a.assigneeId} onChange={(assigneeId) => updateAudit(a.id, { assigneeId })} />
                </Td>
                {fees && (
                  <>
                    <Td label="Fee" className="tnum text-right text-ink-600">{inr(a.fee)}</Td>
                    <Td label="Received" className="text-right">
                      <Money value={a.received} onChange={(received) => updateAudit(a.id, { received })} label="Fee received" />
                    </Td>
                  </>
                )}
                <Td label="Remark" className="col-span-full">
                  <InlineText value={a.remark} onChange={(remark) => updateAudit(a.id, { remark })} />
                </Td>
              </tr>
            )
          })}
        </TableShell>
      )}
      <Footer shown={rows.length} total={audits.length} dirty={dirty} onClear={clear}>
        {fees ? 'The fee balance counts audits that are filed or completed; money received before that is an advance.' : 'Tax, statutory and internal audits for the financial year.'}
      </Footer>
    </Card>
  )
}

/* ---------- One-time services ---------- */

function ServiceForm({ onClose, clientId = '' }: { onClose: () => void; clientId?: string }) {
  const addService = useStore((s) => s.addService)
  const fees = useCan()('view_fees')
  const clients = useStore((s) => s.clients)
  const employees = useStore((s) => s.employees)
  const [f, setF] = useState({
    clientId,
    party: '',
    kind: SERVICE_KINDS[0] as ServiceKind,
    details: '',
    committedDate: addDays(todayISO(), 10),
    assigneeId: employees.find((e) => e.id === 'e-anna')?.id ?? employees[0].id,
    // Someone who cannot see fees leaves it at nothing; a head fills it in from the tracker.
    fee: fees ? 3000 : 0,
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
        {fees && (
          <Field label="Fee (₹)">
            <Input type="number" min={0} step={500} value={f.fee} onChange={(e) => setF({ ...f, fee: Math.max(0, Number(e.target.value) || 0) })} />
          </Field>
        )}
      </div>
    </Modal>
  )
}

function ServiceTracker() {
  const services = useStore((s) => s.services)
  const updateService = useStore((s) => s.updateService)
  const fees = useCan()('view_fees')
  const f = useFilters()
  const [adding, setAdding] = useState(false)
  const [kind, setKind] = useState<ServiceKind | ''>('')
  const [status, setStatus] = useState<SimpleStatus | ''>('')
  const [late, setLate] = useState(false)
  const [notIn, setNotIn] = useState(false)
  const today = todayISO()
  const overdue = (s: (typeof services)[number]) => s.status !== 'completed' && s.committedDate < today

  const rows = useMemo(
    () => [...services].sort((a, b) => Number(a.status === 'completed') - Number(b.status === 'completed') || a.committedDate.localeCompare(b.committedDate)),
    [services],
  ).filter(
    (s) =>
      f.match(s, `${s.party} ${s.kind} ${s.details ?? ''}`) &&
      (!kind || s.kind === kind) &&
      (!status || s.status === status) &&
      (!late || overdue(s)) &&
      (!notIn || (!s.dataIn && s.status !== 'completed')),
  )
  const open = rows.filter((s) => s.status !== 'completed')
  const feeBalance = rows.reduce((sum, s) => sum + Math.max(0, s.fee - s.received), 0)
  const dirty = f.dirty || !!kind || !!status || late || notIn
  const clear = () => {
    f.reset()
    setKind('')
    setStatus('')
    setLate(false)
    setNotIn(false)
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
        <label className="flex h-8 items-center gap-2 px-1 text-[13px] font-semibold text-ink-600">
          <Tick checked={notIn} onChange={setNotIn} label="Show only open jobs whose papers are not in" />
          Data not in
        </label>
        <Button size="sm" variant="primary" icon={<Plus size={15} />} onClick={() => setAdding(true)}>
          Add job
        </Button>
      </FilterBar>
      <Summary
        items={[
          { label: 'Open jobs', value: open.length },
          { label: 'Data not in', value: open.filter((s) => !s.dataIn).length, tone: 'amber' },
          { label: 'Past committed date', value: open.filter(overdue).length, tone: 'red' },
          { label: 'Completed', value: rows.length - open.length, tone: 'green' },
          fees && { label: 'Fee balance', value: inr(feeBalance), tone: 'amber' },
        ]}
      />
      {rows.length === 0 ? (
        f.client && !kind && !status && !late && !notIn && !f.q.trim() && !f.assignee ? (
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
          minWidth={fees ? 1140 : 920}
          head={
            <>
              <Th>Party</Th>
              <Th>Service</Th>
              <Th>Committed date</Th>
              <Th>Data in</Th>
              <Th>Status</Th>
              <Th>Assigned</Th>
              {fees && (
                <>
                  <Th align="right">Fee</Th>
                  <Th align="right">Received</Th>
                </>
              )}
              <Th>Remark</Th>
            </>
          }
          foot={fees && <Totals lead={6} trail={1} count={rows.length} fee={rows.reduce((sum, s) => sum + s.fee, 0)} received={rows.reduce((sum, s) => sum + s.received, 0)} balance={feeBalance} />}
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
              <Td label="Service">
                <Badge tone="green">{s.kind}</Badge>
                {s.details && <p className="mt-0.5 max-w-52 truncate text-xs text-ink-500" title={s.details}>{s.details}</p>}
              </Td>
              <Td label="Committed date" className="text-[13px]">
                <Due date={s.committedDate} done={s.status === 'completed'} />
              </Td>
              <Td label="Data in">
                <DataIn value={s.dataIn} onChange={(dataIn) => updateService(s.id, { dataIn })} />
              </Td>
              <Td label="Status">
                <StatusSelect label="Job status" value={s.status} options={SIMPLE_ITEMS} onChange={(status) => updateService(s.id, { status })} />
              </Td>
              <Td label="Assigned">
                <AssigneeSelect value={s.assigneeId} onChange={(assigneeId) => updateService(s.id, { assigneeId })} />
              </Td>
              {fees && (
                <>
                  {/* Editable here, since a job added by someone who cannot see fees comes in at nothing. */}
                  <Td label="Fee" className="text-right">
                    <Money value={s.fee} onChange={(fee) => updateService(s.id, { fee })} label="Fee" />
                  </Td>
                  <Td label="Received" className="text-right">
                    <Money value={s.received} onChange={(received) => updateService(s.id, { received })} label="Fee received" />
                  </Td>
                </>
              )}
              <Td label="Remark" className="col-span-full">
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

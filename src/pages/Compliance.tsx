import { Check, Plus } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { Due } from '../components/bits'
import { Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Segmented, Select, StatusSelect, Td, Th } from '../components/ui'
import { addDays, cn, currentGstPeriod, financialYear, inr, periodLabel, shiftPeriod, todayISO } from '../lib/format'
import { GST_STATUS, SERVICE_KINDS, SIMPLE_STATUS, options, type Tone } from '../lib/meta'
import { useStore } from '../store'
import type { Client, GstFiling, ItFiling, ServiceKind } from '../types'

type Tab = 'gst' | 'tds' | 'it' | 'audit' | 'services'

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

/* ---------- GST ---------- */

function GstTracker() {
  const gst = useStore((s) => s.gst)
  const updateGst = useStore((s) => s.updateGst)
  const clients = useClientMap()
  const current = currentGstPeriod()
  const periods = [shiftPeriod(current, -2), shiftPeriod(current, -1), current]
  const [period, setPeriod] = useState(current)
  const [pendingOnly, setPendingOnly] = useState(false)

  const all = useMemo(() => gst.filter((g) => g.period === period), [gst, period])
  const live = all.filter((g) => g.gstr1 !== 'na')
  const isDone = (s: GstFiling['gstr1']) => s === 'filed' || s === 'nil' || s === 'na'
  const rows = pendingOnly ? all.filter((g) => !isDone(g.gstr1) || !isDone(g.gstr3b)) : all
  const balance = (g: GstFiling) => g.prevBalance + g.fee - g.received
  const filed = (k: 'gstr1' | 'gstr3b') => live.filter((g) => g[k] === 'filed' || g[k] === 'nil').length

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 p-3">
        <Segmented value={period} onChange={setPeriod} items={periods.map((p) => ({ value: p, label: periodLabel(p, true) }))} />
        <label className="flex items-center gap-2 text-[13px] font-semibold text-ink-600">
          <Tick checked={pendingOnly} onChange={setPendingOnly} label="Show pending only" />
          Pending only
        </label>
      </div>
      <Summary
        items={[
          { label: 'GSTR-1 filed', value: `${filed('gstr1')} / ${live.length}` },
          { label: 'GSTR-3B filed', value: `${filed('gstr3b')} / ${live.length}` },
          { label: 'No data yet', value: live.filter((g) => g.gstr1 === 'data_pending').length, tone: live.some((g) => g.gstr1 === 'data_pending') ? 'red' : undefined },
          { label: 'Fee balance', value: inr(all.reduce((s, g) => s + Math.max(0, balance(g)), 0)), tone: 'amber' },
        ]}
      />
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
      <p className="border-t border-ink-100 px-5 py-2.5 text-xs text-ink-500">
        Statuses, fees received and remarks save as you change them.
      </p>
    </Card>
  )
}

/* ---------- TDS ---------- */

const PAYMENT = [
  { value: 'paid' as const, label: 'Paid', tone: 'green' as Tone },
  { value: 'due' as const, label: 'Due', tone: 'amber' as Tone },
  { value: 'na' as const, label: 'N/A', tone: 'neutral' as Tone },
]

function TdsTracker() {
  const tds = useStore((s) => s.tds)
  const updateTds = useStore((s) => s.updateTds)
  const clients = useClientMap()
  const fy = tds[0]?.fy ?? financialYear()
  const lastMonth = periodLabel(currentGstPeriod(), true)

  return (
    <Card>
      <Summary
        items={[
          { label: 'Deductors', value: tds.length },
          { label: `${lastMonth} payment due`, value: tds.filter((t) => t.payment === 'due').length, tone: 'amber' },
          { label: 'Q1 returns done', value: `${tds.filter((t) => t.quarters[0] === 'filed' || t.quarters[0] === 'completed').length} / ${tds.length}` },
          { label: 'Q2 returns done', value: `${tds.filter((t) => t.quarters[1] === 'filed' || t.quarters[1] === 'completed').length} / ${tds.length}` },
        ]}
      />
      <TableShell
        minWidth={960}
        head={
          <>
            <Th>Client</Th>
            <Th>{lastMonth} payment</Th>
            {[1, 2, 3, 4].map((q) => (
              <Th key={q}>Q{q} return</Th>
            ))}
            <Th>Assigned</Th>
            <Th>Remark</Th>
          </>
        }
      >
        {tds.map((t) => {
          const c = clients.get(t.clientId)
          return (
            <tr key={t.id}>
              <Td>
                <ClientCell client={c} sub={<>TAN {c?.tan}</>} />
              </Td>
              <Td>
                <StatusSelect label="TDS payment" value={t.payment} options={PAYMENT} onChange={(payment) => updateTds(t.id, { payment })} />
              </Td>
              {t.quarters.map((q, i) => (
                <Td key={i}>
                  <StatusSelect
                    label={`Q${i + 1} return`}
                    value={q}
                    options={options(SIMPLE_STATUS)}
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
      <p className="border-t border-ink-100 px-5 py-2.5 text-xs text-ink-500">
        FY {fy} · payment every month, return every quarter. Income tax and TRACES logins sit on each client's page.
      </p>
    </Card>
  )
}

/* ---------- Income tax ---------- */

function itDueDate(row: ItFiling, c?: Client): string {
  const y = row.ay.slice(0, 4)
  if (row.kind === 'audit') return `${y}-10-31`
  return c?.category === 'Proprietorship' ? `${y}-08-31` : `${y}-07-31`
}

function ItTracker() {
  const it = useStore((s) => s.it)
  const updateIt = useStore((s) => s.updateIt)
  const clients = useClientMap()
  const [kind, setKind] = useState<'all' | ItFiling['kind']>('all')
  const rows = kind === 'all' ? it : it.filter((r) => r.kind === kind)
  const done = (r: ItFiling) => r.status === 'filed' || r.status === 'completed'

  return (
    <Card>
      <div className="border-b border-ink-100 p-3">
        <Segmented
          value={kind}
          onChange={setKind}
          items={[
            { value: 'all', label: 'All', count: it.length },
            { value: 'non_audit', label: 'Non-audit', count: it.filter((r) => r.kind === 'non_audit').length },
            { value: 'audit', label: 'Audit cases', count: it.filter((r) => r.kind === 'audit').length },
          ]}
        />
      </div>
      <Summary
        items={[
          { label: 'Returns', value: rows.length },
          { label: 'Filed or completed', value: `${rows.filter(done).length} / ${rows.length}` },
          { label: 'Pending', value: rows.filter((r) => r.status === 'pending').length, tone: 'amber' },
          { label: 'Fee balance', value: inr(rows.reduce((s, r) => s + (done(r) ? Math.max(0, r.fee - r.received) : 0), 0)), tone: 'amber' },
        ]}
      />
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
                <StatusSelect label="Return status" value={r.status} options={options(SIMPLE_STATUS)} onChange={(status) => updateIt(r.id, { status })} />
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
      <p className="border-t border-ink-100 px-5 py-2.5 text-xs text-ink-500">
        AY {it[0]?.ay ?? financialYear()} · non-audit individuals 31 Jul, proprietorships 31 Aug, audit cases 31 Oct. The government may extend these dates.
      </p>
    </Card>
  )
}

/* ---------- Audit ---------- */

function AuditTracker() {
  const audits = useStore((s) => s.audits)
  const updateAudit = useStore((s) => s.updateAudit)
  const clients = useClientMap()
  const done = audits.filter((a) => a.status === 'filed' || a.status === 'completed').length

  return (
    <Card>
      <Summary
        items={[
          { label: 'Audits', value: audits.length },
          { label: 'Filed or completed', value: `${done} / ${audits.length}` },
          { label: 'Reconciliation open', value: audits.filter((a) => !a.reconciliation).length, tone: 'amber' },
          { label: 'Internal audits awaiting data', value: audits.filter((a) => a.kind === 'Internal audit' && !a.dataReceived).length },
        ]}
      />
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
        {audits.map((a) => {
          const c = clients.get(a.clientId)
          const closed = a.status === 'filed' || a.status === 'completed'
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
                <StatusSelect label="Audit status" value={a.status} options={options(SIMPLE_STATUS)} onChange={(status) => updateAudit(a.id, { status })} />
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
    </Card>
  )
}

/* ---------- One-time services ---------- */

function ServiceForm({ onClose }: { onClose: () => void }) {
  const addService = useStore((s) => s.addService)
  const clients = useStore((s) => s.clients)
  const employees = useStore((s) => s.employees)
  const [f, setF] = useState({
    clientId: '',
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
  const [adding, setAdding] = useState(false)
  const rows = useMemo(() => [...services].sort((a, b) => Number(a.status === 'completed') - Number(b.status === 'completed') || a.committedDate.localeCompare(b.committedDate)), [services])
  const open = services.filter((s) => s.status !== 'completed')

  return (
    <Card>
      <div className="flex items-center justify-between gap-2 border-b border-ink-100 p-3">
        <p className="px-2 text-[13px] text-ink-500">Registrations, incorporations, trademark, FSSAI, DSC, legal metrology, certifications, PAN and TAN applications</p>
        <Button size="sm" variant="primary" icon={<Plus size={15} />} onClick={() => setAdding(true)}>
          Add job
        </Button>
      </div>
      <Summary
        items={[
          { label: 'Open jobs', value: open.length },
          { label: 'Past committed date', value: open.filter((s) => s.committedDate < todayISO()).length, tone: 'red' },
          { label: 'Completed', value: services.length - open.length, tone: 'green' },
          { label: 'Fee balance', value: inr(services.reduce((sum, s) => sum + Math.max(0, s.fee - s.received), 0)), tone: 'amber' },
        ]}
      />
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
              <StatusSelect label="Job status" value={s.status} options={options(SIMPLE_STATUS)} onChange={(status) => updateService(s.id, { status })} />
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
      {adding && <ServiceForm onClose={() => setAdding(false)} />}
    </Card>
  )
}

/* ---------- Page ---------- */

const PAGES: Record<Tab, { title: string; subtitle: string; body: () => ReactNode }> = {
  gst: { title: 'GST filing', subtitle: 'Monthly · GSTR-1 by the 11th and GSTR-3B by the 20th, staff cut-off a day earlier.', body: () => <GstTracker /> },
  tds: { title: 'TDS', subtitle: 'Payment every month, return every quarter.', body: () => <TdsTracker /> },
  it: { title: 'Income tax', subtitle: 'Yearly returns, audit and non-audit cases.', body: () => <ItTracker /> },
  audit: { title: 'Audit', subtitle: 'Tax, statutory and internal audits with reconciliation.', body: () => <AuditTracker /> },
  services: { title: 'One-time work', subtitle: 'Jobs with a date committed to the customer.', body: () => <ServiceTracker /> },
}

export default function Compliance() {
  const { tab } = useParams()
  const page = PAGES[tab as Tab]
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

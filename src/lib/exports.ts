/**
 * What each Excel export holds: the client list, portal logins, the five filing trackers, tasks and leads.
 * Screens pass in the rows they are showing, so an export matches the filters on screen.
 */
import { useMemo } from 'react'
import { can, useCurrentUser, useScopes, useStore } from '../store'
import type { AuditFiling, Client, GstFiling, ItFiling, Lead, ServiceJob, Task, TdsFiling } from '../types'
import { periodLabel, shiftPeriod, todayISO } from './format'
import { DEPARTMENTS, GST_DATA_TYPES, GST_STATUS, LEAD_STATUS, PORTALS, PRIORITIES, SIMPLE_STATUS, TASK_STATUS } from './meta'
import { saveFile, workbook, type Column, type Sheet } from './xlsx'

export const balanceOf = (c: Client) => c.transactions.reduce((sum, x) => sum + (x.kind === 'charge' ? x.amount : -x.amount), 0)

/** Clients this one is linked with, whichever side made the link. */
export function associatesOf(client: Client, clients: Client[]): Client[] {
  const ids = new Set(client.associates ?? [])
  return clients.filter((c) => c.id !== client.id && (ids.has(c.id) || c.associates?.includes(client.id)))
}

/** Names and labels the sheets need, and what the person exporting may see. */
export function useExportContext() {
  const me = useCurrentUser()
  const clients = useStore((s) => s.clients)
  const employees = useStore((s) => s.employees)
  const scopes = useScopes()
  return useMemo(() => {
    const byId = new Map(clients.map((c) => [c.id, c]))
    const names = new Map(employees.map((e) => [e.id, e.name]))
    return {
      clients,
      client: (id?: string) => (id ? byId.get(id) : undefined),
      person: (id?: string) => (id ? names.get(id) : undefined),
      scopeLabel: scopes.label,
      fees: can(me, 'view_fees'),
      logins: can(me, 'view_logins'),
    }
  }, [me, clients, employees, scopes])
}

export type ExportContext = ReturnType<typeof useExportContext>

const money = <T,>(header: string, value: (r: T) => number): Column<T> => ({ header, type: 'money', value })

/** Fee, received and balance, for those allowed to see fees. */
function feeColumns<T extends { fee: number; received: number }>(x: ExportContext, prev?: (r: T) => number): Column<T>[] {
  if (!x.fees) return []
  return [
    ...(prev ? [money<T>('Previous balance', prev)] : []),
    money<T>('Fee', (r) => r.fee),
    money<T>('Received', (r) => r.received),
    money<T>('Balance', (r) => (prev?.(r) ?? 0) + r.fee - r.received),
  ]
}

function clientColumns<T>(x: ExportContext, id: (r: T) => string | undefined): Column<T>[] {
  return [
    { header: 'Code', value: (r) => x.client(id(r))?.code },
    { header: 'Client', value: (r) => x.client(id(r))?.name },
  ]
}

/* ---------- Clients ---------- */

export function clientSheet(x: ExportContext, rows: Client[]): Sheet<Client> {
  return {
    name: 'Clients',
    rows,
    columns: [
      { header: 'Code', value: (c) => c.code },
      { header: 'Client', value: (c) => c.name },
      { header: 'Category', value: (c) => c.category },
      { header: 'Contact person', value: (c) => c.contactPerson },
      { header: 'Business / profession', value: (c) => c.profession ?? c.business },
      { header: 'Place', value: (c) => c.place },
      { header: 'Phone', value: (c) => c.phone },
      { header: 'WhatsApp', value: (c) => c.whatsapp },
      { header: 'Email', value: (c) => c.email },
      { header: 'PAN', value: (c) => c.pan },
      { header: 'GSTIN', value: (c) => c.gstin },
      { header: 'GST returns', value: (c) => (c.gstin || c.scopes.includes('gst_filing') ? (c.gstFrequency === 'Q' ? 'Quarterly' : 'Monthly') : undefined) },
      { header: 'TAN', value: (c) => c.tan },
      { header: 'Scope of work', value: (c) => c.scopes.map((k) => x.scopeLabel(k) + (c.scopeDetails?.[k] ? ` (${c.scopeDetails[k]})` : '')).join(', ') },
      { header: 'In association with', value: (c) => associatesOf(c, x.clients).map((a) => `${a.name} (${a.code})`).join(', ') },
      { header: 'Status', value: (c) => (c.active ? 'Active' : 'Inactive') },
      { header: 'Client since', type: 'date', value: (c) => c.since },
      ...(x.fees ? [money<Client>('Fee balance', balanceOf)] : []),
    ],
  }
}

interface LoginRow {
  client: Client
  portal: string
  username: string
  password: string
}

/** One row per portal login. Only for those allowed to see passwords; the screens hold to that. */
export function loginSheet(x: ExportContext, clients: Client[]): Sheet<LoginRow> {
  const rows = clients.flatMap((client) => client.credentials.map((l) => ({ client, portal: PORTALS[l.portal]?.label ?? l.portal, username: l.username, password: x.logins ? l.password : '' })))
  return {
    name: 'Portal logins',
    rows,
    columns: [
      { header: 'Code', value: (r) => r.client.code },
      { header: 'Client', value: (r) => r.client.name },
      { header: 'Portal', value: (r) => r.portal },
      { header: 'Username', value: (r) => r.username },
      ...(x.logins ? [{ header: 'Password', value: (r: LoginRow) => r.password }] : []),
      { header: 'PAN', value: (r) => r.client.pan },
      { header: 'GSTIN', value: (r) => r.client.gstin },
      { header: 'TAN', value: (r) => r.client.tan },
      { header: 'Status', value: (r) => (r.client.active ? 'Active' : 'Inactive') },
    ],
  }
}

/* ---------- Filing trackers ---------- */

const gstLabel = (s: GstFiling['gstr1']) => GST_STATUS[s]?.label ?? s
const dataType = (t?: GstFiling['dataType']) => GST_DATA_TYPES.find((d) => d.value === t)?.label

export function gstSheet(x: ExportContext, rows: GstFiling[]): Sheet<GstFiling> {
  return {
    name: 'GST',
    rows,
    columns: [
      { header: 'Period', value: (g) => periodLabel(g.period) },
      ...clientColumns<GstFiling>(x, (g) => g.clientId),
      { header: 'GSTIN', value: (g) => x.client(g.clientId)?.gstin },
      { header: 'Returns', value: (g) => (x.client(g.clientId)?.gstFrequency === 'Q' ? 'Quarterly' : 'Monthly') },
      { header: 'Data type', value: (g) => dataType(g.dataType) },
      { header: 'Data in', type: 'date', value: (g) => g.dataIn },
      { header: 'Last reminded', type: 'date', value: (g) => g.dataReminded?.at(-1) },
      { header: 'GSTR-1', value: (g) => gstLabel(g.gstr1) },
      { header: 'GSTR-3B', value: (g) => gstLabel(g.gstr3b) },
      { header: 'Assigned to', value: (g) => x.person(g.assigneeId) },
      ...feeColumns<GstFiling>(x, (g) => g.prevBalance),
      { header: 'Remark', value: (g) => g.remark },
    ],
  }
}

export function tdsSheet(x: ExportContext, rows: TdsFiling[], fy: string): Sheet<TdsFiling> {
  const start = Number(fy.slice(0, 4))
  const months = Array.from({ length: 12 }, (_, i) => shiftPeriod(`${start}-04`, i))
  const payment = { paid: 'Paid', due: 'Due', na: 'N/A' }
  const today = todayISO().slice(0, 7)
  return {
    name: `TDS ${fy}`,
    rows,
    columns: [
      { header: 'FY', value: (t) => t.fy },
      ...clientColumns<TdsFiling>(x, (t) => t.clientId),
      { header: 'TAN', value: (t) => x.client(t.clientId)?.tan },
      // Months still to come are left blank rather than shown as due.
      ...months.map<Column<TdsFiling>>((m) => ({ header: periodLabel(m, true), width: 8, value: (t) => (t.payments[m] ? payment[t.payments[m]] : m < today ? 'Due' : '') })),
      ...[0, 1, 2, 3].map<Column<TdsFiling>>((q) => ({ header: `Q${q + 1} return`, value: (t) => SIMPLE_STATUS[t.quarters[q]]?.label })),
      { header: 'Assigned to', value: (t) => x.person(t.assigneeId) },
      ...feeColumns<TdsFiling>(x),
      { header: 'Remark', value: (t) => t.remark },
    ],
  }
}

export function itSheet(x: ExportContext, rows: ItFiling[]): Sheet<ItFiling> {
  return {
    name: 'Income tax',
    rows,
    columns: [
      { header: 'AY', value: (r) => r.ay },
      ...clientColumns<ItFiling>(x, (r) => r.clientId),
      { header: 'PAN', value: (r) => x.client(r.clientId)?.pan },
      { header: 'Case', value: (r) => (r.kind === 'audit' ? 'Audit' : 'Non-audit') },
      { header: 'Status', value: (r) => SIMPLE_STATUS[r.status]?.label },
      { header: 'Data in', type: 'date', value: (r) => r.dataIn },
      { header: 'Filed on', type: 'date', value: (r) => r.doneOn },
      { header: 'Assigned to', value: (r) => x.person(r.assigneeId) },
      ...feeColumns<ItFiling>(x),
      { header: 'Remark', value: (r) => r.remark },
    ],
  }
}

export function auditSheet(x: ExportContext, rows: AuditFiling[]): Sheet<AuditFiling> {
  return {
    name: 'Audit',
    rows,
    columns: [
      { header: 'FY', value: (a) => a.fy },
      ...clientColumns<AuditFiling>(x, (a) => a.clientId),
      { header: 'Audit', value: (a) => a.kind },
      { header: 'Status', value: (a) => SIMPLE_STATUS[a.status]?.label },
      { header: 'Reconciliation', value: (a) => (a.reconciliation ? 'Done' : 'Open') },
      { header: 'Data in', type: 'date', value: (a) => a.dataIn },
      { header: 'Due', type: 'date', value: (a) => a.dueDate },
      { header: 'Done on', type: 'date', value: (a) => a.doneOn },
      { header: 'Assigned to', value: (a) => x.person(a.assigneeId) },
      ...feeColumns<AuditFiling>(x),
      { header: 'Remark', value: (a) => a.remark },
    ],
  }
}

export function serviceSheet(x: ExportContext, rows: ServiceJob[]): Sheet<ServiceJob> {
  return {
    name: 'One-time work',
    rows,
    columns: [
      { header: 'Code', value: (s) => x.client(s.clientId)?.code },
      { header: 'Party', value: (s) => x.client(s.clientId)?.name ?? s.party },
      { header: 'Work', value: (s) => s.kind },
      { header: 'Details', value: (s) => s.details },
      { header: 'Status', value: (s) => SIMPLE_STATUS[s.status]?.label },
      { header: 'Committed date', type: 'date', value: (s) => s.committedDate },
      { header: 'Data in', type: 'date', value: (s) => s.dataIn },
      { header: 'Done on', type: 'date', value: (s) => s.doneOn },
      { header: 'Assigned to', value: (s) => x.person(s.assigneeId) },
      ...feeColumns<ServiceJob>(x),
      { header: 'Remark', value: (s) => s.remark },
    ],
  }
}

/* ---------- Tasks and leads (for the full workbook) ---------- */

export function taskSheet(x: ExportContext, rows: Task[]): Sheet<Task> {
  return {
    name: 'Tasks',
    rows,
    columns: [
      { header: 'Task', value: (t) => t.title },
      { header: 'Client', value: (t) => x.client(t.clientId)?.name ?? 'Internal' },
      { header: 'Work head', value: (t) => DEPARTMENTS[t.department]?.label },
      { header: 'Assigned to', value: (t) => x.person(t.assigneeId) },
      { header: 'Assigned by', value: (t) => x.person(t.assignedById) },
      { header: 'Priority', value: (t) => PRIORITIES[t.priority]?.label },
      { header: 'Status', value: (t) => TASK_STATUS[t.status]?.label },
      { header: 'Progress %', type: 'number', value: (t) => t.progress },
      { header: 'Due', type: 'date', value: (t) => t.dueDate },
      { header: 'Repeats', value: (t) => t.recurring },
      { header: 'Created', type: 'date', value: (t) => t.createdAt },
      { header: 'Description', value: (t) => t.description },
    ],
  }
}

export function leadSheet(x: ExportContext, rows: Lead[]): Sheet<Lead> {
  return {
    name: 'Leads',
    rows,
    columns: [
      { header: 'Name', value: (l) => l.name },
      { header: 'Contact', value: (l) => l.contact },
      { header: 'Phone', value: (l) => l.phone },
      { header: 'WhatsApp', value: (l) => l.whatsapp },
      { header: 'Place', value: (l) => l.place },
      { header: 'Source', value: (l) => l.source },
      { header: 'Category', value: (l) => l.category },
      { header: 'Enquired about', value: (l) => l.scopes.map(x.scopeLabel).join(', ') },
      { header: 'Status', value: (l) => LEAD_STATUS[l.status]?.label },
      { header: 'Owner', value: (l) => x.person(l.ownerId) },
      { header: 'Next follow-up', type: 'date', value: (l) => l.nextFollowUp },
      { header: 'Created', type: 'date', value: (l) => l.createdAt },
      { header: 'Latest remark', value: (l) => l.remarks.at(-1)?.text },
    ],
  }
}

export function downloadSheets(filename: string, sheets: Sheet<any>[]) {
  saveFile(workbook(sheets), `${filename} ${todayISO()}.xlsx`)
}

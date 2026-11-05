import type { AuditFiling, Client, Department, Employee, GstFiling, ItFiling, Task, TdsFiling } from '../types'
import { financialYear, shiftPeriod, todayISO } from './format'

/**
 * The rows a client's scopes of work call for in the GST, TDS, income tax and audit trackers. Every active client
 * with the scope gets a row for the period being worked on now, so adding a client, ticking a scope, or a new month
 * or year beginning is enough for the work to show up in its tracker. Rows are never removed when a scope is: they
 * are the work history.
 *
 * Ids are worked out from the client and the period, so two people opening the app at once make the same row, and
 * the database keeps whichever arrives first (see lib/sync.ts).
 */
export interface NewRows {
  gst: GstFiling[]
  tds: TdsFiling[]
  it: ItFiling[]
  audits: AuditFiling[]
}

interface Sources {
  clients: Client[]
  employees: Employee[]
  tasks: Task[]
  gst: GstFiling[]
  tds: TdsFiling[]
  it: ItFiling[]
  audits: AuditFiling[]
  currentUserId: string
}

/** What decides, for a client without earlier rows, who the work goes to. */
const WORK: Record<'gst' | 'tds' | 'it' | 'audit', { department: Department; duty: string }> = {
  gst: { department: 'gst', duty: 'gst filing' },
  tds: { department: 'tds', duty: 'tds filing' },
  it: { department: 'it', duty: 'it filing' },
  audit: { department: 'audit', duty: 'audit head' },
}

/** How many past months of GST a client with older rows is caught up on, when nobody opened the app for a while. */
const GST_CATCH_UP = 3

/** Which year a period's rows belong to. GST goes by return month, TDS by the month being deposited, the rest by today. */
export function trackerYears(today = todayISO()) {
  // As currentGstPeriod: the return being worked on is last month's.
  const period = shiftPeriod(today.slice(0, 7), -1)
  const fy = financialYear(today)
  const y = Number(fy.slice(0, 4))
  return {
    gstPeriod: period,
    tdsFy: financialYear(`${period}-01`),
    // The return filed this year is for last year's income, and is named by this year.
    itAy: fy,
    // Audits done this year are of last year's accounts.
    auditFy: `${y - 1}-${String(y).slice(2)}`,
    taxAuditDue: `${y}-09-30`,
    internalAuditDue: `${y}-10-31`,
  }
}

const latest = <T>(rows: T[], key: (r: T) => string): T | undefined => rows.reduce<T | undefined>((a, r) => (!a || key(r) > key(a) ? r : a), undefined)

function byClient<T extends { clientId?: string }>(rows: T[]): (clientId: string) => T[] {
  const map = new Map<string, T[]>()
  for (const r of rows) {
    if (!r.clientId) continue
    const list = map.get(r.clientId)
    if (list) list.push(r)
    else map.set(r.clientId, [r])
  }
  return (clientId) => map.get(clientId) ?? []
}

export function missingTrackerRows(src: Sources, today = todayISO()): NewRows {
  const out: NewRows = { gst: [], tds: [], it: [], audits: [] }
  const y = trackerYears(today)
  const active = new Set(src.employees.filter((e) => e.active).map((e) => e.id))
  const gstOf = byClient(src.gst)
  const tdsOf = byClient(src.tds)
  const itOf = byClient(src.it)
  const auditsOf = byClient(src.audits)
  const tasksOf = byClient(src.tasks)

  /** Whoever did it last time; else whoever has the client's open task in that department; else the person in charge of it. */
  const assignee = (work: keyof typeof WORK, clientId: string, last?: { assigneeId: string }) => {
    if (last && active.has(last.assigneeId)) return last.assigneeId
    const { department, duty } = WORK[work]
    const task = latest(
      tasksOf(clientId).filter((t) => t.department === department && active.has(t.assigneeId)),
      (t) => `${t.status === 'completed' ? 0 : 1}${t.createdAt}`,
    )
    if (task) return task.assigneeId
    const doers = src.employees.filter((e) => e.active && e.responsibilities.some((r) => r.toLowerCase().includes(duty)))
    const lead = doers.find((e) => e.role !== 'trainee' && e.role !== 'staff') ?? doers[0]
    return lead?.id ?? src.currentUserId
  }

  for (const c of src.clients) {
    if (!c.active) continue
    const has = (k: string) => c.scopes.includes(k)

    if (has('gst_filing')) {
      let prev = latest(gstOf(c.id), (g) => g.period)
      if (!prev || prev.period < y.gstPeriod) {
        const earliest = shiftPeriod(y.gstPeriod, 1 - GST_CATCH_UP)
        const from = prev && shiftPeriod(prev.period, 1) > earliest ? shiftPeriod(prev.period, 1) : prev ? earliest : y.gstPeriod
        for (let period = from; period <= y.gstPeriod; period = shiftPeriod(period, 1)) {
          const row: GstFiling = {
            id: `g-${c.id}-${period}`,
            clientId: c.id,
            period,
            // Most clients send the same kind of data every month, and pay the same fee.
            dataType: prev?.dataType,
            gstr1: 'to_begin',
            gstr3b: 'to_begin',
            assigneeId: assignee('gst', c.id, prev),
            prevBalance: prev ? prev.prevBalance + prev.fee - prev.received : 0,
            fee: prev?.fee ?? 0,
            received: 0,
            remark: '',
          }
          out.gst.push(row)
          prev = row
        }
      }
    }

    if (has('tds') && !tdsOf(c.id).some((t) => t.fy === y.tdsFy)) {
      const last = latest(tdsOf(c.id), (t) => t.fy)
      out.tds.push({
        id: `tds-${c.id}-${y.tdsFy}`,
        clientId: c.id,
        fy: y.tdsFy,
        payments: {},
        quarters: ['to_begin', 'to_begin', 'to_begin', 'to_begin'],
        dataIn: {},
        assigneeId: assignee('tds', c.id, last),
        // The TDS fee is what has been billed in the year so far.
        fee: 0,
        received: 0,
        remark: '',
      })
    }

    if ((has('it_audit') || has('it_non_audit')) && !itOf(c.id).some((r) => r.ay === y.itAy)) {
      const kind = has('it_audit') ? 'audit' : 'non_audit'
      const last = latest(itOf(c.id), (r) => r.ay)
      out.it.push({
        id: `it-${c.id}-${y.itAy}`,
        clientId: c.id,
        ay: y.itAy,
        kind,
        status: 'to_begin',
        assigneeId: assignee('it', c.id, last),
        fee: last?.kind === kind ? last.fee : 0,
        received: 0,
        remark: '',
      })
    }

    const audits = auditsOf(c.id)
    const audit = (id: string, kind: AuditFiling['kind'], dueDate: string, last?: AuditFiling) =>
      out.audits.push({
        id,
        clientId: c.id,
        fy: y.auditFy,
        kind,
        status: 'to_begin',
        reconciliation: false,
        assigneeId: assignee('audit', c.id, last),
        dueDate,
        fee: last?.fee ?? 0,
        received: 0,
        remark: '',
      })
    const external = audits.filter((a) => a.kind !== 'Internal audit')
    if (has('it_audit') && !external.some((a) => a.fy === y.auditFy)) {
      const last = latest(external, (a) => a.fy)
      audit(`au-${c.id}-${y.auditFy}`, last?.kind ?? (c.category === 'Company' ? 'Statutory audit' : 'Tax audit'), y.taxAuditDue, last)
    }
    const internal = audits.filter((a) => a.kind === 'Internal audit')
    if (has('internal_audit') && !internal.some((a) => a.fy === y.auditFy))
      audit(`ia-${c.id}-${y.auditFy}`, 'Internal audit', y.internalAuditDue, latest(internal, (a) => a.fy))
  }
  return out
}

export const hasNewRows = (r: NewRows) => r.gst.length + r.tds.length + r.it.length + r.audits.length > 0

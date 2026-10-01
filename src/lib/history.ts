import type { AuditFiling, Client, Department, GstFiling, ItFiling, ServiceJob, Task, TdsFiling } from '../types'
import { itDueDate } from './deadlines'
import { fmtDate, periodLabel, todayISO } from './format'
import { GST_STATUS, SIMPLE_STATUS, TASK_STATUS, type Tone } from './meta'

/** One piece of work done, or being done: a return, a payment, a one-time job or a task. */
export interface WorkEntry {
  key: string
  /** YYYY-MM the work belongs to: the return period, or the month it was finished or falls due. */
  month: string
  dept: Department
  title: string
  detail: string
  status: { label: string; tone: Tone }
  done: boolean
  assigneeId?: string
  clientId?: string
  /** Who the work is for: the client, or the party of a one-time job taken before they became one. Empty for internal tasks. */
  party: string
  /** Where to open it. */
  to: string
}

interface Sources {
  gst: GstFiling[]
  tds: TdsFiling[]
  it: ItFiling[]
  audits: AuditFiling[]
  services: ServiceJob[]
  tasks: Task[]
}

const TDS_PAYMENT: Record<TdsFiling['payments'][string], WorkEntry['status']> = {
  paid: { label: 'Paid', tone: 'green' },
  due: { label: 'Due', tone: 'amber' },
  na: { label: 'N/A', tone: 'neutral' },
}

const closed = (s: ItFiling['status']) => s === 'filed' || s === 'completed'

/**
 * Everything on record across the trackers and tasks, newest month first.
 * A client's page keeps the entries for that client; a person's page keeps the ones assigned to them.
 */
export function workEntries(src: Sources, clients: Client[]): WorkEntry[] {
  const out: WorkEntry[] = []
  const thisMonth = todayISO().slice(0, 7)
  const byId = new Map(clients.map((c) => [c.id, c]))
  const party = (clientId?: string) => byId.get(clientId ?? '')?.name ?? ''
  const tracker = (tab: string, clientId?: string) => (clientId ? `/filings/${tab}?client=${clientId}` : `/filings/${tab}`)

  for (const g of src.gst) {
    if (g.gstr1 === 'na') continue
    for (const k of ['gstr1', 'gstr3b'] as const) {
      const status = g[k]
      out.push({
        key: `${g.id}-${k}`,
        month: g.period,
        dept: 'gst',
        title: k === 'gstr1' ? 'GSTR-1' : 'GSTR-3B',
        detail: `Return for ${periodLabel(g.period, true)}`,
        status: GST_STATUS[status],
        done: status === 'filed' || status === 'nil',
        assigneeId: g.assigneeId,
        clientId: g.clientId,
        party: party(g.clientId),
        to: tracker('gst', g.clientId),
      })
    }
  }

  for (const t of src.tds) {
    const who = { assigneeId: t.assigneeId, clientId: t.clientId, party: party(t.clientId), to: tracker('tds', t.clientId) }
    for (const [month, payment] of Object.entries(t.payments)) {
      if (payment === 'na') continue
      out.push({
        key: `${t.id}-pay-${month}`,
        month,
        dept: 'tds',
        title: 'TDS payment',
        detail: `Deposit for ${periodLabel(month, true)}`,
        status: TDS_PAYMENT[payment],
        done: payment === 'paid',
        ...who,
      })
    }
    // Q1 closes in June, Q2 in September, Q3 in December, Q4 in March of the next year.
    const y = Number(t.fy.slice(0, 4))
    const ends = [`${y}-06`, `${y}-09`, `${y}-12`, `${y + 1}-03`]
    t.quarters.forEach((q, n) => {
      if (q === 'to_begin' && ends[n] > thisMonth) return
      out.push({
        key: `${t.id}-q${n}`,
        month: ends[n],
        dept: 'tds',
        title: `TDS return Q${n + 1}`,
        detail: `FY ${t.fy}`,
        status: SIMPLE_STATUS[q],
        done: closed(q),
        ...who,
      })
    })
  }

  for (const r of src.it) {
    const due = itDueDate(r, byId.get(r.clientId))
    out.push({
      key: r.id,
      month: (r.doneOn ?? due).slice(0, 7),
      dept: 'it',
      title: `Income tax return · ${r.kind === 'audit' ? 'audit case' : 'non-audit'}`,
      detail: r.doneOn ? `AY ${r.ay} · done ${fmtDate(r.doneOn)}` : `AY ${r.ay} · due ${fmtDate(due)}`,
      status: SIMPLE_STATUS[r.status],
      done: closed(r.status),
      assigneeId: r.assigneeId,
      clientId: r.clientId,
      party: party(r.clientId),
      to: tracker('it', r.clientId),
    })
  }

  for (const a of src.audits) {
    out.push({
      key: a.id,
      month: (a.doneOn ?? a.dueDate).slice(0, 7),
      dept: 'audit',
      title: a.kind,
      detail: a.doneOn ? `FY ${a.fy} · done ${fmtDate(a.doneOn)}` : `FY ${a.fy} · due ${fmtDate(a.dueDate)}`,
      status: SIMPLE_STATUS[a.status],
      done: closed(a.status),
      assigneeId: a.assigneeId,
      clientId: a.clientId,
      party: party(a.clientId),
      to: tracker('audit', a.clientId),
    })
  }

  for (const s of src.services) {
    const when = s.doneOn ? `done ${fmtDate(s.doneOn)}` : `committed for ${fmtDate(s.committedDate)}`
    out.push({
      key: s.id,
      month: (s.doneOn ?? s.committedDate).slice(0, 7),
      dept: 'registration',
      title: s.kind,
      detail: s.details ? `${s.details} · ${when}` : when,
      status: SIMPLE_STATUS[s.status],
      done: closed(s.status),
      assigneeId: s.assigneeId,
      clientId: s.clientId,
      party: s.party,
      to: tracker('services', s.clientId),
    })
  }

  for (const t of src.tasks) {
    out.push({
      key: t.id,
      month: t.dueDate.slice(0, 7),
      dept: t.department,
      title: t.title,
      detail: `Task · due ${fmtDate(t.dueDate)}`,
      status: TASK_STATUS[t.status],
      done: t.status === 'completed',
      assigneeId: t.assigneeId,
      clientId: t.clientId,
      party: party(t.clientId),
      to: `/tasks?open=${t.id}`,
    })
  }

  return out.sort((a, b) => b.month.localeCompare(a.month) || a.dept.localeCompare(b.dept) || a.title.localeCompare(b.title) || a.party.localeCompare(b.party))
}

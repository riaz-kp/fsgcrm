import type { AuditFiling, Client, GstFiling, GstStatus, ItFiling, ServiceJob, SimpleStatus, TdsFiling, TdsPayment } from '../types'
import { currentGstPeriod, fmtDate, inr, periodLabel, todayISO } from './format'
import { FIRM_NAME } from './meta'

/** One line of a work-status message, as the client will read it. */
export interface StatusLine {
  key: string
  text: string
  /** Ticked when the composer opens: what is current, not what was finished long ago. */
  on: boolean
}

interface Sources {
  gst: GstFiling[]
  tds: TdsFiling[]
  it: ItFiling[]
  audits: AuditFiling[]
  services: ServiceJob[]
}

// The trackers' shorthand, in words a client would use.
const GST_WORDS: Record<GstStatus, string> = {
  to_begin: 'not started yet',
  data_pending: 'waiting for your data',
  in_progress: 'in progress',
  filed: 'filed',
  nil: 'nil return filed',
  na: 'not applicable',
}

const SIMPLE_WORDS: Record<SimpleStatus, string> = {
  to_begin: 'not started yet',
  pending: 'pending',
  filed: 'filed',
  completed: 'completed',
}

const PAYMENT_WORDS: Record<TdsPayment, string> = { paid: 'paid', due: 'not paid yet', na: 'not applicable' }

const closed = (s: SimpleStatus) => s === 'filed' || s === 'completed'

/** Where each piece of this client's work stands today, one line each. */
export function statusLines(client: Client, src: Sources): StatusLine[] {
  const out: StatusLine[] = []
  const period = currentGstPeriod()
  const thisMonth = todayISO().slice(0, 7)

  const g = src.gst.find((x) => x.clientId === client.id && x.period === period)
  if (g && g.gstr1 !== 'na') {
    out.push({ key: 'gstr1', text: `GSTR-1 for ${periodLabel(period)}: ${GST_WORDS[g.gstr1]}`, on: true })
    out.push({ key: 'gstr3b', text: `GSTR-3B for ${periodLabel(period)}: ${GST_WORDS[g.gstr3b]}`, on: true })
  }

  const t = src.tds.find((x) => x.clientId === client.id)
  if (t) {
    const payment = t.payments[period] ?? 'due'
    if (payment !== 'na') out.push({ key: 'tds-pay', text: `TDS payment for ${periodLabel(period)}: ${PAYMENT_WORDS[payment]}`, on: true })
    // Q1 closes in June, Q2 in September, Q3 in December, Q4 in March of the next year.
    const y = Number(t.fy.slice(0, 4))
    const ends = [`${y}-06`, `${y}-09`, `${y}-12`, `${y + 1}-03`]
    const started = t.quarters.map((q, n) => q !== 'to_begin' || ends[n] <= thisMonth)
    const latest = started.lastIndexOf(true)
    t.quarters.forEach((q, n) => {
      if (!started[n]) return
      // Returns finished in earlier quarters are old news unless someone asks for them.
      out.push({ key: `tds-q${n}`, text: `TDS return for Q${n + 1} (FY ${t.fy}): ${SIMPLE_WORDS[q]}`, on: n === latest || !closed(q) })
    })
  }

  const r = src.it.find((x) => x.clientId === client.id)
  if (r) out.push({ key: 'it', text: `Income tax return for AY ${r.ay}: ${SIMPLE_WORDS[r.status]}`, on: true })

  for (const a of src.audits) {
    if (a.clientId === client.id) out.push({ key: a.id, text: `${a.kind} for FY ${a.fy}: ${SIMPLE_WORDS[a.status]}`, on: true })
  }

  for (const s of src.services) {
    if (s.clientId !== client.id) continue
    const what = s.details ? `${s.kind} (${s.details})` : s.kind
    const by = s.status !== 'completed' && s.committedDate >= todayISO() ? `, expected by ${fmtDate(s.committedDate)}` : ''
    out.push({ key: s.id, text: `${what}: ${SIMPLE_WORDS[s.status]}${by}`, on: s.status !== 'completed' })
  }

  // Asking for money is a choice, so the balance is offered but left unticked.
  const due = client.transactions.reduce((sum, x) => sum + (x.kind === 'charge' ? x.amount : -x.amount), 0)
  if (due > 0) out.push({ key: 'fees', text: `Fee balance as of today: ${inr(due)}`, on: false })

  return out
}

/** The message the lines add up to. It is a draft: whoever sends it reads and adjusts it first. */
export function statusMessage(client: Client, lines: StatusLine[], from: string): string {
  const person = client.category === 'Individual'
  return [
    person ? `Dear ${client.name},` : 'Dear Sir/Madam,',
    '',
    `${person ? 'Status of your work with us' : `Status of the work for ${client.name}`} as on ${fmtDate(todayISO(), true)}:`,
    '',
    ...lines.map((l) => `• ${l.text}`),
    '',
    'Please let us know if you need anything further.',
    '',
    'Regards,',
    from,
    FIRM_NAME,
  ].join('\n')
}

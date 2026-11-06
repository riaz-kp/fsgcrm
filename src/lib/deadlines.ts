import type { Client, Department, ScopeDef, ScopeKey } from '../types'
import { addDays, periodLabel, shiftPeriod, toISO } from './format'

/** Deadline id -> the date it has been moved to, from every scope's changed dates (Settings → Deadlines). */
export type DeadlineMoves = Record<string, string>

export function deadlineMoves(scopes: ScopeDef[]): DeadlineMoves {
  return Object.assign({}, ...scopes.map((s) => s.deadlines ?? {}))
}

export interface Deadline {
  id: string
  title: string
  detail: string
  /** Statutory due date. */
  date: string
  /** FSG's own cut-off for staff, one day ahead where the firm keeps one. */
  internalDate?: string
  dept: Department
  /** The scope whose clients it applies to, and whose Settings entry holds a changed date. */
  scope: ScopeKey
  /** The usual date, when the date has been changed (an extension, say). */
  movedFrom?: string
  /** Yearly dates the government often extends. */
  extendable?: boolean
  applies: (c: Client) => boolean
}

const has = (c: Client, ...keys: Client['scopes']) => c.active && keys.some((k) => c.scopes.includes(k))

function iso(y: number, m: number, d: number): string {
  return toISO(new Date(y, m, d))
}

/**
 * Every statutory date that falls inside [from, to], in date order, with the dates changed in Settings in place of
 * the usual ones. The staff cut-off moves along with a changed date.
 */
export function statutoryDeadlines(from: string, to: string, moves: DeadlineMoves = {}): Deadline[] {
  const out: Deadline[] = []
  // A year earlier too, so a date extended into the range from before it is still found.
  const startYear = Number(from.slice(0, 4)) - 1
  const endYear = Number(to.slice(0, 4))

  for (let y = startYear; y <= endYear; y++) {
    for (let m = 0; m < 12; m++) {
      const month = `${y}-${String(m + 1).padStart(2, '0')}`
      const prev = periodLabel(shiftPeriod(month, -1), true)

      out.push({
        id: `gstr1-${month}`,
        scope: 'gst_filing',
        title: 'GSTR-1',
        detail: `Outward supplies · ${prev}`,
        date: iso(y, m, 11),
        internalDate: iso(y, m, 10),
        dept: 'gst',
        applies: (c) => has(c, 'gst_filing'),
      })
      out.push({
        id: `gstr3b-${month}`,
        scope: 'gst_filing',
        title: 'GSTR-3B',
        detail: `Summary return · ${prev}`,
        date: iso(y, m, 20),
        internalDate: iso(y, m, 19),
        dept: 'gst',
        applies: (c) => has(c, 'gst_filing'),
      })
      out.push({
        id: `tds-pay-${month}`,
        scope: 'tds',
        title: 'TDS payment',
        detail: `Deposit for ${prev}`,
        // March deductions are payable by 30 April; every other month by the 7th.
        date: m === 3 ? iso(y, 3, 30) : iso(y, m, 7),
        dept: 'tds',
        applies: (c) => has(c, 'tds'),
      })
    }

    const fy = `${y}-${String(y + 1).slice(2)}`
    const prevFy = `${y - 1}-${String(y).slice(2)}`
    const quarterly: Array<[number, number, string]> = [
      [0, 31, `Q3 · FY ${prevFy}`],
      [4, 31, `Q4 · FY ${prevFy}`],
      [6, 31, `Q1 · FY ${fy}`],
      [9, 31, `Q2 · FY ${fy}`],
    ]
    for (const [m, d, label] of quarterly) {
      out.push({
        id: `tds-ret-${y}-${m}`,
        scope: 'tds',
        title: 'TDS return',
        detail: label,
        date: iso(y, m, d),
        dept: 'tds',
        applies: (c) => has(c, 'tds'),
      })
    }

    out.push(
      {
        id: `itr-ind-${y}`,
        scope: 'it_non_audit',
        title: 'ITR · non-audit',
        detail: `Individuals · AY ${fy}`,
        date: iso(y, 6, 31),
        dept: 'it',
        extendable: true,
        applies: (c) => has(c, 'it_non_audit') && c.category !== 'Proprietorship',
      },
      {
        id: `itr-prop-${y}`,
        scope: 'it_non_audit',
        title: 'ITR · non-audit',
        detail: `Proprietorships · AY ${fy}`,
        date: iso(y, 7, 31),
        dept: 'it',
        extendable: true,
        applies: (c) => has(c, 'it_non_audit') && c.category === 'Proprietorship',
      },
      {
        id: `annual-return-${y}`,
        scope: 'annual_return',
        title: 'GST annual return',
        detail: `GSTR-9 · FY ${prevFy}`,
        date: iso(y, 11, 31),
        dept: 'gst',
        extendable: true,
        applies: (c) => has(c, 'annual_return'),
      },
      {
        id: `audit-${y}`,
        scope: 'it_audit',
        title: 'Audit report',
        detail: `Audit cases · FY ${prevFy}`,
        date: iso(y, 8, 30),
        dept: 'audit',
        extendable: true,
        applies: (c) => has(c, 'it_audit'),
      },
      {
        id: `itr-audit-${y}`,
        scope: 'it_audit',
        title: 'ITR · audit cases',
        detail: `With audit · AY ${fy}`,
        date: iso(y, 9, 31),
        dept: 'it',
        extendable: true,
        applies: (c) => has(c, 'it_audit'),
      },
      {
        id: `internal-audit-${y}`,
        scope: 'internal_audit',
        title: 'Internal audit',
        detail: `Audit without IT filing · FY ${prevFy}`,
        date: iso(y, 9, 31),
        dept: 'audit',
        extendable: true,
        applies: (c) => has(c, 'internal_audit'),
      },
    )
  }

  return out
    .map((d) => {
      const date = moves[d.id]
      if (!date || date === d.date) return d
      return { ...d, date, movedFrom: d.date, internalDate: d.internalDate && addDays(date, -1) }
    })
    .filter((d) => d.date >= from && d.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date))
}

/** The deadline ids a scope's dates are kept under, with what each is called, for Settings. */
export const SCOPE_DEADLINES: Partial<Record<ScopeKey, string>> = {
  gst_filing: 'GSTR-1 and GSTR-3B every month',
  annual_return: 'GSTR-9 every year',
  tds: 'TDS payment every month, returns every quarter',
  it_non_audit: 'Returns for individuals and proprietorships',
  it_audit: 'Audit report and the return after it',
  internal_audit: 'Internal audit every year',
}

/** When one client's income tax return falls due, from the kind of case and the client's category, or the date it was moved to. */
export function itDueDate(row: { ay: string; kind: 'non_audit' | 'audit' }, c?: Pick<Client, 'category'>, moves: DeadlineMoves = {}): string {
  const y = row.ay.slice(0, 4)
  if (row.kind === 'audit') return moves[`itr-audit-${y}`] ?? `${y}-10-31`
  return c?.category === 'Proprietorship' ? (moves[`itr-prop-${y}`] ?? `${y}-08-31`) : (moves[`itr-ind-${y}`] ?? `${y}-07-31`)
}

/**
 * When GSTR-1 for a period ('YYYY-MM') is due: the 11th of the next month (or the date it was moved to), or the 13th
 * for a quarterly (QRMP) client, whose invoices for the first two months of a quarter go in by IFF on the 13th too.
 */
export function gstr1Due(period: string, freq: 'M' | 'Q' = 'M', moves: DeadlineMoves = {}): string {
  const next = shiftPeriod(period, 1)
  return freq === 'Q' ? `${next}-13` : (moves[`gstr1-${next}`] ?? `${next}-11`)
}

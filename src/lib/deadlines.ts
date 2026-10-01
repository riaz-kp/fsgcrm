import type { Client, Department } from '../types'
import { periodLabel, shiftPeriod, toISO } from './format'

export interface Deadline {
  id: string
  title: string
  detail: string
  /** Statutory due date. */
  date: string
  /** FSG's own cut-off for staff, one day ahead where the firm keeps one. */
  internalDate?: string
  dept: Department
  /** Yearly dates the government often extends. */
  extendable?: boolean
  applies: (c: Client) => boolean
}

const has = (c: Client, ...keys: Client['scopes']) => c.active && keys.some((k) => c.scopes.includes(k))

function iso(y: number, m: number, d: number): string {
  return toISO(new Date(y, m, d))
}

/** Every statutory date that falls inside [from, to], in date order. */
export function statutoryDeadlines(from: string, to: string): Deadline[] {
  const out: Deadline[] = []
  const startYear = Number(from.slice(0, 4))
  const endYear = Number(to.slice(0, 4))

  for (let y = startYear; y <= endYear; y++) {
    for (let m = 0; m < 12; m++) {
      const month = `${y}-${String(m + 1).padStart(2, '0')}`
      const prev = periodLabel(shiftPeriod(month, -1), true)

      out.push({
        id: `gstr1-${month}`,
        title: 'GSTR-1',
        detail: `Outward supplies · ${prev}`,
        date: iso(y, m, 11),
        internalDate: iso(y, m, 10),
        dept: 'gst',
        applies: (c) => has(c, 'gst_filing'),
      })
      out.push({
        id: `gstr3b-${month}`,
        title: 'GSTR-3B',
        detail: `Summary return · ${prev}`,
        date: iso(y, m, 20),
        internalDate: iso(y, m, 19),
        dept: 'gst',
        applies: (c) => has(c, 'gst_filing'),
      })
      out.push({
        id: `tds-pay-${month}`,
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
        title: 'ITR · non-audit',
        detail: `Individuals · AY ${fy}`,
        date: iso(y, 6, 31),
        dept: 'it',
        extendable: true,
        applies: (c) => has(c, 'it_non_audit') && c.category !== 'Proprietorship',
      },
      {
        id: `itr-prop-${y}`,
        title: 'ITR · non-audit',
        detail: `Proprietorships · AY ${fy}`,
        date: iso(y, 7, 31),
        dept: 'it',
        extendable: true,
        applies: (c) => has(c, 'it_non_audit') && c.category === 'Proprietorship',
      },
      {
        id: `annual-return-${y}`,
        title: 'GST annual return',
        detail: `GSTR-9 · FY ${prevFy}`,
        date: iso(y, 11, 31),
        dept: 'gst',
        extendable: true,
        applies: (c) => has(c, 'annual_return'),
      },
      {
        id: `audit-${y}`,
        title: 'Audit report',
        detail: `Audit cases · FY ${prevFy}`,
        date: iso(y, 8, 30),
        dept: 'audit',
        extendable: true,
        applies: (c) => has(c, 'it_audit'),
      },
      {
        id: `itr-audit-${y}`,
        title: 'ITR · audit cases',
        detail: `With audit · AY ${fy}`,
        date: iso(y, 9, 31),
        dept: 'it',
        extendable: true,
        applies: (c) => has(c, 'it_audit'),
      },
      {
        id: `internal-audit-${y}`,
        title: 'Internal audit',
        detail: `Audit without IT filing · FY ${prevFy}`,
        date: iso(y, 9, 31),
        dept: 'audit',
        extendable: true,
        applies: (c) => has(c, 'internal_audit'),
      },
    )
  }

  return out.filter((d) => d.date >= from && d.date <= to).sort((a, b) => a.date.localeCompare(b.date))
}

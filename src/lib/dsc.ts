import type { Client, Dsc } from '../types'
import { daysUntil, fmtDate } from './format'
import type { Tone } from './meta'

/** How long before a DSC expires it is brought up: getting a new one takes the holder's papers and a video check. */
export const DSC_NOTICE_DAYS = 30

export interface DscExpiry {
  client: Client
  dsc: Dsc
  /** Days left; negative once it has expired. */
  days: number
}

/** Where a DSC stands, for a badge. */
export function dscState(expiry: string): { label: string; tone: Tone } {
  const n = daysUntil(expiry)
  if (n < 0) return { label: `Expired ${fmtDate(expiry, true)}`, tone: 'red' }
  if (n === 0) return { label: 'Expires today', tone: 'red' }
  if (n <= DSC_NOTICE_DAYS) return { label: `Expires in ${n} day${n === 1 ? '' : 's'}`, tone: 'amber' }
  return { label: `Valid till ${fmtDate(expiry, true)}`, tone: 'green' }
}

/** The DSCs of active clients that have expired or expire within `within` days, soonest first. */
export function dscsDue(clients: Client[], within = DSC_NOTICE_DAYS): DscExpiry[] {
  return clients
    .filter((c) => c.active)
    .flatMap((client) => (client.dscs ?? []).map((dsc) => ({ client, dsc, days: daysUntil(dsc.expiry) })))
    .filter((x) => x.days <= within)
    .sort((a, b) => a.days - b.days)
}

/** Whoever looks after DSCs: those who assign work, and anyone whose work includes DSCs. */
export function looksAfterDscs(responsibilities: string[], assigns: boolean): boolean {
  return assigns || responsibilities.some((r) => /\bdsc\b|digital signature/i.test(r))
}

import { History } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { periodLabel } from '../lib/format'
import type { WorkEntry } from '../lib/history'
import { DEPARTMENTS } from '../lib/meta'
import { useLookup } from '../store'
import type { Department } from '../types'
import { Badge, Card, CardHeader, Empty, Person, Segmented, Select } from './ui'

/** Registrations and other one-time jobs are filed under the registration department. */
const FILTERS: Array<{ value: Department | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'gst', label: 'GST' },
  { value: 'tds', label: 'TDS' },
  { value: 'it', label: 'Income tax' },
  { value: 'audit', label: 'Audit' },
  { value: 'registration', label: 'One-time' },
  { value: 'bookkeeping', label: 'Book keeping' },
  { value: 'general', label: 'General' },
]

/** What the second filter and the last column are about: the other side of the work from the page it sits on. */
const other = (e: WorkEntry, by: 'person' | 'client') => (by === 'person' ? e.assigneeId : e.clientId ?? e.party) || ''

/**
 * Work month by month. On a client's page each line says who did it (`by="person"`);
 * on a person's page it says who it was for (`by="client"`).
 * `recent` shows only that many months until the reader asks for the rest.
 */
export default function WorkHistory({ entries, by, hint, recent, className }: { entries: WorkEntry[]; by: 'person' | 'client'; hint: string; recent?: number; className?: string }) {
  const { emp } = useLookup()
  const [dept, setDept] = useState<Department | 'all'>('all')
  const [pick, setPick] = useState('')
  const [all, setAll] = useState(false)

  // The people who worked on this client, or the clients this person worked for.
  const seen = new Map<string, string>()
  for (const e of entries) {
    const id = other(e, by)
    if (id && !seen.has(id)) seen.set(id, by === 'person' ? (emp(id)?.name ?? 'Unknown') : e.party)
  }
  const choices = [...seen].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))

  const shown = entries.filter((e) => (dept === 'all' || e.dept === dept) && (!pick || other(e, by) === pick))
  const months = [...new Set(shown.map((e) => e.month))]
  const visible = all || !recent ? months : months.slice(0, recent)
  // Only offer the kinds of work that are actually here.
  const filters = FILTERS.filter((f) => f.value === 'all' || entries.some((e) => e.dept === f.value)).map((f) => ({
    ...f,
    count: f.value === 'all' ? entries.length : entries.filter((e) => e.dept === f.value).length,
  }))

  return (
    <Card className={className}>
      <CardHeader title="Work history" hint={hint} />
      <div className="flex flex-wrap items-center gap-2 border-y border-ink-100 px-3 py-2.5">
        <Segmented value={dept} onChange={setDept} items={filters} />
        <Select small fit value={pick} onChange={(e) => setPick(e.target.value)} aria-label={by === 'person' ? 'Done by' : 'Client'} className="max-sm:w-full sm:ml-auto sm:max-w-56">
          <option value="">{by === 'person' ? 'Done by anyone' : 'For any client'}</option>
          {choices.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
      {shown.length === 0 ? (
        <Empty
          icon={<History size={20} />}
          title={entries.length ? 'Nothing matches these filters' : 'No work on record yet'}
          hint={
            entries.length
              ? `Try another kind of work or ${by === 'person' ? 'person' : 'client'}.`
              : `Filings, one-time jobs and tasks ${by === 'person' ? 'for this client' : 'assigned to this person'} will collect here.`
          }
        />
      ) : (
        <div className="pb-2">
          {visible.map((m) => {
            const list = shown.filter((e) => e.month === m)
            const others = [...new Set(list.map((e) => (by === 'person' ? emp(e.assigneeId)?.name : e.party)).filter(Boolean))]
            return (
              <section key={m}>
                <header className="flex flex-wrap items-baseline justify-between gap-x-3 bg-ink-50/70 px-5 py-1.5">
                  <h3 className="text-[13px] font-bold text-ink-800">{periodLabel(m)}</h3>
                  <p className="text-xs text-ink-500">
                    {list.filter((e) => e.done).length} of {list.length} done · {by === 'person' ? others.join(', ') : `${others.length} ${others.length === 1 ? 'client' : 'clients'}`}
                  </p>
                </header>
                <ul className="divide-y divide-ink-100">
                  {list.map((e) => (
                    <li key={e.key}>
                      {/* On a phone the title takes the first line and the badges and name sit under it. */}
                      <Link to={e.to} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-2 hover:bg-ink-50">
                        <span className="shrink-0 sm:w-24">
                          <Badge tone={DEPARTMENTS[e.dept].tone}>{e.dept === 'registration' ? 'One-time' : DEPARTMENTS[e.dept].label}</Badge>
                        </span>
                        <span className="min-w-0 flex-1 max-sm:order-first max-sm:basis-full">
                          <span className="block truncate font-semibold text-ink-800">{e.title}</span>
                          <span className="block truncate text-xs text-ink-500">{e.detail}</span>
                        </span>
                        <Badge tone={e.status.tone}>{e.status.label}</Badge>
                        {by === 'person' ? (
                          <span className="min-w-0 text-[13px] max-sm:ml-auto sm:w-36 sm:shrink-0">
                            <Person emp={emp(e.assigneeId)} size={22} />
                          </span>
                        ) : (
                          <span className="min-w-0 truncate text-[13px] font-medium text-ink-700 max-sm:flex-1 max-sm:text-right sm:w-48 sm:shrink-0" title={e.party || undefined}>
                            {e.party || <span className="font-normal text-ink-400">Internal</span>}
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
          {visible.length < months.length && (
            <button type="button" onClick={() => setAll(true)} className="mx-5 mt-3 mb-1 text-[13px] font-semibold text-brand-700 hover:underline">
              Show {months.length - visible.length} earlier {months.length - visible.length === 1 ? 'month' : 'months'}
            </button>
          )}
        </div>
      )}
    </Card>
  )
}

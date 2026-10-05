import { Building2, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PhoneLink, ScopeChips, WhatsAppLink } from '../components/bits'
import ClientForm from '../components/ClientForm'
import { Avatar, Badge, Button, Card, Empty, PageHeader, Segmented, Select, Td, Th } from '../components/ui'
import { cn, inr } from '../lib/format'
import { CATEGORIES, CATEGORY_TONE } from '../lib/meta'
import { useStoredState } from '../lib/useStoredState'
import { useCan, useScopes, useStore } from '../store'
import type { Client, ClientCategory, ScopeKey } from '../types'

type StatusFilter = 'active' | 'inactive' | 'all'

const balanceOf = (c: Client) => c.transactions.reduce((sum, x) => sum + (x.kind === 'charge' ? x.amount : -x.amount), 0)
const byName = (a: Client, b: Client) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })

const SORTS = {
  name: { label: 'Name A–Z', cmp: byName },
  name_desc: { label: 'Name Z–A', cmp: (a: Client, b: Client) => byName(b, a) },
  newest: { label: 'Newest client first', cmp: (a: Client, b: Client) => b.since.localeCompare(a.since) || byName(a, b) },
  oldest: { label: 'Longest with us', cmp: (a: Client, b: Client) => a.since.localeCompare(b.since) || byName(a, b) },
  code: { label: 'Client code', cmp: (a: Client, b: Client) => a.code.localeCompare(b.code, 'en', { numeric: true }) },
  place: { label: 'Place', cmp: (a: Client, b: Client) => a.place.localeCompare(b.place) || byName(a, b) },
  category: { label: 'Category', cmp: (a: Client, b: Client) => CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category) || byName(a, b) },
  balance: { label: 'Fee balance, highest first', cmp: (a: Client, b: Client) => balanceOf(b) - balanceOf(a) || byName(a, b) },
} satisfies Record<string, { label: string; cmp: (a: Client, b: Client) => number }>

type SortKey = keyof typeof SORTS
const isSort = (v: unknown): v is SortKey => typeof v === 'string' && v in SORTS

export default function Clients() {
  const clients = useStore((s) => s.clients)
  const scopes = useScopes()
  const can = useCan()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [category, setCategory] = useState<ClientCategory | ''>('')
  const [scope, setScope] = useState<ScopeKey | ''>('')
  const [status, setStatus] = useState<StatusFilter>('active')
  const [stored, setSort] = useStoredState<SortKey>('fsg-clients-sort', 'name', isSort)
  // Sorting by balance is only on offer to people who may see fees.
  const sort: SortKey = stored === 'balance' && !can('view_fees') ? 'name' : stored

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return clients
      .filter(
        (c) =>
          (status === 'all' || c.active === (status === 'active')) &&
          (!category || c.category === category) &&
          (!scope || c.scopes.includes(scope)) &&
          (!term ||
            [c.name, c.code, c.place, c.phone, c.whatsapp, c.email, c.business, c.profession, c.gstin, c.pan].some((v) => v?.toLowerCase().includes(term))),
      )
      .sort(SORTS[sort].cmp)
  }, [clients, q, category, scope, status, sort])

  const activeCount = clients.filter((c) => c.active).length

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle={`${activeCount} active · ${clients.length - activeCount} inactive`}
        actions={
          can('edit_clients') && (
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setParams({ new: '1' })}>
              Add client
            </Button>
          )
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 p-3">
          <div className="relative min-w-52 flex-1">
            <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name, code, place, phone, GSTIN…"
              aria-label="Filter clients"
              className="h-9 w-full rounded-lg bg-white pr-3 pl-9 text-sm ring-1 ring-ink-200 ring-inset placeholder:text-ink-400 focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>
          <Select value={category} onChange={(e) => setCategory(e.target.value as ClientCategory | '')} fit aria-label="Category" className="max-sm:min-w-0 max-sm:flex-1 max-sm:basis-[40%]">
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
          <Select value={scope} onChange={(e) => setScope(e.target.value as ScopeKey | '')} fit aria-label="Scope" className="max-sm:min-w-0 max-sm:flex-1 max-sm:basis-[40%]">
            <option value="">Any scope</option>
            {scopes.list.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} fit aria-label="Sort by" className="max-sm:min-w-0 max-sm:flex-1 max-sm:basis-[40%]">
            {(Object.keys(SORTS) as SortKey[])
              .filter((k) => k !== 'balance' || can('view_fees'))
              .map((k) => (
                <option key={k} value={k}>
                  Sort: {SORTS[k].label}
                </option>
              ))}
          </Select>
          <Segmented
            value={status}
            onChange={setStatus}
            items={[
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
              { value: 'all', label: 'All' },
            ]}
          />
        </div>

        {rows.length === 0 ? (
          <Empty
            icon={<Building2 size={20} />}
            title="No clients match these filters"
            hint="Try clearing the search or switching to All."
            action={
              <Button
                onClick={() => {
                  setQ('')
                  setCategory('')
                  setScope('')
                  setStatus('all')
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          <div className="@container overflow-x-auto">
            <table className="stack w-full min-w-[820px] text-sm">
              <thead className="border-b border-ink-100 bg-ink-50/60">
                <tr>
                  <Th>Client</Th>
                  <Th>Category</Th>
                  <Th>Business / profession</Th>
                  <Th>Place</Th>
                  <Th>Phone</Th>
                  {sort === 'balance' && <Th align="right">Balance</Th>}
                  <Th>Scope of work</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {rows.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => navigate(`/clients/${c.id}`)}
                    onKeyDown={(e) => e.key === 'Enter' && navigate(`/clients/${c.id}`)}
                    tabIndex={0}
                    className="cursor-pointer transition-colors hover:bg-brand-50/40 focus-visible:bg-brand-50/60"
                  >
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar name={c.name} hue={(Number(c.code.slice(-3)) * 37) % 360} size={32} square />
                        <div className="min-w-0">
                          <p className={cn('truncate font-semibold', c.active ? 'text-ink-900' : 'text-ink-500')}>
                            {c.name}
                            {!c.active && <Badge className="ml-2">Inactive</Badge>}
                          </p>
                          <p className="tnum text-xs text-ink-500">{c.code}</p>
                        </div>
                      </div>
                    </Td>
                    <Td label="Category">
                      <Badge tone={CATEGORY_TONE[c.category]}>{c.category}</Badge>
                    </Td>
                    <Td label="Business / profession" className="text-ink-600">
                      {c.profession ?? c.business}
                    </Td>
                    <Td label="Place" className="text-ink-600">
                      {c.place}
                    </Td>
                    <Td label="Phone" className="text-ink-600">
                      <span className="flex items-center gap-2">
                        <PhoneLink phone={c.phone} />
                        <WhatsAppLink number={c.whatsapp} compact />
                      </span>
                    </Td>
                    {sort === 'balance' && (
                      <Td label="Balance" className={cn('tnum text-right font-bold @max-3xl:text-left', balanceOf(c) > 0 ? 'text-amber-700' : 'text-ink-400')}>
                        {balanceOf(c) > 0 ? inr(balanceOf(c)) : '—'}
                      </Td>
                    )}
                    <Td label="Scope of work" className="col-span-full">
                      <ScopeChips scopes={c.scopes} max={4} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="border-t border-ink-100 px-5 py-2.5 text-xs text-ink-500">
          Showing {rows.length} of {clients.length}
        </p>
      </Card>

      {params.get('new') && can('edit_clients') && <ClientForm onClose={() => setParams({})} onSaved={(id) => navigate(`/clients/${id}`)} />}
    </>
  )
}

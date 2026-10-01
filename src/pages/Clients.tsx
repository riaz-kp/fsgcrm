import { Building2, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PhoneLink, ScopeChips, WhatsAppLink } from '../components/bits'
import ClientForm from '../components/ClientForm'
import { Avatar, Badge, Button, Card, Empty, PageHeader, Segmented, Select, Td, Th } from '../components/ui'
import { cn } from '../lib/format'
import { CATEGORIES, CATEGORY_TONE, SCOPES } from '../lib/meta'
import { useStore } from '../store'
import type { ClientCategory, ScopeKey } from '../types'

type StatusFilter = 'active' | 'inactive' | 'all'

export default function Clients() {
  const clients = useStore((s) => s.clients)
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [category, setCategory] = useState<ClientCategory | ''>('')
  const [scope, setScope] = useState<ScopeKey | ''>('')
  const [status, setStatus] = useState<StatusFilter>('active')

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return clients.filter(
      (c) =>
        (status === 'all' || c.active === (status === 'active')) &&
        (!category || c.category === category) &&
        (!scope || c.scopes.includes(scope)) &&
        (!term ||
          [c.name, c.code, c.place, c.phone, c.whatsapp, c.email, c.business, c.profession, c.gstin, c.pan].some((v) => v?.toLowerCase().includes(term))),
    )
  }, [clients, q, category, scope, status])

  const activeCount = clients.filter((c) => c.active).length

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle={`${activeCount} active · ${clients.length - activeCount} inactive`}
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setParams({ new: '1' })}>
            Add client
          </Button>
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
          <Select value={category} onChange={(e) => setCategory(e.target.value as ClientCategory | '')} fit aria-label="Category">
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
          <Select value={scope} onChange={(e) => setScope(e.target.value as ScopeKey | '')} fit aria-label="Scope">
            <option value="">Any scope</option>
            {SCOPES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
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
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="border-b border-ink-100 bg-ink-50/60">
                <tr>
                  <Th>Client</Th>
                  <Th>Category</Th>
                  <Th>Business / profession</Th>
                  <Th>Place</Th>
                  <Th>Phone</Th>
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
                    <Td>
                      <Badge tone={CATEGORY_TONE[c.category]}>{c.category}</Badge>
                    </Td>
                    <Td className="text-ink-600">{c.profession ?? c.business}</Td>
                    <Td className="text-ink-600">{c.place}</Td>
                    <Td className="text-ink-600">
                      <span className="flex items-center gap-2">
                        <PhoneLink phone={c.phone} />
                        <WhatsAppLink number={c.whatsapp} compact />
                      </span>
                    </Td>
                    <Td>
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

      {params.get('new') && <ClientForm onClose={() => setParams({})} onSaved={(id) => navigate(`/clients/${id}`)} />}
    </>
  )
}

import { ArrowRight, CalendarClock, MapPin, Plus, Search, SearchX, Send, Target, UserCheck, X } from 'lucide-react'
import { useMemo, useState, type DragEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Due, PhoneLink, ScopeChips, WhatsAppLink } from '../components/bits'
import { ScopePicker } from '../components/ClientForm'
import { Avatar, Badge, Button, Card, Drawer, Empty, Field, IconButton, Input, Modal, PageHeader, Person, Segmented, Select, StatusSelect, Td, Textarea, Th, TONE_BAR } from '../components/ui'
import { addDays, cn, daysUntil, fmtDate, todayISO } from '../lib/format'
import { CATEGORIES, CATEGORY_TONE, LEAD_SOURCES, LEAD_STATUS, LEAD_STATUS_ORDER, options, pruneScopeDetails } from '../lib/meta'
import { useStoredState } from '../lib/useStoredState'
import { useCurrentUser, useLookup, useScopes, useStore } from '../store'
import type { ClientCategory, Lead, LeadStatus, ScopeDetails, ScopeKey } from '../types'

const isOpen = (l: Lead) => l.status === 'new' || l.status === 'followup'

function LeadForm({ onClose }: { onClose: () => void }) {
  const addLead = useStore((s) => s.addLead)
  const employees = useStore((s) => s.employees)
  const scopeDefs = useStore((s) => s.scopes)
  const me = useCurrentUser()
  const [f, setF] = useState({
    name: '',
    contact: '',
    phone: '',
    whatsapp: '',
    place: '',
    source: LEAD_SOURCES[0],
    category: 'Proprietorship' as ClientCategory,
    scopes: [] as ScopeKey[],
    scopeDetails: {} as ScopeDetails,
    ownerId: employees.find((e) => e.responsibilities.includes('Client lead management'))?.id ?? me.id,
    nextFollowUp: addDays(todayISO(), 2),
    note: '',
  })
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }))
  const valid = f.name.trim() && f.phone.trim()

  const save = () => {
    if (!valid) return
    const { note, ...lead } = f
    addLead(
      {
        ...lead,
        name: f.name.trim(),
        phone: f.phone.trim(),
        whatsapp: f.whatsapp.trim() || undefined,
        scopeDetails: pruneScopeDetails(f.scopes, f.scopeDetails, scopeDefs),
        status: 'new',
      },
      note.trim() || undefined,
    )
    onClose()
  }

  return (
    <Modal
      wide
      title="New enquiry"
      subtitle="Record who asked, what they need and when to call back."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={!valid}>
            Add lead
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Business or person" className="sm:col-span-2">
          <Input value={f.name} onChange={(e) => set('name', e.target.value)} autoFocus />
        </Field>
        <Field label="Contact person">
          <Input value={f.contact} onChange={(e) => set('contact', e.target.value)} />
        </Field>
        <Field label="Phone">
          <Input value={f.phone} onChange={(e) => set('phone', e.target.value)} inputMode="tel" />
        </Field>
        <Field label="WhatsApp number" hint="optional">
          <Input value={f.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} inputMode="tel" />
        </Field>
        <Field label="Place">
          <Input value={f.place} onChange={(e) => set('place', e.target.value)} />
        </Field>
        <Field label="Category">
          <Select value={f.category} onChange={(e) => set('category', e.target.value as ClientCategory)}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="How they reached us">
          <Select value={f.source} onChange={(e) => set('source', e.target.value)}>
            {LEAD_SOURCES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </Field>
        <Field label="Handled by">
          <Select value={f.ownerId} onChange={(e) => set('ownerId', e.target.value)}>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-[13px] font-semibold text-ink-700">What they enquired about</p>
          <ScopePicker value={f.scopes} onChange={(v) => set('scopes', v)} details={f.scopeDetails} onDetails={(v) => set('scopeDetails', v)} />
        </div>
        <Field label="Next follow-up">
          <Input type="date" value={f.nextFollowUp} onChange={(e) => set('nextFollowUp', e.target.value)} />
        </Field>
        <Field label="Remarks" className="sm:col-span-2">
          <Textarea value={f.note} onChange={(e) => set('note', e.target.value)} placeholder="What was discussed, fee quoted, anything to remember…" />
        </Field>
      </div>
    </Modal>
  )
}

function LeadDrawer({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const updateLead = useStore((s) => s.updateLead)
  const addLeadRemark = useStore((s) => s.addLeadRemark)
  const convertLead = useStore((s) => s.convertLead)
  const clients = useStore((s) => s.clients)
  const { emp } = useLookup()
  const scopes = useScopes()
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const existing = clients.find((c) => c.name.toLowerCase().startsWith(lead.name.toLowerCase()))

  const post = () => {
    if (!text.trim()) return
    addLeadRemark(lead.id, text.trim())
    setText('')
  }

  return (
    <Drawer onClose={onClose} label={lead.name}>
      <header className="border-b border-ink-100 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-ink-500">
              Enquiry · {fmtDate(lead.createdAt, true)} · {lead.source}
            </p>
            <h2 className="mt-0.5 text-lg leading-snug font-extrabold text-ink-900">{lead.name}</h2>
          </div>
          <IconButton label="Close" onClick={onClose} className="-mr-2">
            <X size={18} />
          </IconButton>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusSelect label="Lead status" value={lead.status} options={options(LEAD_STATUS)} onChange={(status) => updateLead(lead.id, { status })} />
          <Badge tone={CATEGORY_TONE[lead.category]}>{lead.category}</Badge>
        </div>
      </header>

      <div className="scroll-thin flex-1 overflow-y-auto">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-5 py-4 text-sm">
          <div>
            <dt className="text-xs text-ink-500">Contact</dt>
            <dd className="font-semibold text-ink-800">{lead.contact || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-500">Phone</dt>
            <dd className="font-semibold text-ink-800">
              <PhoneLink phone={lead.phone} icon />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-500">WhatsApp</dt>
            <dd className="font-semibold text-ink-800">
              <WhatsAppLink number={lead.whatsapp} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-500">Place</dt>
            <dd className="flex items-center gap-1.5 font-semibold text-ink-800">
              <MapPin size={13} className="text-ink-400" />
              {lead.place || '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-500">Handled by</dt>
            <dd className="mt-0.5">
              <Person emp={emp(lead.ownerId)} size={22} />
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="mb-1 text-xs text-ink-500">Enquired about</dt>
            <dd className="flex flex-wrap gap-1.5">
              {lead.scopes.length ? (
                lead.scopes.map((s) => (
                  <Badge key={s} tone="blue">
                    {scopes.label(s)}
                    {lead.scopeDetails?.[s] && <span className="font-normal"> · {lead.scopeDetails[s]}</span>}
                  </Badge>
                ))
              ) : (
                <span className="text-ink-400">Not recorded</span>
              )}
            </dd>
          </div>
          {isOpen(lead) && (
            <div className="col-span-2">
              <dt className="mb-1 text-xs text-ink-500">Next follow-up</dt>
              <dd className="flex items-center gap-3">
                <Input
                  type="date"
                  fit
                  value={lead.nextFollowUp ?? ''}
                  onChange={(e) => updateLead(lead.id, { nextFollowUp: e.target.value || undefined, status: 'followup' })}
                  aria-label="Next follow-up date"
                />
                {lead.nextFollowUp && <Due date={lead.nextFollowUp} />}
              </dd>
            </div>
          )}
        </dl>

        {lead.status === 'won' && (
          <div className="mx-5 mb-4 flex items-center justify-between gap-3 rounded-xl bg-emerald-50 p-3.5 ring-1 ring-emerald-200">
            <p className="text-[13px] font-semibold text-emerald-900">
              {existing ? `Onboarded as ${existing.code}.` : 'Won. Create the client record to start work.'}
            </p>
            {existing ? (
              <Button size="sm" onClick={() => navigate(`/clients/${existing.id}`)} icon={<ArrowRight size={15} />}>
                Open client
              </Button>
            ) : (
              <Button size="sm" variant="primary" icon={<UserCheck size={15} />} onClick={() => navigate(`/clients/${convertLead(lead.id)}`)}>
                Convert to client
              </Button>
            )}
          </div>
        )}

        <section className="border-t border-ink-100 px-5 py-4">
          <h3 className="mb-3 text-[13px] font-bold text-ink-900">Remarks</h3>
          {lead.remarks.length === 0 && <p className="text-[13px] text-ink-500">No remarks yet.</p>}
          <ol className="space-y-4">
            {lead.remarks.map((r) => {
              const by = emp(r.by)
              return (
                <li key={r.id} className="flex gap-3">
                  <Avatar name={by?.name ?? '?'} hue={by?.hue} photo={by?.photo} size={26} />
                  <div className="min-w-0">
                    <p className="text-xs text-ink-500">
                      <span className="font-semibold text-ink-800">{by?.name}</span> · {fmtDate(r.at)}
                    </p>
                    <p className="mt-0.5 text-sm text-ink-700">{r.text}</p>
                  </div>
                </li>
              )
            })}
          </ol>
        </section>
      </div>

      <footer className="border-t border-ink-100 p-4">
        <div className="flex items-end gap-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && post()}
            placeholder="Add a follow-up remark…"
            rows={2}
            aria-label="New remark"
          />
          <Button variant="primary" onClick={post} disabled={!text.trim()} icon={<Send size={15} />}>
            Add
          </Button>
        </div>
      </footer>
    </Drawer>
  )
}

function LeadCard({ lead, onOpen }: { lead: Lead; onOpen: () => void }) {
  const { emp } = useLookup()
  const owner = emp(lead.ownerId)
  const last = lead.remarks[lead.remarks.length - 1]
  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/lead', lead.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
      tabIndex={0}
      className="cursor-pointer rounded-xl bg-white p-3 shadow-card ring-1 ring-ink-200/80 transition-shadow hover:shadow-pop hover:ring-brand-300"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-bold text-ink-900">{lead.name}</p>
          <p className="truncate text-xs text-ink-500">
            {lead.contact} · {lead.place}
          </p>
        </div>
        {owner && <Avatar name={owner.name} hue={owner.hue} photo={owner?.photo} size={24} />}
      </div>
      <div className="mt-2.5">
        <ScopeChips scopes={lead.scopes} max={3} />
      </div>
      {last && <p className="mt-2.5 line-clamp-2 text-[13px] leading-snug text-ink-600">{last.text}</p>}
      {isOpen(lead) && lead.nextFollowUp && (
        <p className="mt-2.5 flex items-center gap-1.5 border-t border-ink-100 pt-2.5 text-xs">
          <CalendarClock size={13} className="text-ink-400" />
          <span className="text-ink-500">Follow up</span>
          <Due date={lead.nextFollowUp} />
        </p>
      )}
    </article>
  )
}

function Board({ leads, onOpen }: { leads: Lead[]; onOpen: (id: string) => void }) {
  const updateLead = useStore((s) => s.updateLead)
  const [over, setOver] = useState<LeadStatus | null>(null)

  const drop = (e: DragEvent, status: LeadStatus) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/lead')
    if (id) updateLead(id, { status })
    setOver(null)
  }

  return (
    <div className="scroll-thin -mx-4 flex gap-3 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6 xl:grid xl:grid-cols-4">
      {LEAD_STATUS_ORDER.map((status) => {
        const col = leads.filter((l) => l.status === status)
        return (
          <section
            key={status}
            onDragOver={(e) => {
              e.preventDefault()
              setOver(status)
            }}
            onDragLeave={() => setOver((s) => (s === status ? null : s))}
            onDrop={(e) => drop(e, status)}
            className={cn(
              'flex w-[290px] shrink-0 flex-col rounded-2xl bg-ink-100/60 p-2 transition-colors xl:w-auto',
              over === status && 'bg-brand-50 ring-2 ring-brand-300',
            )}
          >
            <header className="flex items-center gap-2 px-2 pt-1.5 pb-2.5">
              <span className={cn('size-2 rounded-full', TONE_BAR[LEAD_STATUS[status].tone])} />
              <h2 className="text-[13px] font-bold text-ink-800">{LEAD_STATUS[status].label}</h2>
              <span className="tnum text-[13px] font-semibold text-ink-400">{col.length}</span>
            </header>
            <div className="flex min-h-24 flex-col gap-2">
              {col.map((l) => (
                <LeadCard key={l.id} lead={l} onOpen={() => onOpen(l.id)} />
              ))}
              {col.length === 0 && <p className="px-2 py-6 text-center text-xs text-ink-400">Drop a lead here</p>}
            </div>
          </section>
        )
      })}
    </div>
  )
}

/* ---------- Sorting & filters ---------- */

const lastActivity = (l: Lead) => l.remarks.at(-1)?.at ?? l.createdAt
const byName = (a: Lead, b: Lead) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })

const SORTS = {
  // Open leads by the date to call them, those without a date after, closed ones last.
  followup: {
    label: 'Next follow-up first',
    cmp: (a: Lead, b: Lead) => {
      const rank = (l: Lead) => (isOpen(l) ? (l.nextFollowUp ? 0 : 1) : 2)
      return rank(a) - rank(b) || (a.nextFollowUp ?? '').localeCompare(b.nextFollowUp ?? '') || b.createdAt.localeCompare(a.createdAt)
    },
  },
  newest: { label: 'Newest enquiry first', cmp: (a: Lead, b: Lead) => b.createdAt.localeCompare(a.createdAt) || byName(a, b) },
  oldest: { label: 'Oldest enquiry first', cmp: (a: Lead, b: Lead) => a.createdAt.localeCompare(b.createdAt) || byName(a, b) },
  activity: { label: 'Latest remark first', cmp: (a: Lead, b: Lead) => lastActivity(b).localeCompare(lastActivity(a)) || byName(a, b) },
  name: { label: 'Name A–Z', cmp: byName },
} satisfies Record<string, { label: string; cmp: (a: Lead, b: Lead) => number }>

type SortKey = keyof typeof SORTS
const isSort = (v: unknown): v is SortKey => typeof v === 'string' && v in SORTS

type FollowUp = 'due' | 'week' | 'none'

const FOLLOW_UPS: Array<{ value: FollowUp; label: string; test: (l: Lead) => boolean }> = [
  // Due today or already missed.
  { value: 'due', label: 'Follow-up due', test: (l) => isOpen(l) && !!l.nextFollowUp && daysUntil(l.nextFollowUp) <= 0 },
  // In the next seven days.
  { value: 'week', label: 'Follow-up this week', test: (l) => isOpen(l) && !!l.nextFollowUp && daysUntil(l.nextFollowUp) >= 0 && daysUntil(l.nextFollowUp) <= 7 },
  // Still open, but nobody has set a date to call.
  { value: 'none', label: 'No follow-up date', test: (l) => isOpen(l) && !l.nextFollowUp },
]

const EMPTY_FILTERS = { q: '', status: '' as LeadStatus | '', source: '', category: '' as ClientCategory | '', scope: '' as ScopeKey | '', owner: '', followUp: '' as FollowUp | '' }
type Filters = typeof EMPTY_FILTERS

function FilterBar({ f, set, board, sort, onSort, shown, total, onClear }: { f: Filters; set: (patch: Partial<Filters>) => void; board: boolean; sort: SortKey; onSort: (s: SortKey) => void; shown: number; total: number; onClear: () => void }) {
  const employees = useStore((s) => s.employees)
  const scopes = useScopes()
  const dirty = Object.entries(f).some(([k, v]) => v && !(board && k === 'status'))
  const small = 'max-sm:min-w-0 max-sm:flex-1 max-sm:basis-[40%]'
  return (
    <Card className="mb-4">
      <div className="flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-52 flex-1 max-sm:basis-full">
          <Search size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-400" />
          <Input small value={f.q} onChange={(e) => set({ q: e.target.value })} placeholder="Name, contact, phone, place, remark…" aria-label="Search leads" className="pl-8" />
        </div>
        {/* On the board the columns already split by status. */}
        {!board && (
          <Select small fit value={f.status} onChange={(e) => set({ status: e.target.value as LeadStatus | '' })} aria-label="Status" className={small}>
            <option value="">Any status</option>
            {LEAD_STATUS_ORDER.map((st) => (
              <option key={st} value={st}>
                {LEAD_STATUS[st].label}
              </option>
            ))}
          </Select>
        )}
        <Select small fit value={f.followUp} onChange={(e) => set({ followUp: e.target.value as FollowUp | '' })} aria-label="Follow-up" className={small}>
          <option value="">Any follow-up</option>
          {FOLLOW_UPS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Select small fit value={f.scope} onChange={(e) => set({ scope: e.target.value })} aria-label="Enquired about" className={small}>
          <option value="">Any scope</option>
          {scopes.list.map((sc) => (
            <option key={sc.key} value={sc.key}>
              {sc.label}
            </option>
          ))}
        </Select>
        <Select small fit value={f.source} onChange={(e) => set({ source: e.target.value })} aria-label="How they reached us" className={small}>
          <option value="">Any source</option>
          {LEAD_SOURCES.map((src) => (
            <option key={src}>{src}</option>
          ))}
        </Select>
        <Select small fit value={f.category} onChange={(e) => set({ category: e.target.value as ClientCategory | '' })} aria-label="Category" className={small}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
        <Select small fit value={f.owner} onChange={(e) => set({ owner: e.target.value })} aria-label="Handled by" className={small}>
          <option value="">Handled by anyone</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </Select>
        <Select small fit value={sort} onChange={(e) => onSort(e.target.value as SortKey)} aria-label="Sort by" className={small}>
          {(Object.keys(SORTS) as SortKey[]).map((k) => (
            <option key={k} value={k}>
              Sort: {SORTS[k].label}
            </option>
          ))}
        </Select>
      </div>
      {dirty && (
        <p className="flex flex-wrap items-center gap-x-3 border-t border-ink-100 px-4 py-2 text-xs text-ink-500">
          <span className="tnum font-semibold text-ink-600">
            Showing {shown} of {total}
          </span>
          <button type="button" onClick={onClear} className="font-semibold text-brand-700 hover:underline">
            Clear filters
          </button>
        </p>
      )}
    </Card>
  )
}

export default function Leads() {
  const leads = useStore((s) => s.leads)
  const { emp } = useLookup()
  const [params, setParams] = useSearchParams()
  const [view, setView] = useState<'board' | 'list'>('board')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [sort, setSort] = useStoredState<SortKey>('fsg-leads-sort', 'followup', isSort)
  const openId = params.get('open')
  const open = leads.find((l) => l.id === openId)

  const shown = useMemo(() => {
    const f = filters
    const term = f.q.trim().toLowerCase()
    const followUp = FOLLOW_UPS.find((o) => o.value === f.followUp)
    return leads
      .filter(
        (l) =>
          (view === 'board' || !f.status || l.status === f.status) &&
          (!f.source || l.source === f.source) &&
          (!f.category || l.category === f.category) &&
          (!f.scope || l.scopes.includes(f.scope)) &&
          (!f.owner || l.ownerId === f.owner) &&
          (!followUp || followUp.test(l)) &&
          (!term || [l.name, l.contact, l.phone, l.whatsapp, l.place, ...l.remarks.map((r) => r.text)].some((v) => v?.toLowerCase().includes(term))),
      )
      .sort(SORTS[sort].cmp)
  }, [leads, filters, sort, view])

  const stats = useMemo(() => {
    const won = leads.filter((l) => l.status === 'won').length
    const lost = leads.filter((l) => l.status === 'lost').length
    return {
      open: leads.filter(isOpen).length,
      due: leads.filter((l) => isOpen(l) && l.nextFollowUp && daysUntil(l.nextFollowUp) <= 0).length,
      rate: won + lost ? Math.round((won / (won + lost)) * 100) : 0,
    }
  }, [leads])

  return (
    <>
      <PageHeader
        title="Leads"
        subtitle={
          <>
            {stats.open} open enquiries ·{' '}
            <span className={cn(stats.due > 0 && 'font-semibold text-amber-700')}>{stats.due} follow-ups due</span> · {stats.rate}% of closed leads won
          </>
        }
        actions={
          <>
            <Segmented
              value={view}
              onChange={setView}
              items={[
                { value: 'board', label: 'Board' },
                { value: 'list', label: 'List' },
              ]}
            />
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setParams({ new: '1' })}>
              New enquiry
            </Button>
          </>
        }
      />

      {leads.length > 0 && (
        <FilterBar
          f={filters}
          set={(patch) => setFilters((f) => ({ ...f, ...patch }))}
          board={view === 'board'}
          sort={sort}
          onSort={setSort}
          shown={shown.length}
          total={leads.length}
          onClear={() => setFilters(EMPTY_FILTERS)}
        />
      )}

      {leads.length === 0 ? (
        <Card>
          <Empty icon={<Target size={20} />} title="No enquiries yet" hint="Record the first one to start the pipeline." />
        </Card>
      ) : shown.length === 0 ? (
        <Card>
          <Empty icon={<SearchX size={20} />} title="No leads match these filters" hint="Try a different search, or clear the filters." action={<Button onClick={() => setFilters(EMPTY_FILTERS)}>Clear filters</Button>} />
        </Card>
      ) : view === 'board' ? (
        <Board leads={shown} onOpen={(id) => setParams({ open: id })} />
      ) : (
        <Card>
          <div className="@container overflow-x-auto">
            <table className="stack w-full min-w-[860px] text-sm">
              <thead className="border-b border-ink-100 bg-ink-50/60">
                <tr>
                  <Th>Lead</Th>
                  <Th>Enquired about</Th>
                  <Th>Status</Th>
                  <Th>Follow-up</Th>
                  <Th>Handled by</Th>
                  <Th>Last remark</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {shown.map((l) => (
                  <tr key={l.id} onClick={() => setParams({ open: l.id })} className="cursor-pointer hover:bg-brand-50/40">
                    <Td>
                      <p className="font-semibold text-ink-900">{l.name}</p>
                      <p className="flex items-center gap-1.5 text-xs text-ink-500">
                        {l.contact} · <PhoneLink phone={l.phone} />
                        <WhatsAppLink number={l.whatsapp} compact />
                      </p>
                    </Td>
                    <Td label="Enquired about">
                      <ScopeChips scopes={l.scopes} />
                    </Td>
                    <Td label="Status">
                      <Badge tone={LEAD_STATUS[l.status].tone} dot>
                        {LEAD_STATUS[l.status].label}
                      </Badge>
                    </Td>
                    <Td label="Follow-up" className="text-[13px]">
                      {isOpen(l) && l.nextFollowUp ? <Due date={l.nextFollowUp} /> : <span className="text-ink-400">—</span>}
                    </Td>
                    <Td label="Handled by">
                      <Person emp={emp(l.ownerId)} size={22} />
                    </Td>
                    <Td label="Last remark" className="col-span-full text-[13px] text-ink-600 @3xl:max-w-64 @3xl:truncate">
                      {l.remarks[l.remarks.length - 1]?.text}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {open && <LeadDrawer lead={open} onClose={() => setParams({})} />}
      {params.get('new') && <LeadForm onClose={() => setParams({})} />}
    </>
  )
}

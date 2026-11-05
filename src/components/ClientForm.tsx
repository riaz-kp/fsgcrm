import { Check, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { associatesOf } from '../lib/exports'
import { cn } from '../lib/format'
import { CATEGORIES, pruneScopeDetails } from '../lib/meta'
import { useScopes, useStore } from '../store'
import type { Client, ClientCategory, ScopeDetails, ScopeKey } from '../types'
import { Button, Field, Input, Modal, Select } from './ui'

export function ScopePicker({
  value,
  onChange,
  details,
  onDetails,
}: {
  value: ScopeKey[]
  onChange: (v: ScopeKey[]) => void
  details: ScopeDetails
  onDetails: (v: ScopeDetails) => void
}) {
  const scopes = useScopes()
  const toggle = (k: ScopeKey) => onChange(value.includes(k) ? value.filter((x) => x !== k) : [...value, k])
  return (
    <div className="space-y-3">
      {scopes.groups.map((g) => (
        <div key={g}>
          <p className="mb-1.5 text-[11px] font-bold tracking-wider text-ink-400 uppercase">{g}</p>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {scopes.list.filter((s) => s.group === g).map((s) => {
              const on = value.includes(s.key)
              return (
                <button
                  key={s.key}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => toggle(s.key)}
                  className={cn(
                    'flex h-9 items-center gap-2 rounded-lg px-2.5 text-left text-[13px] font-semibold ring-1 transition-colors ring-inset',
                    on ? 'bg-brand-50 text-brand-800 ring-brand-300' : 'bg-white text-ink-600 ring-ink-200 hover:bg-ink-50',
                  )}
                >
                  <span className={cn('flex size-4 shrink-0 items-center justify-center rounded', on ? 'bg-brand-600 text-white' : 'ring-1 ring-ink-300 ring-inset')}>
                    {on && <Check size={12} strokeWidth={3.5} />}
                  </span>
                  <span className="truncate">{s.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
      {scopes.list.filter((s) => s.detailHint && value.includes(s.key)).map((s) => (
        <Field key={s.key} label={`${s.label} · details`}>
          <Input value={details[s.key] ?? ''} onChange={(e) => onDetails({ ...details, [s.key]: e.target.value })} placeholder={s.detailHint} />
        </Field>
      ))}
    </div>
  )
}

/** Other clients this one goes with: picked by typing part of a name, code, phone or PAN. */
function AssociatePicker({ self, value, onChange }: { self?: string; value: string[]; onChange: (ids: string[]) => void }) {
  const clients = useStore((s) => s.clients)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const byId = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients])
  const term = q.trim().toLowerCase()
  const matches = useMemo(
    () =>
      term
        ? clients
            .filter((c) => c.id !== self && !value.includes(c.id) && [c.name, c.code, c.phone, c.pan, c.contactPerson].some((v) => v?.toLowerCase().includes(term)))
            .slice(0, 8)
        : [],
    [clients, term, self, value],
  )
  const add = (id: string) => {
    onChange([...value, id])
    setQ('')
  }

  return (
    <div>
      <p className="mb-1.5 flex items-baseline justify-between text-[13px] font-semibold text-ink-700">
        In association with
        <span className="font-normal text-ink-400">the same person's other businesses</span>
      </p>
      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.map((id) => {
            const c = byId.get(id)
            if (!c) return null
            return (
              <span key={id} className="inline-flex max-w-full items-center gap-1 rounded-md bg-brand-50 py-1 pr-1 pl-2 text-[13px] font-semibold text-brand-800 ring-1 ring-brand-200 ring-inset">
                <span className="truncate">{c.name}</span>
                <span className="tnum font-medium text-brand-600">{c.code}</span>
                <button type="button" onClick={() => onChange(value.filter((x) => x !== id))} aria-label={`Unlink ${c.name}`} title="Unlink" className="rounded p-0.5 hover:bg-brand-100">
                  <X size={13} />
                </button>
              </span>
            )
          })}
        </div>
      )}
      <div className="relative">
        <Search size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-400" />
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (matches[0]) add(matches[0].id)
            }
          }}
          placeholder="Find a client by name, code, phone or PAN"
          aria-label="Link another client"
          className="pl-8"
        />
        {open && term && (
          <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-lg bg-white py-1 shadow-pop ring-1 ring-ink-200">
            {matches.length === 0 ? (
              <li className="px-3 py-2 text-[13px] text-ink-500">No other client matches</li>
            ) : (
              matches.map((c) => (
                <li key={c.id}>
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => add(c.id)} className="flex w-full items-baseline gap-2 px-3 py-1.5 text-left hover:bg-ink-50">
                    <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink-800">{c.name}</span>
                    <span className="tnum shrink-0 text-xs text-ink-500">
                      {c.code} · {c.place || c.category}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </div>
  )
}

export default function ClientForm({ client, onClose, onSaved }: { client?: Client; onClose: () => void; onSaved?: (id: string) => void }) {
  const addClient = useStore((s) => s.addClient)
  const updateClient = useStore((s) => s.updateClient)
  const setAssociates = useStore((s) => s.setAssociates)
  const scopeDefs = useStore((s) => s.scopes)
  const clients = useStore((s) => s.clients)
  const [f, setF] = useState({
    name: client?.name ?? '',
    category: client?.category ?? ('Proprietorship' as ClientCategory),
    profession: client?.profession ?? '',
    business: client?.business ?? '',
    place: client?.place ?? '',
    phone: client?.phone ?? '',
    whatsapp: client?.whatsapp ?? '',
    email: client?.email ?? '',
    gstin: client?.gstin ?? '',
    pan: client?.pan ?? '',
    tan: client?.tan ?? '',
    gstFrequency: client?.gstFrequency ?? ('M' as 'M' | 'Q'),
    contactPerson: client?.contactPerson ?? '',
    scopes: client?.scopes ?? ([] as ScopeKey[]),
    scopeDetails: client?.scopeDetails ?? ({} as ScopeDetails),
    associates: client ? associatesOf(client, clients).map((c) => c.id) : ([] as string[]),
  })
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }))
  const valid = f.name.trim() && f.phone.trim()

  const save = () => {
    if (!valid) return
    const hasGst = f.scopes.includes('gst_filing')
    const data = {
      name: f.name.trim(),
      category: f.category,
      profession: f.category === 'Individual' ? f.profession.trim() || undefined : undefined,
      // An individual is spoken to directly; a business through someone there.
      contactPerson: f.category === 'Individual' ? undefined : f.contactPerson.trim() || undefined,
      business: f.business.trim(),
      place: f.place.trim(),
      phone: f.phone.trim(),
      whatsapp: f.whatsapp.trim() || undefined,
      email: f.email.trim(),
      gstin: f.gstin.trim() || undefined,
      pan: f.pan.trim() || undefined,
      tan: f.tan.trim() || undefined,
      gstFrequency: hasGst ? f.gstFrequency : undefined,
      scopes: f.scopes,
      scopeDetails: pruneScopeDetails(f.scopes, f.scopeDetails, scopeDefs),
    }
    let id = client?.id
    if (id) updateClient(id, data)
    else id = addClient({ ...data, active: true, credentials: [], documents: [] })
    setAssociates(id, f.associates)
    // Close first: the caller may navigate in onSaved, and that must win.
    onClose()
    onSaved?.(id)
  }

  return (
    <Modal
      wide
      title={client ? 'Edit client' : 'New client'}
      subtitle={client ? client.code : 'Portal logins and documents can be added after saving.'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={!valid}>
            {client ? 'Save changes' : 'Add client'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Client name" className="sm:col-span-2">
          <Input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Malabar Spice Traders" autoFocus />
        </Field>
        <Field label="Category">
          <Select value={f.category} onChange={(e) => set('category', e.target.value as ClientCategory)}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        {f.category === 'Individual' ? (
          <Field label="Profession">
            <Input value={f.profession} onChange={(e) => set('profession', e.target.value)} placeholder="Doctor, salaried, commission…" />
          </Field>
        ) : (
          <Field label="Nature of business">
            <Input value={f.business} onChange={(e) => set('business', e.target.value)} placeholder="e.g. Textile retail" />
          </Field>
        )}
        {f.category !== 'Individual' && (
          <Field label="Contact person" hint="who to speak to" className="sm:col-span-2">
            <Input value={f.contactPerson} onChange={(e) => set('contactPerson', e.target.value)} placeholder="e.g. the owner, a partner or the accountant" />
          </Field>
        )}
        <Field label="Phone">
          <Input value={f.phone} onChange={(e) => set('phone', e.target.value)} inputMode="tel" />
        </Field>
        <div>
          <Field label="WhatsApp number" hint="optional">
            <Input value={f.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} inputMode="tel" />
          </Field>
          {f.phone.trim() && f.whatsapp.trim() !== f.phone.trim() && (
            <button type="button" onClick={() => set('whatsapp', f.phone.trim())} className="mt-1 text-xs font-semibold text-brand-700 hover:underline">
              Same as phone
            </button>
          )}
        </div>
        <Field label="Email" hint="optional">
          <Input value={f.email} onChange={(e) => set('email', e.target.value)} type="email" />
        </Field>
        <Field label="Place">
          <Input value={f.place} onChange={(e) => set('place', e.target.value)} />
        </Field>
        <Field label="PAN" hint="optional">
          <Input value={f.pan} onChange={(e) => set('pan', e.target.value.toUpperCase())} maxLength={10} className="tnum uppercase" />
        </Field>

        <div className="sm:col-span-2">
          <AssociatePicker self={client?.id} value={f.associates} onChange={(v) => set('associates', v)} />
        </div>

        <div className="sm:col-span-2">
          <p className="mb-1.5 text-[13px] font-semibold text-ink-700">Scope of work</p>
          <ScopePicker value={f.scopes} onChange={(v) => set('scopes', v)} details={f.scopeDetails} onDetails={(v) => set('scopeDetails', v)} />
        </div>

        {f.scopes.includes('gst_filing') && (
          <>
            <Field label="GSTIN" hint="optional">
              <Input value={f.gstin} onChange={(e) => set('gstin', e.target.value.toUpperCase())} maxLength={15} className="tnum uppercase" />
            </Field>
            <Field label="GST return frequency">
              <Select value={f.gstFrequency} onChange={(e) => set('gstFrequency', e.target.value as 'M' | 'Q')}>
                <option value="M">Monthly</option>
                <option value="Q">Quarterly (QRMP)</option>
              </Select>
            </Field>
          </>
        )}
        {f.scopes.includes('tds') && (
          <Field label="TAN" hint="optional">
            <Input value={f.tan} onChange={(e) => set('tan', e.target.value.toUpperCase())} maxLength={10} className="tnum uppercase" />
          </Field>
        )}
      </div>
    </Modal>
  )
}

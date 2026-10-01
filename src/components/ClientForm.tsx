import { Check } from 'lucide-react'
import { useState } from 'react'
import { cn } from '../lib/format'
import { CATEGORIES, SCOPE_GROUPS, SCOPES, pruneScopeDetails } from '../lib/meta'
import { useStore } from '../store'
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
  const toggle = (k: ScopeKey) => onChange(value.includes(k) ? value.filter((x) => x !== k) : [...value, k])
  return (
    <div className="space-y-3">
      {SCOPE_GROUPS.map((g) => (
        <div key={g}>
          <p className="mb-1.5 text-[11px] font-bold tracking-wider text-ink-400 uppercase">{g}</p>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {SCOPES.filter((s) => s.group === g).map((s) => {
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
      {SCOPES.filter((s) => s.detailHint && value.includes(s.key)).map((s) => (
        <Field key={s.key} label={`${s.label} · details`}>
          <Input value={details[s.key] ?? ''} onChange={(e) => onDetails({ ...details, [s.key]: e.target.value })} placeholder={s.detailHint} />
        </Field>
      ))}
    </div>
  )
}

export default function ClientForm({ client, onClose, onSaved }: { client?: Client; onClose: () => void; onSaved?: (id: string) => void }) {
  const addClient = useStore((s) => s.addClient)
  const updateClient = useStore((s) => s.updateClient)
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
    scopes: client?.scopes ?? ([] as ScopeKey[]),
    scopeDetails: client?.scopeDetails ?? ({} as ScopeDetails),
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
      scopeDetails: pruneScopeDetails(f.scopes, f.scopeDetails),
    }
    let id = client?.id
    if (id) updateClient(id, data)
    else id = addClient({ ...data, active: true, credentials: [], documents: [] })
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

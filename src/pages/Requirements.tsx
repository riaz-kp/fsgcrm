import { ArrowRight, Check, ClipboardList, Copy, FileDown, Info, Loader2, MessageCircle, Send, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Badge, Button, Card, CardHeader, Empty, Field, IconButton, Input, LinkButton, PageHeader, Select, Td, Th } from '../components/ui'
import { CHECKLISTS, GENERAL_NOTE, QUICK_REFERENCE, checklistTitle, checklistsFor, type Checklist } from '../data/requirements'
import { cn, fmtDate, todayISO, whatsappHref } from '../lib/format'
import { CATEGORY_TONE, FIRM_NAME, fillTemplate } from '../lib/meta'
import { downloadRequirementsPdf, type PdfList } from '../lib/requirementsPdf'
import { greetingFor } from '../lib/statusMessage'
import { useCurrentUser, useScopes, useStore, useTemplate } from '../store'
import type { Client } from '../types'

/** Lists sharing a service (the four GST registrations) sit under one heading in the picker. */
const SERVICES = [...new Set(CHECKLISTS.map((c) => c.service))].map((service) => ({ service, lists: CHECKLISTS.filter((c) => c.service === service) }))

const itemKey = (list: string, section: number, item: number) => `${list}/${section}/${item}`

function Tickbox({ on, className }: { on: boolean; className?: string }) {
  return (
    <span className={cn('flex size-4 shrink-0 items-center justify-center rounded', on ? 'bg-brand-600 text-white' : 'bg-white ring-1 ring-ink-300 ring-inset', className)}>
      {on && <Check size={12} strokeWidth={3.5} />}
    </span>
  )
}

/** "A, B and C" */
function joinAnd(parts: string[]): string {
  return parts.length < 2 ? (parts[0] ?? '') : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`
}

/** The ticked documents as WhatsApp text: bold list names, italic section names, a bullet per document. */
function checklistText(lists: PdfList[]): string {
  return lists
    .map((l) =>
      [
        `*${l.title}*`,
        ...l.sections.flatMap((s) => [
          `_${s.title}_`,
          ...s.items.map((i) => `• ${i.text}${i.note ? ` (${i.note})` : ''}${i.parts ? `: ${i.parts.join(', ')}` : ''}`),
        ]),
      ].join('\n'),
    )
    .join('\n\n')
}

export default function Requirements() {
  const me = useCurrentUser()
  const clients = useStore((s) => s.clients)
  const updateClient = useStore((s) => s.updateClient)
  const scopes = useScopes()
  const template = useTemplate('requirements')
  const [params, setParams] = useSearchParams()
  const client = clients.find((c) => c.id === params.get('client'))
  const [name, setName] = useState('')
  // Opened from a client's page, the lists for that client's scopes and category are picked to begin with.
  const [picked, setPicked] = useState<string[]>(() => (client ? checklistsFor(client).map((c) => c.id) : []))
  const [skipped, setSkipped] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [marked, setMarked] = useState(false)

  const pickClient = (c?: Client) => {
    setParams(c ? { client: c.id } : {}, { replace: true })
    setMarked(false)
    const suits = c ? checklistsFor(c).map((x) => x.id) : []
    if (suits.length) setPicked(suits)
  }
  const toggleList = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  const toggleItem = (key: string) =>
    setSkipped((prev) => {
      const next = new Set(prev)
      if (!next.delete(key)) next.add(key)
      return next
    })

  const lists = CHECKLISTS.filter((c) => picked.includes(c.id))
  const suits = useMemo(() => new Set(client ? checklistsFor(client).map((c) => c.id) : []), [client])

  // What goes out: the picked lists with only the ticked documents, and nothing left empty.
  const output: PdfList[] = lists
    .map((l) => ({
      title: checklistTitle(l),
      note: l.note,
      sections: l.sections
        .map((s, si) => ({ title: s.title, items: s.items.filter((_, ii) => !skipped.has(itemKey(l.id, si, ii))) }))
        .filter((s) => s.items.length),
    }))
    .filter((l) => l.sections.length)
  const count = output.reduce((n, l) => n + l.sections.reduce((m, s) => m + s.items.length, 0), 0)
  const forName = client?.name ?? (name.trim() || undefined)

  const services = joinAnd(lists.map((l) => (l.variant ? `${l.service} (${l.variant})` : l.service)))
  const message = fillTemplate(template, {
    greeting: greetingFor(client),
    client: forName ?? 'you',
    services,
    checklist: checklistText(output),
    staff: me.name,
    firm: FIRM_NAME,
  })
  const number = client?.whatsapp || client?.phone
  // Without a number WhatsApp asks which chat to send it to.
  const waHref = `${number ? whatsappHref(number) : 'https://wa.me/'}?text=${encodeURIComponent(message)}`

  // Which of the client's scopes these lists are the requirements for.
  const covered = client ? [...new Set(lists.flatMap((l) => l.scopes))].filter((s) => client.scopes.includes(s)) : []
  const markSent = () => {
    if (!client || !covered.length) return
    const next = { ...client.requirementsSent }
    for (const s of covered) next[s] = todayISO()
    updateClient(client.id, { requirementsSent: next })
    setMarked(true)
  }

  const exportPdf = async () => {
    setBusy(true)
    try {
      await downloadRequirementsPdf({ forName, preparedBy: me.name, date: fmtDate(todayISO(), true), summary: services, generalNote: GENERAL_NOTE, lists: output })
    } finally {
      setBusy(false)
    }
  }
  const copy = () => {
    void navigator.clipboard?.writeText(message)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <>
      <PageHeader
        title="Requirements"
        subtitle="Document checklists for registrations and applications. Tick what is needed, then export a PDF or send it on WhatsApp."
        actions={
          <>
            <Button icon={copied ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />} onClick={copy} disabled={!count}>
              {copied ? 'Copied' : 'Copy text'}
            </Button>
            {count ? (
              <LinkButton icon={<MessageCircle size={15} className="text-emerald-600" />} href={waHref} target="_blank" rel="noreferrer">
                Send on WhatsApp
              </LinkButton>
            ) : (
              <Button icon={<MessageCircle size={15} />} disabled>
                Send on WhatsApp
              </Button>
            )}
            <Button variant="primary" icon={busy ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />} onClick={exportPdf} disabled={!count || busy}>
              Export PDF
            </Button>
          </>
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="For" hint="The PDF and message are addressed to them" />
            <div className="space-y-3 px-5 pb-5">
              <Field label="Client">
                <Select value={client?.id ?? ''} onChange={(e) => pickClient(clients.find((c) => c.id === e.target.value))}>
                  <option value="">Not a client yet</option>
                  {clients
                    .filter((c) => c.active || c.id === client?.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </Select>
              </Field>
              {client ? (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px]">
                  <Badge tone={CATEGORY_TONE[client.category]}>{client.category}</Badge>
                  <span className="text-ink-500">{client.whatsapp || client.phone ? `WhatsApp ${client.whatsapp || client.phone}` : 'No number saved'}</span>
                  <Link to={`/clients/${client.id}`} className="ml-auto inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline">
                    Open client <ArrowRight size={13} />
                  </Link>
                </div>
              ) : (
                <Field label="Or name" hint="optional">
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Lead or new customer" />
                </Field>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Checklists" hint={client ? 'Those marked suit this client' : 'Pick one or more'} />
            <div className="space-y-3 px-5 pb-5">
              {SERVICES.map(({ service, lists: options }) => (
                <div key={service}>
                  {options.length > 1 && <p className="mb-1.5 text-[11px] font-bold tracking-wider text-ink-400 uppercase">{service}</p>}
                  <div className={cn('grid gap-1.5', options.length > 1 && 'grid-cols-2')}>
                    {options.map((c) => {
                      const on = picked.includes(c.id)
                      return (
                        <button
                          key={c.id}
                          type="button"
                          role="checkbox"
                          aria-checked={on}
                          onClick={() => toggleList(c.id)}
                          className={cn(
                            'flex min-h-9 items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] font-semibold ring-1 transition-colors ring-inset',
                            on ? 'bg-brand-50 text-brand-800 ring-brand-300' : 'bg-white text-ink-600 ring-ink-200 hover:bg-ink-50',
                          )}
                        >
                          <Tickbox on={on} />
                          <span className="min-w-0 flex-1">{c.variant ?? c.service}</span>
                          {suits.has(c.id) && <Badge tone="green">Suits</Badge>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {client && (
            <Card>
              <CardHeader title="Requirements sent" hint="On the client's page, scope by scope" />
              <div className="space-y-3 px-5 pb-5">
                {client.scopes.length === 0 ? (
                  <p className="text-[13px] text-ink-500">This client has no scope of work yet.</p>
                ) : (
                  <ul className="space-y-1.5 text-[13px]">
                    {client.scopes.map((s) => (
                      <li key={s} className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate font-semibold text-ink-700">{scopes.label(s)}</span>
                        {client.requirementsSent[s] ? (
                          <Badge tone="green" dot>
                            Sent {fmtDate(client.requirementsSent[s]!)}
                          </Badge>
                        ) : (
                          <Badge tone="amber" dot>
                            Not sent
                          </Badge>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                <Button icon={marked ? <Check size={15} className="text-emerald-600" /> : <Send size={15} />} onClick={markSent} disabled={!covered.length} className="w-full">
                  {marked ? 'Marked as sent today' : 'Mark requirements sent'}
                </Button>
                <p className="text-xs text-ink-500">
                  {covered.length
                    ? `Dates ${joinAnd(covered.map(scopes.label))} as sent today, once the list has gone to the client.`
                    : 'None of the lists picked is for a scope this client has, so there is nothing to mark.'}
                </p>
              </div>
            </Card>
          )}
        </div>

        <Card className="lg:col-span-3">
          <CardHeader
            title={forName ? `Documents required from ${forName}` : 'Documents required'}
            hint={lists.length ? `${count} ticked · untick anything the client need not send` : undefined}
          />
          {lists.length === 0 ? (
            <Empty icon={<ClipboardList size={20} />} title="No checklist picked" hint="Pick a registration or application on the left to see what the client has to send." />
          ) : (
            <div className="pb-3">
              <p className="mx-5 mb-4 flex items-start gap-2 rounded-lg bg-ink-50 px-3 py-2.5 text-[13px] text-ink-700 ring-1 ring-ink-200/70">
                <Info size={15} className="mt-0.5 shrink-0 text-brand-600" />
                {GENERAL_NOTE}
              </p>
              {lists.map((l: Checklist) => (
                <section key={l.id} className="border-t border-ink-100 px-5 py-4">
                  <header className="mb-3 flex items-start justify-between gap-3">
                    <h3 className="text-[15px] font-extrabold text-brand-800">{checklistTitle(l)}</h3>
                    <IconButton label={`Remove ${checklistTitle(l)}`} onClick={() => toggleList(l.id)} className="-mt-1 -mr-2">
                      <X size={16} />
                    </IconButton>
                  </header>
                  <div className="space-y-4">
                    {l.sections.map((s, si) => (
                      <div key={s.title}>
                        <p className="mb-1.5 text-[11px] font-bold tracking-wider text-ink-400 uppercase">{s.title}</p>
                        <ul className="grid gap-x-4 gap-y-0.5 sm:grid-cols-2">
                          {s.items.map((item, ii) => {
                            const key = itemKey(l.id, si, ii)
                            const on = !skipped.has(key)
                            return (
                              <li key={key} className={cn(item.parts && 'sm:col-span-2')}>
                                <button
                                  type="button"
                                  role="checkbox"
                                  aria-checked={on}
                                  onClick={() => toggleItem(key)}
                                  className="flex w-full items-start gap-2.5 rounded-md px-1.5 py-1 text-left text-sm hover:bg-ink-50"
                                >
                                  <Tickbox on={on} className="mt-0.5" />
                                  <span className={cn('min-w-0', on ? 'text-ink-800' : 'text-ink-400 line-through')}>
                                    {item.text}
                                    {item.note && <span className="text-ink-500"> · {item.note}</span>}
                                    {item.parts && <span className="mt-0.5 block text-[13px] text-ink-500">{item.parts.join(' · ')}</span>}
                                  </span>
                                </button>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                  {l.note && <p className="mt-3 text-[13px] text-ink-500 italic">{l.note}</p>}
                </section>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Quick reference" hint="Every service also needs an Aadhaar-linked mobile number and an email ID" />
        <div className="@container overflow-x-auto">
          <table className="stack w-full min-w-[720px] text-sm">
            <thead className="border-y border-ink-100 bg-ink-50/60">
              <tr>
                <Th>Service</Th>
                <Th>PAN</Th>
                <Th>Aadhaar</Th>
                <Th>Other documents and details</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {QUICK_REFERENCE.map((r) => (
                <tr key={r.service}>
                  <Td className="font-semibold text-ink-800">{r.service}</Td>
                  <Td label="PAN" className="text-ink-600">
                    {r.pan}
                  </Td>
                  <Td label="Aadhaar" className="text-ink-600">
                    {r.aadhaar}
                  </Td>
                  <Td label="Other documents and details" className="col-span-full text-ink-600">
                    {r.other}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-ink-100 px-5 py-3 text-xs text-ink-500">
          For GST registration the papers can vary with the constitution of the business and whether the premises are owned, rented or shared. For an LLP, "shareholding pattern" means the partners' contribution and profit-sharing arrangement.
        </p>
      </Card>
    </>
  )
}

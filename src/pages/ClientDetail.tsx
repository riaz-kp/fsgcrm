import {
  ArrowLeft,
  Check,
  Copy,
  Eye,
  EyeOff,
  FileArchive,
  FileSpreadsheet,
  FileText,
  KeyRound,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Due } from '../components/bits'
import ClientForm from '../components/ClientForm'
import { Avatar, Badge, Button, Card, CardHeader, Empty, Field, IconButton, Input, Person, Progress, Segmented, Select, Td, Th } from '../components/ui'
import { statutoryDeadlines } from '../lib/deadlines'
import { addDays, cn, currentGstPeriod, daysUntil, fileSize, fmtDate, periodLabel, todayISO, uid } from '../lib/format'
import { CATEGORY_TONE, DEPARTMENTS, DOC_KINDS, GST_STATUS, PORTALS, SCOPES, SIMPLE_STATUS, TASK_STATUS } from '../lib/meta'
import { useLookup, useStore } from '../store'
import type { Client, Credential, DocKind, Portal } from '../types'

type Tab = 'overview' | 'logins' | 'documents' | 'work'

function Detail({ icon, label, children }: { icon?: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <dt className="flex w-36 shrink-0 items-center gap-2 text-[13px] text-ink-500">
        {icon}
        {label}
      </dt>
      <dd className="min-w-0 flex-1 font-medium break-words text-ink-800">{children || <span className="font-normal text-ink-400">—</span>}</dd>
    </div>
  )
}

function Overview({ client }: { client: Client }) {
  const toggleScope = useStore((s) => s.toggleScope)
  const groups = useMemo(() => [...new Set(SCOPES.map((s) => s.group))], [])
  const deadlines = useMemo(() => {
    const today = todayISO()
    return statutoryDeadlines(today, addDays(today, 120))
      .filter((d) => d.applies(client))
      .slice(0, 6)
  }, [client])

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Card className="lg:col-span-2">
        <CardHeader title="Details" />
        <dl className="divide-y divide-ink-100 px-5 pb-3 text-sm">
          <Detail label="Category">
            <Badge tone={CATEGORY_TONE[client.category]}>{client.category}</Badge>
          </Detail>
          {client.profession && <Detail label="Profession">{client.profession}</Detail>}
          <Detail label="Nature of business">{client.business}</Detail>
          <Detail label="Place" icon={<MapPin size={14} />}>
            {client.place}
          </Detail>
          <Detail label="Phone" icon={<Phone size={14} />}>
            <span className="tnum">{client.phone}</span>
          </Detail>
          <Detail label="Email" icon={<Mail size={14} />}>
            {client.email}
          </Detail>
          <Detail label="PAN">
            <span className="tnum">{client.pan}</span>
          </Detail>
          {client.gstin && (
            <Detail label="GSTIN">
              <span className="tnum">{client.gstin}</span>
              <Badge className="ml-2">{client.gstFrequency === 'Q' ? 'Quarterly' : 'Monthly'}</Badge>
            </Detail>
          )}
          {client.tan && (
            <Detail label="TAN">
              <span className="tnum">{client.tan}</span>
            </Detail>
          )}
          <Detail label="Client since">{fmtDate(client.since, true)}</Detail>
        </dl>
      </Card>

      <div className="space-y-4 lg:col-span-3">
        <Card>
          <CardHeader title="Scope of work" hint="Tick what FSG handles for this client. Deadlines and trackers follow from this." />
          <div className="space-y-4 px-5 pb-5">
            {groups.map((g) => (
              <div key={g}>
                <p className="mb-1.5 text-[11px] font-bold tracking-wider text-ink-400 uppercase">{g}</p>
                <div className="flex flex-wrap gap-1.5">
                  {SCOPES.filter((s) => s.group === g).map((s) => {
                    const on = client.scopes.includes(s.key)
                    return (
                      <button
                        key={s.key}
                        type="button"
                        role="checkbox"
                        aria-checked={on}
                        onClick={() => toggleScope(client.id, s.key)}
                        className={cn(
                          'inline-flex h-8 items-center gap-2 rounded-lg pr-3 pl-2 text-[13px] font-semibold ring-1 transition-colors ring-inset',
                          on ? 'bg-brand-50 text-brand-800 ring-brand-300' : 'bg-white text-ink-500 ring-ink-200 hover:bg-ink-50',
                        )}
                      >
                        <span className={cn('flex size-4 items-center justify-center rounded', on ? 'bg-brand-600 text-white' : 'ring-1 ring-ink-300 ring-inset')}>
                          {on && <Check size={12} strokeWidth={3.5} />}
                        </span>
                        {s.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Deadlines for this client" hint="Worked out from the ticked scopes" />
          {deadlines.length === 0 ? (
            <p className="px-5 pb-5 text-[13px] text-ink-500">
              {client.active ? 'No statutory dates in the next four months for the ticked scopes.' : 'Inactive clients are left out of reminders.'}
            </p>
          ) : (
            <ul className="divide-y divide-ink-100 pb-2">
              {deadlines.map((d) => (
                <li key={d.id} className="flex items-center gap-3 px-5 py-2.5">
                  <Badge tone={DEPARTMENTS[d.dept].tone}>{DEPARTMENTS[d.dept].label}</Badge>
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-semibold text-ink-800">{d.title}</span> <span className="text-ink-500">· {d.detail}</span>
                  </span>
                  <span className="text-[13px]">
                    <Due date={d.date} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}

function Logins({ client }: { client: Client }) {
  const updateClient = useStore((s) => s.updateClient)
  const [shown, setShown] = useState<Set<Portal>>(new Set())
  const [copied, setCopied] = useState('')
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<Credential>({ portal: 'gst', username: '', password: '' })
  const free = (Object.keys(PORTALS) as Portal[]).filter((p) => !client.credentials.some((c) => c.portal === p))

  const copy = (key: string, text: string) => {
    void navigator.clipboard?.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(''), 1200)
  }
  const toggle = (p: Portal) =>
    setShown((prev) => {
      const next = new Set(prev)
      if (!next.delete(p)) next.add(p)
      return next
    })
  const remove = (p: Portal) => updateClient(client.id, { credentials: client.credentials.filter((c) => c.portal !== p) })
  const save = () => {
    if (!draft.username.trim() || !draft.password) return
    updateClient(client.id, { credentials: [...client.credentials, { ...draft, username: draft.username.trim() }] })
    setAdding(false)
  }

  return (
    <Card>
      <CardHeader
        title="Portal logins"
        hint="One place for the usernames and passwords now kept in the Excel sheets"
        action={
          free.length > 0 && (
            <Button
              size="sm"
              icon={<Plus size={15} />}
              onClick={() => {
                setDraft({ portal: free[0], username: '', password: '' })
                setAdding(true)
              }}
            >
              Add login
            </Button>
          )
        }
      />
      {client.credentials.length === 0 && !adding ? (
        <Empty icon={<KeyRound size={20} />} title="No logins saved yet" hint="Add the GST, e-way bill, income tax or TRACES login for this client." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="border-y border-ink-100 bg-ink-50/60">
              <tr>
                <Th>Portal</Th>
                <Th>Username</Th>
                <Th>Password</Th>
                <Th />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {client.credentials.map((c) => {
                const visible = shown.has(c.portal)
                return (
                  <tr key={c.portal}>
                    <Td>
                      <p className="font-semibold text-ink-800">{PORTALS[c.portal].label}</p>
                      <p className="text-xs text-ink-500">{PORTALS[c.portal].hint}</p>
                    </Td>
                    <Td>
                      <span className="inline-flex items-center gap-1">
                        <code className="tnum rounded bg-ink-50 px-1.5 py-0.5 text-[13px] text-ink-800">{c.username}</code>
                        <IconButton label="Copy username" onClick={() => copy(`${c.portal}-u`, c.username)}>
                          {copied === `${c.portal}-u` ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                        </IconButton>
                      </span>
                    </Td>
                    <Td>
                      <span className="inline-flex items-center gap-1">
                        <code className="tnum rounded bg-ink-50 px-1.5 py-0.5 text-[13px] text-ink-800">
                          {visible ? c.password : '•'.repeat(10)}
                        </code>
                        <IconButton label={visible ? 'Hide password' : 'Show password'} onClick={() => toggle(c.portal)}>
                          {visible ? <EyeOff size={14} /> : <Eye size={14} />}
                        </IconButton>
                        <IconButton label="Copy password" onClick={() => copy(`${c.portal}-p`, c.password)}>
                          {copied === `${c.portal}-p` ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                        </IconButton>
                      </span>
                    </Td>
                    <Td className="text-right">
                      <IconButton label={`Remove ${PORTALS[c.portal].label} login`} onClick={() => remove(c.portal)} className="hover:text-rose-600">
                        <Trash2 size={14} />
                      </IconButton>
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {adding && (
        <div className="grid items-end gap-3 border-t border-ink-100 bg-ink-50/50 p-4 sm:grid-cols-[1.2fr_1fr_1fr_auto]">
          <Field label="Portal">
            <Select value={draft.portal} onChange={(e) => setDraft({ ...draft, portal: e.target.value as Portal })}>
              {free.map((p) => (
                <option key={p} value={p}>
                  {PORTALS[p].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Username">
            <Input value={draft.username} onChange={(e) => setDraft({ ...draft, username: e.target.value })} autoFocus autoComplete="off" />
          </Field>
          <Field label="Password">
            <Input value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} autoComplete="off" />
          </Field>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={save} disabled={!draft.username.trim() || !draft.password}>
              Save
            </Button>
          </div>
        </div>
      )}

      <p className="flex items-start gap-2 border-t border-ink-100 px-5 py-3 text-xs text-ink-500">
        <ShieldCheck size={14} className="mt-px shrink-0 text-emerald-600" />
        These are sample logins. In the live system passwords would be stored encrypted and limited to the staff working on the client.
      </p>
    </Card>
  )
}

const DOC_ICON: Record<DocKind, ReactNode> = {
  Aadhaar: <FileText size={18} />,
  PAN: <FileText size={18} />,
  'Financial statement': <FileSpreadsheet size={18} />,
  'Tally backup': <FileArchive size={18} />,
  Bills: <FileArchive size={18} />,
  Other: <FileText size={18} />,
}

function Documents({ client }: { client: Client }) {
  const updateClient = useStore((s) => s.updateClient)
  const input = useRef<HTMLInputElement>(null)
  const [kind, setKind] = useState<DocKind>('Aadhaar')

  const onFiles = (files: FileList | null) => {
    if (!files?.length) return
    const added = [...files].map((f) => ({
      id: uid('d'),
      name: f.name,
      kind,
      sizeKb: Math.max(1, Math.round(f.size / 1024)),
      uploadedAt: todayISO(),
    }))
    updateClient(client.id, { documents: [...added, ...client.documents] })
    if (input.current) input.current.value = ''
  }

  return (
    <Card>
      <CardHeader
        title="Documents"
        hint="Aadhaar, PAN, financial statements, Tally backups and bills"
        action={
          <div className="flex items-center gap-2">
            <Select value={kind} onChange={(e) => setKind(e.target.value as DocKind)} small fit aria-label="Document type">
              {DOC_KINDS.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </Select>
            <Button size="sm" variant="primary" icon={<Upload size={15} />} onClick={() => input.current?.click()}>
              Upload
            </Button>
            <input ref={input} type="file" multiple hidden onChange={(e) => onFiles(e.target.files)} />
          </div>
        }
      />
      {client.documents.length === 0 ? (
        <Empty icon={<FileText size={20} />} title="No documents yet" hint="Pick a type and upload the client's Aadhaar, PAN or working files." />
      ) : (
        <ul className="divide-y divide-ink-100 border-t border-ink-100">
          {client.documents.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-5 py-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-ink-50 text-ink-500 ring-1 ring-ink-200/70">
                {DOC_ICON[d.kind]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink-800">{d.name}</p>
                <p className="tnum text-xs text-ink-500">
                  {fileSize(d.sizeKb)} · added {fmtDate(d.uploadedAt, true)}
                </p>
              </div>
              <Badge>{d.kind}</Badge>
              <IconButton
                label={`Remove ${d.name}`}
                onClick={() => updateClient(client.id, { documents: client.documents.filter((x) => x.id !== d.id) })}
                className="hover:text-rose-600"
              >
                <Trash2 size={15} />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
      <p className="border-t border-ink-100 px-5 py-3 text-xs text-ink-500">
        Demo only: the file name and size are recorded, the file itself is not stored anywhere.
      </p>
    </Card>
  )
}

function Work({ client }: { client: Client }) {
  const tasks = useStore((s) => s.tasks)
  const gst = useStore((s) => s.gst)
  const tds = useStore((s) => s.tds)
  const it = useStore((s) => s.it)
  const audits = useStore((s) => s.audits)
  const services = useStore((s) => s.services)
  const { emp } = useLookup()
  const period = currentGstPeriod()

  const mine = tasks.filter((t) => t.clientId === client.id).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const g = gst.find((x) => x.clientId === client.id && x.period === period)
  const t = tds.find((x) => x.clientId === client.id)
  const i = it.find((x) => x.clientId === client.id)
  const a = audits.filter((x) => x.clientId === client.id)
  const s = services.filter((x) => x.clientId === client.id)

  const lines: Array<{ label: string; detail: string; chips: ReactNode }> = []
  if (g)
    lines.push({
      label: 'GST',
      detail: periodLabel(period),
      chips: (
        <>
          <Badge tone={GST_STATUS[g.gstr1].tone}>GSTR-1 · {GST_STATUS[g.gstr1].label}</Badge>
          <Badge tone={GST_STATUS[g.gstr3b].tone}>GSTR-3B · {GST_STATUS[g.gstr3b].label}</Badge>
        </>
      ),
    })
  if (t)
    lines.push({
      label: 'TDS',
      detail: `FY ${t.fy}`,
      chips: t.quarters.map((q, n) => (
        <Badge key={n} tone={SIMPLE_STATUS[q].tone}>
          Q{n + 1} · {SIMPLE_STATUS[q].label}
        </Badge>
      )),
    })
  if (i)
    lines.push({
      label: 'Income tax',
      detail: `AY ${i.ay} · ${i.kind === 'audit' ? 'audit case' : 'non-audit'}`,
      chips: <Badge tone={SIMPLE_STATUS[i.status].tone}>{SIMPLE_STATUS[i.status].label}</Badge>,
    })
  for (const x of a)
    lines.push({ label: x.kind, detail: `FY ${x.fy}`, chips: <Badge tone={SIMPLE_STATUS[x.status].tone}>{SIMPLE_STATUS[x.status].label}</Badge> })
  for (const x of s)
    lines.push({ label: x.kind, detail: `Committed ${fmtDate(x.committedDate)}`, chips: <Badge tone={SIMPLE_STATUS[x.status].tone}>{SIMPLE_STATUS[x.status].label}</Badge> })

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Filing status" action={<Link to="/compliance" className="text-[13px] font-semibold text-brand-700 hover:underline">Open trackers</Link>} />
        {lines.length === 0 ? (
          <p className="px-5 pb-5 text-[13px] text-ink-500">Nothing is being tracked for this client yet.</p>
        ) : (
          <ul className="divide-y divide-ink-100 pb-2">
            {lines.map((l, n) => (
              <li key={n} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-2.5">
                <span className="w-32 shrink-0">
                  <span className="block font-semibold text-ink-800">{l.label}</span>
                  <span className="block text-xs text-ink-500">{l.detail}</span>
                </span>
                <span className="flex flex-wrap gap-1.5">{l.chips}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Tasks" hint={`${mine.filter((x) => x.status !== 'completed').length} open`} />
        {mine.length === 0 ? (
          <p className="px-5 pb-5 text-[13px] text-ink-500">No tasks have been assigned for this client.</p>
        ) : (
          <ul className="divide-y divide-ink-100 pb-2">
            {mine.map((x) => (
              <li key={x.id}>
                <Link to={`/tasks?open=${x.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-ink-50">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-ink-800">{x.title}</span>
                    <span className="mt-1 flex items-center gap-2">
                      <Progress value={x.progress} tone={x.status === 'completed' ? 'green' : daysUntil(x.dueDate) < 0 ? 'red' : 'blue'} className="w-20" />
                      <span className="tnum text-xs text-ink-500">{x.progress}%</span>
                      <Badge tone={TASK_STATUS[x.status].tone}>{TASK_STATUS[x.status].label}</Badge>
                    </span>
                  </span>
                  <span className="text-[13px]">
                    <Due date={x.dueDate} done={x.status === 'completed'} compact />
                  </span>
                  <Person emp={emp(x.assigneeId)} size={24} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

export default function ClientDetail() {
  const { id } = useParams()
  const client = useStore((s) => s.clients.find((c) => c.id === id))
  const updateClient = useStore((s) => s.updateClient)
  const [tab, setTab] = useState<Tab>('overview')
  const [editing, setEditing] = useState(false)

  if (!client) {
    return (
      <Card>
        <Empty title="Client not found" hint="It may have been removed when the sample data was reset." action={<Link to="/clients"><Button>Back to clients</Button></Link>} />
      </Card>
    )
  }

  return (
    <>
      <Link to="/clients" className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-500 hover:text-ink-800">
        <ArrowLeft size={15} /> Clients
      </Link>

      <div className="mb-5 flex flex-wrap items-center gap-4">
        <Avatar name={client.name} hue={(Number(client.code.slice(-3)) * 37) % 360} size={52} square />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[22px] leading-tight font-extrabold tracking-tight text-ink-900">{client.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-500">
            <span className="tnum">{client.code}</span>
            <Badge tone={CATEGORY_TONE[client.category]}>{client.category}</Badge>
            <span>{[client.profession ?? client.business, client.place].filter(Boolean).join(' · ')}</span>
          </p>
        </div>
        <label className="flex items-center gap-2 text-[13px] font-semibold text-ink-600">
          {client.active ? 'Active' : 'Inactive'}
          <button
            type="button"
            role="switch"
            aria-checked={client.active}
            aria-label="Client active"
            onClick={() => updateClient(client.id, { active: !client.active })}
            className={cn('relative h-6 w-10 rounded-full transition-colors', client.active ? 'bg-emerald-500' : 'bg-ink-300')}
          >
            <span className={cn('absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform', client.active && 'translate-x-4')} />
          </button>
        </label>
        <Button icon={<Pencil size={15} />} onClick={() => setEditing(true)}>
          Edit
        </Button>
      </div>

      <div className="mb-4">
        <Segmented
          value={tab}
          onChange={setTab}
          items={[
            { value: 'overview', label: 'Overview' },
            { value: 'logins', label: 'Portal logins', count: client.credentials.length },
            { value: 'documents', label: 'Documents', count: client.documents.length },
            { value: 'work', label: 'Work' },
          ]}
        />
      </div>

      {tab === 'overview' && <Overview client={client} />}
      {tab === 'logins' && <Logins client={client} />}
      {tab === 'documents' && <Documents client={client} />}
      {tab === 'work' && <Work client={client} />}

      {editing && <ClientForm client={client} onClose={() => setEditing(false)} />}
    </>
  )
}

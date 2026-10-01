import {
  ArrowLeft,
  Check,
  Copy,
  Eye,
  EyeOff,
  FileArchive,
  FileSpreadsheet,
  FileText,
  IndianRupee,
  KeyRound,
  Mail,
  MapPin,
  MessageSquareText,
  Mic,
  Paperclip,
  Pencil,
  Phone,
  Plus,
  ShieldCheck,
  Trash2,
  Undo2,
  Upload,
} from 'lucide-react'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Due } from '../components/bits'
import ClientForm from '../components/ClientForm'
import { Avatar, Badge, Button, Card, CardHeader, Empty, Field, IconButton, Input, Person, Progress, Segmented, Select, Td, Textarea, Th } from '../components/ui'
import { statutoryDeadlines } from '../lib/deadlines'
import { addDays, cn, currentGstPeriod, daysUntil, fileSize, fmtDate, inr, periodLabel, todayISO, uid } from '../lib/format'
import { CATEGORY_TONE, DEPARTMENTS, DOC_KINDS, GST_STATUS, PAYMENT_MODES, PORTALS, SCOPES, SCOPE_LABEL, SIMPLE_STATUS, TASK_STATUS } from '../lib/meta'
import { useCurrentUser, useLookup, useStore, useVisibleTasks } from '../store'
import type { Client, Credential, DocKind, PaymentMode, Portal, ScopeKey } from '../types'

type Tab = 'overview' | 'clarifications' | 'fees' | 'logins' | 'documents' | 'work'

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
  const updateClient = useStore((s) => s.updateClient)
  const groups = useMemo(() => [...new Set(SCOPES.map((s) => s.group))], [])
  const deadlines = useMemo(() => {
    const today = todayISO()
    return statutoryDeadlines(today, addDays(today, 120))
      .filter((d) => d.applies(client))
      .slice(0, 8)
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
          <CardHeader title="Requirements sent" hint="Whether the list of papers and data needed has gone to the client, scope by scope" />
          {client.scopes.length === 0 ? (
            <p className="px-5 pb-5 text-[13px] text-ink-500">Tick a scope above to track its requirement list.</p>
          ) : (
            <ul className="divide-y divide-ink-100 pb-2">
              {SCOPES.filter((s) => client.scopes.includes(s.key)).map((s) => {
                const sent = client.requirementsSent[s.key]
                const set = (date?: string) => {
                  const next = { ...client.requirementsSent }
                  if (date) next[s.key] = date
                  else delete next[s.key]
                  updateClient(client.id, { requirementsSent: next })
                }
                return (
                  <li key={s.key} className="flex items-center gap-3 px-5 py-2">
                    <span className="min-w-0 flex-1 truncate font-semibold text-ink-800">{s.label}</span>
                    {sent ? (
                      <>
                        <Badge tone="green" dot>
                          Sent {fmtDate(sent)}
                        </Badge>
                        <IconButton label={`Mark ${s.label} requirement as not sent`} onClick={() => set()}>
                          <Undo2 size={14} />
                        </IconButton>
                      </>
                    ) : (
                      <>
                        <Badge tone="amber" dot>
                          Not sent
                        </Badge>
                        <Button size="sm" onClick={() => set(todayISO())}>
                          Mark sent
                        </Button>
                      </>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
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
  const tasks = useVisibleTasks()
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
        <CardHeader title="Filing status"  />
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

function Clarifications({ client }: { client: Client }) {
  const me = useCurrentUser()
  const updateClient = useStore((s) => s.updateClient)
  const { emp } = useLookup()
  const input = useRef<HTMLInputElement>(null)
  const [scope, setScope] = useState<ScopeKey | 'general'>('general')
  const [summary, setSummary] = useState('')
  const [recording, setRecording] = useState<{ name: string; sizeKb: number }>()
  const [filter, setFilter] = useState<ScopeKey | 'general' | 'all'>('all')

  const save = () => {
    if (!summary.trim()) return
    const entry = { id: uid('q'), scope, at: todayISO(), by: me.id, summary: summary.trim(), recording }
    updateClient(client.id, { clarifications: [entry, ...client.clarifications] })
    setSummary('')
    setRecording(undefined)
    if (input.current) input.current.value = ''
  }
  const label = (s: ScopeKey | 'general') => (s === 'general' ? 'General' : SCOPE_LABEL[s])
  const shown = client.clarifications.filter((q) => filter === 'all' || q.scope === filter)

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Card className="lg:col-span-2 lg:self-start">
        <CardHeader title="Log a clarification" hint="Call notes for one scope, or general" />
        <div className="space-y-3 px-5 pb-5">
          <Field label="About">
            <Select value={scope} onChange={(e) => setScope(e.target.value as ScopeKey | 'general')}>
              <option value="general">General</option>
              {client.scopes.map((s) => (
                <option key={s} value={s}>
                  {SCOPE_LABEL[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Call summary">
            <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={4} placeholder="Who you spoke to, what was clarified, what happens next…" />
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" icon={<Paperclip size={14} />} onClick={() => input.current?.click()}>
              {recording ? 'Change recording' : 'Attach call recording'}
            </Button>
            <input
              ref={input}
              type="file"
              accept="audio/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                setRecording(f ? { name: f.name, sizeKb: Math.max(1, Math.round(f.size / 1024)) } : undefined)
              }}
            />
            {recording && (
              <span className="inline-flex min-w-0 items-center gap-1.5 text-[13px] text-ink-600">
                <Mic size={13} className="shrink-0 text-violet-500" />
                <span className="truncate">{recording.name}</span>
              </span>
            )}
          </div>
          <Button variant="primary" onClick={save} disabled={!summary.trim()} className="w-full">
            Save clarification
          </Button>
          <p className="text-xs text-ink-500">Demo only: the recording's name and size are kept, the audio itself is not stored.</p>
        </div>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader
          title="Clarifications"
          hint={`${client.clarifications.length} logged`}
          action={
            <Select small fit value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} aria-label="Filter by scope">
              <option value="all">All scopes</option>
              <option value="general">General</option>
              {client.scopes.map((s) => (
                <option key={s} value={s}>
                  {SCOPE_LABEL[s]}
                </option>
              ))}
            </Select>
          }
        />
        {shown.length === 0 ? (
          <Empty icon={<MessageSquareText size={20} />} title="Nothing logged here yet" hint="Call summaries and recordings for this client will collect here." />
        ) : (
          <ol className="divide-y divide-ink-100 border-t border-ink-100">
            {shown.map((q) => {
              const by = emp(q.by)
              return (
                <li key={q.id} className="flex gap-3 px-5 py-3.5">
                  <Avatar name={by?.name ?? '?'} hue={by?.hue} photo={by?.photo} size={28} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-500">
                      <span className="font-semibold text-ink-800">{by?.name}</span>
                      {fmtDate(q.at, true)}
                      <Badge tone={q.scope === 'general' ? 'neutral' : 'blue'}>{label(q.scope)}</Badge>
                    </p>
                    <p className="mt-1 text-sm text-ink-700">{q.summary}</p>
                    {q.recording && (
                      <p className="mt-2 inline-flex max-w-full items-center gap-2 rounded-lg bg-violet-50 px-2.5 py-1.5 text-[13px] font-medium text-violet-800">
                        <Mic size={14} className="shrink-0" />
                        <span className="truncate">{q.recording.name}</span>
                        <span className="tnum shrink-0 text-xs text-violet-600">{fileSize(q.recording.sizeKb)}</span>
                      </p>
                    )}
                  </div>
                  <IconButton
                    label="Remove clarification"
                    onClick={() => updateClient(client.id, { clarifications: client.clarifications.filter((x) => x.id !== q.id) })}
                    className="hover:text-rose-600"
                  >
                    <Trash2 size={15} />
                  </IconButton>
                </li>
              )
            })}
          </ol>
        )}
      </Card>
    </div>
  )
}

function Fees({ client }: { client: Client }) {
  const updateClient = useStore((s) => s.updateClient)
  const [form, setForm] = useState<'charge' | 'payment' | null>(null)
  const [f, setF] = useState({ description: '', amount: '', date: todayISO(), mode: PAYMENT_MODES[0] as PaymentMode })

  // Oldest first to work out the running balance, then shown newest first.
  const rows = useMemo(() => {
    const sorted = [...client.transactions].sort(
      (a, b) => a.date.localeCompare(b.date) || Number(a.kind === 'payment') - Number(b.kind === 'payment'),
    )
    const out: Array<(typeof sorted)[number] & { balance: number }> = []
    for (const x of sorted) out.push({ ...x, balance: (out.at(-1)?.balance ?? 0) + (x.kind === 'charge' ? x.amount : -x.amount) })
    return out.reverse()
  }, [client.transactions])
  const billed = client.transactions.reduce((s, x) => s + (x.kind === 'charge' ? x.amount : 0), 0)
  const paid = client.transactions.reduce((s, x) => s + (x.kind === 'payment' ? x.amount : 0), 0)
  const due = billed - paid

  const open = (kind: 'charge' | 'payment') => {
    setF({ description: '', amount: kind === 'payment' && due > 0 ? String(due) : '', date: todayISO(), mode: PAYMENT_MODES[0] })
    setForm(kind)
  }
  const amount = Number(f.amount)
  const valid = amount > 0 && f.date && (form === 'payment' || f.description.trim())
  const save = () => {
    if (!form || !valid) return
    const entry = {
      id: uid('x'),
      date: f.date,
      kind: form,
      description: f.description.trim() || 'Payment received',
      amount,
      mode: form === 'payment' ? f.mode : undefined,
    }
    updateClient(client.id, { transactions: [entry, ...client.transactions] })
    setForm(null)
  }

  return (
    <Card>
      <CardHeader
        title="Fees & payments"
        hint="Every fee raised and every payment received, with dates"
        action={
          <div className="flex gap-2">
            <Button size="sm" icon={<Plus size={15} />} onClick={() => open('charge')}>
              Add fee
            </Button>
            <Button size="sm" variant="primary" icon={<Plus size={15} />} onClick={() => open('payment')}>
              Record payment
            </Button>
          </div>
        }
      />
      <dl className="grid grid-cols-3 divide-x divide-ink-100 border-y border-ink-100">
        {[
          { label: 'Fees raised', value: billed, tone: 'text-ink-900' },
          { label: 'Received', value: paid, tone: 'text-emerald-700' },
          { label: due < 0 ? 'Advance held' : 'Receivable', value: Math.abs(due), tone: due > 0 ? 'text-amber-700' : 'text-ink-900' },
        ].map((t) => (
          <div key={t.label} className="px-5 py-3">
            <dt className="text-xs font-semibold text-ink-500">{t.label}</dt>
            <dd className={cn('tnum mt-0.5 text-xl font-extrabold', t.tone)}>{inr(t.value)}</dd>
          </div>
        ))}
      </dl>

      {form && (
        <div className="grid items-end gap-3 border-b border-ink-100 bg-ink-50/50 p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]">
          <Field label={form === 'charge' ? 'Fee for' : 'Note'} hint={form === 'payment' ? 'optional' : undefined}>
            <Input
              value={f.description}
              onChange={(e) => setF({ ...f, description: e.target.value })}
              placeholder={form === 'charge' ? 'e.g. GST filing · October' : 'e.g. Part payment for audit'}
              autoFocus
            />
          </Field>
          <Field label="Amount (₹)">
            <Input type="number" min={0} step={100} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
          </Field>
          <Field label="Date">
            <Input type="date" value={f.date} max={todayISO()} onChange={(e) => setF({ ...f, date: e.target.value })} />
          </Field>
          {form === 'payment' ? (
            <Field label="Paid by">
              <Select value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value as PaymentMode })}>
                {PAYMENT_MODES.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </Select>
            </Field>
          ) : (
            <span className="hidden lg:block" />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setForm(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={save} disabled={!valid}>
              {form === 'charge' ? 'Add fee' : 'Save payment'}
            </Button>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <Empty icon={<IndianRupee size={20} />} title="No transactions yet" hint="Add a fee when work is billed and record payments as they come in." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-ink-100 bg-ink-50/60">
              <tr>
                <Th>Date</Th>
                <Th>Particulars</Th>
                <Th>Mode</Th>
                <Th align="right">Fee</Th>
                <Th align="right">Received</Th>
                <Th align="right">Balance</Th>
                <Th />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {rows.map((x) => (
                <tr key={x.id}>
                  <Td className="tnum whitespace-nowrap text-ink-600">{fmtDate(x.date, true)}</Td>
                  <Td className="font-medium text-ink-800">{x.description}</Td>
                  <Td>{x.mode ? <Badge>{x.mode}</Badge> : <span className="text-ink-300">—</span>}</Td>
                  <Td className="tnum text-right text-ink-800">{x.kind === 'charge' ? inr(x.amount) : ''}</Td>
                  <Td className="tnum text-right font-semibold text-emerald-700">{x.kind === 'payment' ? inr(x.amount) : ''}</Td>
                  <Td className={cn('tnum text-right font-bold', x.balance > 0 ? 'text-amber-700' : 'text-ink-500')}>{inr(x.balance)}</Td>
                  <Td className="text-right">
                    <IconButton
                      label="Remove entry"
                      onClick={() => updateClient(client.id, { transactions: client.transactions.filter((t) => t.id !== x.id) })}
                      className="hover:text-rose-600"
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
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
            { value: 'clarifications', label: 'Clarifications', count: client.clarifications.length },
            { value: 'fees', label: 'Fees' },
            { value: 'logins', label: 'Portal logins', count: client.credentials.length },
            { value: 'documents', label: 'Documents', count: client.documents.length },
            { value: 'work', label: 'Work' },
          ]}
        />
      </div>

      {tab === 'overview' && <Overview client={client} />}
      {tab === 'clarifications' && <Clarifications client={client} />}
      {tab === 'fees' && <Fees client={client} />}
      {tab === 'logins' && <Logins client={client} />}
      {tab === 'documents' && <Documents client={client} />}
      {tab === 'work' && <Work client={client} />}

      {editing && <ClientForm client={client} onClose={() => setEditing(false)} />}
    </>
  )
}

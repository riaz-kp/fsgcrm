import { Check, Lock, MessageCircle, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Avatar, Badge, Button, Card, CardHeader, Empty, Field, IconButton, Input, Modal, PageHeader, Segmented, Select, Td, Textarea, Th } from '../components/ui'
import { CHECKLISTS, checklistTitle } from '../data/requirements'
import { cn, fmtDate, todayISO } from '../lib/format'
import { FIRM_NAME, PERMISSIONS, ROLE_PERMISSIONS, ROLES, TEMPLATES, TRACKERS, fillTemplate } from '../lib/meta'
import { permissionsOf, useCan, useCurrentUser, useScopes, useStore } from '../store'
import type { Employee, Permission, ScopeDef, TemplateKey, TrackerTab } from '../types'

type Tab = 'scopes' | 'permissions' | 'messages'
const TABS: Array<{ value: Tab; label: string }> = [
  { value: 'scopes', label: 'Scopes of work' },
  { value: 'permissions', label: 'Permissions' },
  { value: 'messages', label: 'WhatsApp messages' },
]

/* ---------- Scopes ---------- */

const NEW_GROUP = '__new'

function ScopeForm({ scope, onClose }: { scope?: ScopeDef; onClose: () => void }) {
  const scopes = useScopes()
  const addScope = useStore((s) => s.addScope)
  const updateScope = useStore((s) => s.updateScope)
  const [f, setF] = useState({
    label: scope?.label ?? '',
    short: scope?.short ?? '',
    group: scope?.group ?? scopes.groups.at(-1) ?? 'One-time',
    newGroup: '',
    tracker: scope?.tracker ?? ('' as TrackerTab | ''),
    asks: !!scope?.detailHint,
    detailHint: scope?.detailHint ?? '',
  })
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }))
  const label = f.label.trim()
  const group = f.group === NEW_GROUP ? f.newGroup.trim() : f.group
  const clash = scopes.list.some((s) => s.key !== scope?.key && s.label.toLowerCase() === label.toLowerCase())
  const valid = label && group && !clash && (!f.asks || f.detailHint.trim())

  const save = () => {
    if (!valid) return
    const data = {
      label,
      // The chip on lists; a long name is cut to fit when no short form is given.
      short: f.short.trim() || (label.length > 12 ? `${label.slice(0, 11).trim()}.` : label),
      group,
      tracker: f.tracker || undefined,
      detailHint: f.asks ? f.detailHint.trim() : undefined,
    }
    if (scope) updateScope(scope.key, data)
    else addScope(data)
    onClose()
  }

  return (
    <Modal
      title={scope ? `Edit ${scope.label}` : 'New scope of work'}
      subtitle={scope?.builtin ? 'Built in: it can be renamed and moved, and its deadlines keep working.' : 'Shows in the scope of work on clients and leads.'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={!valid}>
            {scope ? 'Save' : 'Add scope'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <Input value={f.label} onChange={(e) => set('label', e.target.value)} placeholder="e.g. Trademark registration" autoFocus />
        </Field>
        <Field label="Short name" hint="for list chips">
          <Input value={f.short} onChange={(e) => set('short', e.target.value)} placeholder={label ? label.slice(0, 12) : 'e.g. TM'} maxLength={16} />
        </Field>
        {clash && <p className="-mt-2 text-[13px] text-rose-600 sm:col-span-2">There is already a scope called {label}.</p>}
        <Field label="Group">
          <Select value={f.group} onChange={(e) => set('group', e.target.value)}>
            {scopes.groups.map((g) => (
              <option key={g}>{g}</option>
            ))}
            <option value={NEW_GROUP}>New group…</option>
          </Select>
        </Field>
        {f.group === NEW_GROUP ? (
          <Field label="New group name">
            <Input value={f.newGroup} onChange={(e) => set('newGroup', e.target.value)} placeholder="e.g. Compliance" />
          </Field>
        ) : (
          <span className="hidden sm:block" />
        )}
        <Field label="Work is followed in" className="sm:col-span-2">
          <Select value={f.tracker} onChange={(e) => set('tracker', e.target.value as TrackerTab | '')}>
            <option value="">No tracker: tasks on the client's Work tab</option>
            {(Object.keys(TRACKERS) as TrackerTab[]).map((t) => (
              <option key={t} value={t}>
                {TRACKERS[t]} tracker
              </option>
            ))}
          </Select>
        </Field>
        <label className="flex items-center gap-2.5 text-[13px] font-semibold text-ink-700 sm:col-span-2">
          <input type="checkbox" checked={f.asks} onChange={(e) => set('asks', e.target.checked)} className="size-4 accent-brand-600" />
          Ask what exactly is meant when it is ticked
        </label>
        {f.asks && (
          <Field label="Question to ask" className="sm:col-span-2">
            <Input value={f.detailHint} onChange={(e) => set('detailHint', e.target.value)} placeholder="e.g. Which mark, and in which class?" />
          </Field>
        )}
      </div>
    </Modal>
  )
}

function DeleteScope({ scope, onClose }: { scope: ScopeDef; onClose: () => void }) {
  const deleteScope = useStore((s) => s.deleteScope)
  const clients = useStore((s) => s.clients.filter((c) => c.scopes.includes(scope.key)).length)
  const leads = useStore((s) => s.leads.filter((l) => l.scopes.includes(scope.key)).length)
  const used = [clients && `${clients} client${clients === 1 ? '' : 's'}`, leads && `${leads} lead${leads === 1 ? '' : 's'}`].filter(Boolean).join(' and ')
  return (
    <Modal
      title={`Delete ${scope.label}?`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Keep it
          </Button>
          <Button
            variant="danger"
            icon={<Trash2 size={15} />}
            onClick={() => {
              deleteScope(scope.key)
              onClose()
            }}
          >
            Delete scope
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-700">
        {used
          ? `It is ticked for ${used}. It will be taken off them, along with its requirement-sent date; call notes about it are kept under General.`
          : 'No client or lead has it ticked.'}{' '}
        This cannot be undone.
      </p>
    </Modal>
  )
}

function Scopes() {
  const scopes = useScopes()
  const clients = useStore((s) => s.clients)
  const leads = useStore((s) => s.leads)
  const [editing, setEditing] = useState<ScopeDef | 'new'>()
  const [deleting, setDeleting] = useState<ScopeDef>()
  const use = useMemo(() => {
    const map = new Map<string, { clients: number; leads: number }>()
    for (const s of scopes.list) map.set(s.key, { clients: clients.filter((c) => c.scopes.includes(s.key)).length, leads: leads.filter((l) => l.scopes.includes(s.key)).length })
    return map
  }, [scopes.list, clients, leads])

  return (
    <Card>
      <CardHeader
        title="Scopes of work"
        hint={`${scopes.list.length} scopes in ${scopes.groups.length} groups · ticked on clients and leads`}
        action={
          <Button size="sm" variant="primary" icon={<Plus size={15} />} onClick={() => setEditing('new')}>
            Add scope
          </Button>
        }
      />
      <div className="@container overflow-x-auto">
        <table className="stack w-full min-w-[760px] text-sm">
          <thead className="border-y border-ink-100 bg-ink-50/60">
            <tr>
              <Th>Scope</Th>
              <Th>Followed in</Th>
              <Th>Asks for details</Th>
              <Th>In use</Th>
              <Th />
            </tr>
          </thead>
          {scopes.groups.map((g) => (
            <tbody key={g} className="divide-y divide-ink-100 border-b border-ink-100">
              <tr className="bg-ink-50/40">
                <td colSpan={5} className="px-5 pt-3 pb-1.5 text-[11px] font-bold tracking-wider text-ink-400 uppercase">
                  {g}
                </td>
              </tr>
              {scopes.list
                .filter((s) => s.group === g)
                .map((s) => {
                  const n = use.get(s.key)!
                  return (
                    <tr key={s.key} className="relative">
                      <Td className="@max-3xl:pr-20">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-ink-900">{s.label}</span>
                          <Badge>{s.short}</Badge>
                          {s.builtin && <Badge tone="blue">Built in</Badge>}
                        </span>
                      </Td>
                      <Td label="Followed in" className="text-ink-600">
                        {s.tracker ? `${TRACKERS[s.tracker]} tracker` : <span className="text-ink-400">Tasks only</span>}
                      </Td>
                      <Td label="Asks for details" className="text-[13px] text-ink-600">
                        {s.detailHint ?? <span className="text-ink-400">No</span>}
                      </Td>
                      <Td label="In use" className="tnum text-[13px] whitespace-nowrap text-ink-600">
                        {n.clients} clients · {n.leads} leads
                      </Td>
                      <Td className="text-right whitespace-nowrap @max-3xl:absolute @max-3xl:top-2.5 @max-3xl:right-3">
                        <IconButton label={`Edit ${s.label}`} onClick={() => setEditing(s)}>
                          <Pencil size={14} />
                        </IconButton>
                        {s.builtin ? (
                          <span title="Deadlines and trackers rely on built-in scopes, so they can be renamed but not deleted." className="inline-flex size-8 items-center justify-center text-ink-300">
                            <Lock size={14} />
                          </span>
                        ) : (
                          <IconButton label={`Delete ${s.label}`} onClick={() => setDeleting(s)} className="hover:text-rose-600">
                            <Trash2 size={14} />
                          </IconButton>
                        )}
                      </Td>
                    </tr>
                  )
                })}
            </tbody>
          ))}
        </table>
      </div>
      <p className="px-5 py-3 text-xs text-ink-500">
        Statutory deadlines are worked out from the built-in scopes, so those can be renamed or moved to another group but not deleted. A new scope has no deadlines of its own: add a reminder on the Calendar page for any date it brings.
      </p>
      {editing && <ScopeForm scope={editing === 'new' ? undefined : editing} onClose={() => setEditing(undefined)} />}
      {deleting && <DeleteScope scope={deleting} onClose={() => setDeleting(undefined)} />}
    </Card>
  )
}

/* ---------- Permissions ---------- */

function Permissions() {
  const me = useCurrentUser()
  const employees = useStore((s) => s.employees)
  const setPermissions = useStore((s) => s.setPermissions)
  const [warning, setWarning] = useState('')
  const people = employees.filter((e) => e.active)
  const withSettings = people.filter((e) => permissionsOf(e).includes('settings'))

  const toggle = (e: Employee, p: Permission) => {
    const now = permissionsOf(e)
    const on = now.includes(p)
    // Settings must stay open to someone, and to whoever is making the change.
    if (on && p === 'settings' && e.id === me.id) return setWarning('You cannot take away your own access to Settings. Someone else with access can.')
    if (on && p === 'settings' && withSettings.length <= 1) return setWarning('At least one person has to keep access to Settings.')
    setWarning('')
    const next = on ? now.filter((x) => x !== p) : [...now, p]
    // Back to matching the role exactly means back to following it.
    const same = next.length === ROLE_PERMISSIONS[e.role].length && next.every((x) => ROLE_PERMISSIONS[e.role].includes(x))
    setPermissions(e.id, same ? undefined : PERMISSIONS.map((x) => x.key).filter((k) => next.includes(k)))
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Who can do what" hint="Tick to allow. Each person starts with what their role gives; a change here is theirs alone." />
        {warning && <p className="mx-5 mb-3 rounded-lg bg-amber-50 px-3 py-2 text-[13px] font-semibold text-amber-800 ring-1 ring-amber-200">{warning}</p>}
        <div className="@container overflow-x-auto">
          <table className="stack w-full min-w-[1060px] text-sm">
            <thead className="border-y border-ink-100 bg-ink-50/60">
              <tr>
                <Th>Person</Th>
                {PERMISSIONS.map((p) => (
                  <Th key={p.key} align="center">
                    <span title={`${p.label}: ${p.hint}`} className="cursor-help underline decoration-ink-300 decoration-dotted underline-offset-4">
                      {p.short}
                    </span>
                  </Th>
                ))}
                <Th />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {people.map((e) => {
                const mine = permissionsOf(e)
                return (
                  <tr key={e.id} className="relative">
                    <Td className="@max-3xl:pr-24">
                      <span className="flex items-center gap-2.5">
                        <Avatar name={e.name} hue={e.hue} photo={e.photo} size={30} />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-ink-900">{e.name}</span>
                          <span className="flex items-center gap-1.5 text-xs text-ink-500">
                            <Badge tone={ROLES[e.role].tone}>{ROLES[e.role].label}</Badge>
                            {e.permissions ? <span className="font-semibold text-amber-700">Custom</span> : 'Role default'}
                          </span>
                        </span>
                      </span>
                    </Td>
                    {PERMISSIONS.map((p) => {
                      const on = mine.includes(p.key)
                      return (
                        <Td key={p.key} label={p.label}>
                          <span className="flex justify-center">
                            <button
                              type="button"
                              role="checkbox"
                              aria-checked={on}
                              aria-label={`${p.label} for ${e.name}`}
                              title={`${p.label}: ${p.hint}`}
                              onClick={() => toggle(e, p.key)}
                              className={cn(
                                'flex size-5 items-center justify-center rounded-md transition-colors',
                                on ? 'bg-emerald-500 text-white' : 'bg-white ring-1 ring-ink-300 ring-inset hover:ring-ink-400',
                              )}
                            >
                              {on && <Check size={13} strokeWidth={3.5} />}
                            </button>
                          </span>
                        </Td>
                      )
                    })}
                    <Td className="text-right @max-3xl:absolute @max-3xl:top-3 @max-3xl:right-3">
                      {e.permissions && (
                        <Button size="sm" variant="ghost" icon={<RotateCcw size={13} />} onClick={() => setPermissions(e.id, undefined)} title={`Go back to what a ${ROLES[e.role].label.toLowerCase()} gets`}>
                          Reset
                        </Button>
                      )}
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader title="What each one allows" hint="The CEO and heads start with all of them; staff and trainees with adding clients, passwords and fees" />
        <dl className="grid gap-x-8 gap-y-3 px-5 pb-5 sm:grid-cols-2">
          {PERMISSIONS.map((p) => (
            <div key={p.key}>
              <dt className="text-[13px] font-bold text-ink-800">
                {p.label} <span className="font-medium text-ink-400">· {p.short}</span>
              </dt>
              <dd className="text-[13px] text-ink-600">{p.hint}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  )
}

/* ---------- WhatsApp messages ---------- */

/** Made-up values, so the preview reads like a real message without showing any client's details. */
function sampleValues(key: TemplateKey, staff: string): Record<string, string> {
  const date = fmtDate(todayISO(), true)
  if (key === 'status')
    return {
      greeting: 'Dear Sir/Madam',
      client: 'Sample Traders',
      date,
      status: ['• GSTR-1 for September: filed', '• GSTR-3B for September: in progress', '• TDS payment for September: paid'].join('\n'),
      staff,
      firm: FIRM_NAME,
    }
  const list = CHECKLISTS[0]
  return {
    greeting: 'Dear Sir/Madam',
    client: 'Sample Traders',
    services: `${list.service} (${list.variant})`,
    checklist: [`*${checklistTitle(list)}*`, `_${list.sections[0].title}_`, ...list.sections[0].items.slice(0, 3).map((i) => `• ${i.text}`), '…'].join('\n'),
    staff,
    firm: FIRM_NAME,
  }
}

/** WhatsApp's own *bold* and _italic_, so the preview looks like the chat will. */
function WhatsAppText({ text }: { text: string }) {
  const parts = text.split(/(\*[^*\n]+\*|_[^_\n]+_)/g)
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('*') && p.endsWith('*') && p.length > 2 ? (
          <strong key={i}>{p.slice(1, -1)}</strong>
        ) : p.startsWith('_') && p.endsWith('_') && p.length > 2 ? (
          <em key={i}>{p.slice(1, -1)}</em>
        ) : (
          p
        ),
      )}
    </>
  )
}

function TemplateEditor({ k }: { k: TemplateKey }) {
  const me = useCurrentUser()
  const meta = TEMPLATES[k]
  const custom = useStore((s) => s.templates[k])
  const setTemplate = useStore((s) => s.setTemplate)
  const area = useRef<HTMLTextAreaElement>(null)
  const text = custom ?? meta.text
  const main = k === 'status' ? 'status' : 'checklist'

  const insert = (field: string) => {
    const el = area.current
    const token = `{${field}}`
    const at = el ? el.selectionStart : text.length
    const end = el ? el.selectionEnd : text.length
    setTemplate(k, text.slice(0, at) + token + text.slice(end))
    // Put the caret after what was inserted once React has written the new text.
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(at + token.length, at + token.length)
    })
  }

  return (
    <Card>
      <CardHeader
        title={meta.label}
        hint={meta.hint}
        action={
          custom !== undefined && (
            <Button size="sm" variant="ghost" icon={<RotateCcw size={14} />} onClick={() => setTemplate(k)}>
              Restore original
            </Button>
          )
        }
      />
      <div className="grid gap-5 px-5 pb-5 lg:grid-cols-2">
        <div>
          <Field label="Message" hint={custom !== undefined ? 'edited · saves as you type' : 'saves as you type'}>
            <Textarea ref={area} value={text} onChange={(e) => setTemplate(k, e.target.value)} rows={14} className="font-mono text-[13px] leading-relaxed" />
          </Field>
          <p className="mt-3 mb-1.5 text-[13px] font-semibold text-ink-700">Fill-ins · click one to add it at the cursor</p>
          <ul className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
            {meta.fields.map((f) => (
              <li key={f.key} className="flex items-center gap-2 text-xs text-ink-500">
                <button
                  type="button"
                  onClick={() => insert(f.key)}
                  aria-label={`Add {${f.key}}: ${f.hint}`}
                  className="inline-flex h-6 shrink-0 items-center rounded-md bg-brand-50 px-1.5 font-mono text-xs font-semibold text-brand-800 ring-1 ring-brand-200 ring-inset hover:bg-brand-100"
                >
                  {`{${f.key}}`}
                </button>
                <span className="min-w-0">{f.hint}</span>
              </li>
            ))}
          </ul>
          {!text.includes(`{${main}}`) && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[13px] font-semibold text-amber-800 ring-1 ring-amber-200">
              Without {`{${main}}`} the message will not include the {main === 'status' ? 'status lines' : 'list of documents'}.
            </p>
          )}
        </div>
        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-ink-700">Preview, with sample details</p>
          <div className="rounded-xl bg-[#efeae2] p-4">
            <div className="ml-auto max-w-[92%] rounded-lg rounded-tr-none bg-[#d9fdd3] px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap text-ink-900 shadow-sm">
              <WhatsAppText text={fillTemplate(text, sampleValues(k, me.name))} />
            </div>
          </div>
          <p className="mt-2 flex items-start gap-1.5 text-xs text-ink-500">
            <MessageCircle size={13} className="mt-px shrink-0 text-emerald-600" />
            The staff member still reads and can change each message before it opens in WhatsApp.
          </p>
        </div>
      </div>
    </Card>
  )
}

function Messages() {
  return (
    <div className="space-y-4">
      {(Object.keys(TEMPLATES) as TemplateKey[]).map((k) => (
        <TemplateEditor key={k} k={k} />
      ))}
    </div>
  )
}

/* ---------- Page ---------- */

export default function Settings() {
  const { tab } = useParams()
  const navigate = useNavigate()
  const allowed = useCan()('settings')
  if (!allowed)
    return (
      <Card>
        <Empty icon={<Lock size={20} />} title="Settings are locked" hint="Scopes, permissions and message templates are changed by those given access to Settings." />
      </Card>
    )
  if (!TABS.some((t) => t.value === tab)) return <Navigate to="/settings/scopes" replace />

  return (
    <>
      <PageHeader title="Settings" subtitle="Scopes of work, who can do what, and the wording of WhatsApp messages. Changes apply straight away." />
      <div className="mb-4">
        <Segmented value={tab as Tab} onChange={(t) => navigate(`/settings/${t}`)} items={TABS} />
      </div>
      {tab === 'scopes' && <Scopes />}
      {tab === 'permissions' && <Permissions />}
      {tab === 'messages' && <Messages />}
    </>
  )
}

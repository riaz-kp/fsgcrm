import { Check, Copy, Download, KeyRound, Pencil, Printer, RefreshCw, Trash2, UserPlus, Users } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Avatar, Badge, Button, Card, CardHeader, Field, IconButton, Input, Modal, Td, Th } from '../components/ui'
import { cn } from '../lib/format'
import { MIN_PASSWORD, USERNAME_HINT, USERNAME_RULE, manageLogin, newPassword, suggestUsername } from '../lib/logins'
import { ROLES } from '../lib/meta'
import { reloadRecord } from '../lib/sync'
import { useCurrentUser, useStore } from '../store'
import type { Employee } from '../types'

/** A login just made or a password just set: shown once, for the admin to pass on. */
interface Issued {
  name: string
  username: string
  password: string
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

function Notice({ children }: { children: string }) {
  return <p className="rounded-lg bg-rose-50 px-3 py-2 text-[13px] text-rose-700 ring-1 ring-rose-200">{children}</p>
}

function PasswordInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-2">
      <Input value={value} onChange={(e) => onChange(e.target.value)} autoComplete="off" spellCheck={false} className="tnum font-mono" />
      <Button onClick={() => onChange(newPassword())} icon={<RefreshCw size={14} />} title="Make a new random password">
        New
      </Button>
    </div>
  )
}

/** Create a login, set a new password, or change a username, for one person. */
function LoginForm({ emp, kind, taken, onClose, onIssued }: { emp: Employee; kind: 'create' | 'reset' | 'rename'; taken: Set<string>; onClose: () => void; onIssued: (i: Issued) => void }) {
  const [username, setUsername] = useState(kind === 'rename' ? (emp.username ?? suggestUsername(emp.name, taken)) : suggestUsername(emp.name, taken))
  const [password, setPassword] = useState(newPassword)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const name = username.trim().toLowerCase()
  const nameOk = USERNAME_RULE.test(name) && !taken.has(name)
  const valid = (kind === 'reset' || nameOk) && (kind === 'rename' || password.length >= MIN_PASSWORD)

  const save = async () => {
    if (!valid || busy) return
    setBusy(true)
    setError('')
    try {
      if (kind === 'create') await manageLogin({ action: 'create', employee_id: emp.id, username: name, password })
      else if (kind === 'reset') await manageLogin({ action: 'reset_password', employee_id: emp.id, password })
      else await manageLogin({ action: 'rename', employee_id: emp.id, username: name })
      await reloadRecord('employees', emp.id)
      if (kind !== 'rename') onIssued({ name: emp.name, username: kind === 'reset' ? (emp.username ?? '(signs in with email)') : name, password })
      onClose()
    } catch (e) {
      setError(message(e))
      setBusy(false)
    }
  }

  const title = kind === 'create' ? `Create a login for ${emp.name}` : kind === 'reset' ? `New password for ${emp.name}` : `Change ${emp.name}'s username`
  return (
    <Modal
      title={title}
      subtitle={kind === 'reset' ? 'Their old password stops working straight away.' : kind === 'rename' ? 'They sign in with the new username from now on; the password stays the same.' : undefined}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void save()} disabled={!valid || busy}>
            {busy ? 'Saving…' : kind === 'create' ? 'Create login' : kind === 'reset' ? 'Set password' : 'Change username'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {kind !== 'reset' && (
          <Field label="Username" hint={USERNAME_HINT}>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" spellCheck={false} autoFocus />
            {name && !USERNAME_RULE.test(name) && <span className="mt-1 block text-xs text-rose-600">Use only small letters, numbers, dots, dashes or underscores, at least 3.</span>}
            {taken.has(name) && <span className="mt-1 block text-xs text-rose-600">Someone already has this username.</span>}
          </Field>
        )}
        {kind !== 'rename' && (
          <Field label="Password" hint={`At least ${MIN_PASSWORD} characters`}>
            <PasswordInput value={password} onChange={setPassword} />
          </Field>
        )}
        {error && <Notice>{error}</Notice>}
      </div>
    </Modal>
  )
}

/** Logins for everyone who has none yet, in one go. */
function CreateForEveryone({ people, taken, onClose, onIssued }: { people: Employee[]; taken: Set<string>; onClose: () => void; onIssued: (list: Issued[]) => void }) {
  const [rows, setRows] = useState(() => {
    const used = new Set(taken)
    return people.map((e) => {
      const username = suggestUsername(e.name, used)
      used.add(username)
      return { emp: e, username, password: newPassword(), include: true, error: '' }
    })
  })
  const [busy, setBusy] = useState(false)
  const chosen = rows.filter((r) => r.include)
  const names = chosen.map((r) => r.username.trim().toLowerCase())
  const clash = (u: string) => taken.has(u) || names.filter((n) => n === u).length > 1
  const valid = chosen.length > 0 && chosen.every((r) => USERNAME_RULE.test(r.username.trim().toLowerCase()) && !clash(r.username.trim().toLowerCase()) && r.password.length >= MIN_PASSWORD)
  const set = (i: number, patch: Partial<(typeof rows)[number]>) => setRows((all) => all.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  const run = async () => {
    if (!valid || busy) return
    setBusy(true)
    const done: Issued[] = []
    const left = []
    for (const r of rows) {
      if (!r.include) continue
      const username = r.username.trim().toLowerCase()
      try {
        await manageLogin({ action: 'create', employee_id: r.emp.id, username, password: r.password })
        await reloadRecord('employees', r.emp.id)
        done.push({ name: r.emp.name, username, password: r.password })
      } catch (e) {
        left.push({ ...r, error: message(e) })
      }
    }
    if (done.length) onIssued(done)
    if (left.length) {
      setRows(left)
      setBusy(false)
    } else onClose()
  }

  return (
    <Modal
      wide
      title="Create logins for everyone"
      subtitle="Check the usernames, then create. You get the full list of usernames and passwords to hand out at the end."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void run()} disabled={!valid || busy} icon={<UserPlus size={15} />}>
            {busy ? 'Creating…' : `Create ${chosen.length} login${chosen.length === 1 ? '' : 's'}`}
          </Button>
        </>
      }
    >
      <ul className="space-y-3">
        {rows.map((r, i) => {
          const u = r.username.trim().toLowerCase()
          const bad = r.include && (!USERNAME_RULE.test(u) ? 'Small letters, numbers, dots, dashes or underscores, at least 3' : clash(u) ? 'Username already used' : '')
          return (
            <li key={r.emp.id} className={cn('rounded-xl p-3 ring-1', r.include ? 'ring-ink-200' : 'opacity-60 ring-ink-100')}>
              <label className="mb-2 flex items-center gap-2.5">
                <input type="checkbox" checked={r.include} onChange={(e) => set(i, { include: e.target.checked })} className="size-4 accent-brand-600" />
                <Avatar name={r.emp.name} hue={r.emp.hue} photo={r.emp.photo} size={26} />
                <span className="font-semibold text-ink-900">{r.emp.name}</span>
                <Badge tone={ROLES[r.emp.role].tone}>{ROLES[r.emp.role].label}</Badge>
              </label>
              {r.include && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <Input small value={r.username} onChange={(e) => set(i, { username: e.target.value })} aria-label={`Username for ${r.emp.name}`} autoComplete="off" spellCheck={false} />
                    {bad && <span className="mt-1 block text-xs text-rose-600">{bad}</span>}
                  </div>
                  <div className="flex gap-2">
                    <Input small value={r.password} onChange={(e) => set(i, { password: e.target.value })} aria-label={`Password for ${r.emp.name}`} autoComplete="off" spellCheck={false} className="tnum font-mono" />
                    <IconButton label={`New password for ${r.emp.name}`} onClick={() => set(i, { password: newPassword() })}>
                      <RefreshCw size={14} />
                    </IconButton>
                  </div>
                </div>
              )}
              {r.error && <p className="mt-2 text-xs text-rose-600">{r.error}</p>}
            </li>
          )
        })}
      </ul>
    </Modal>
  )
}

function csv(items: Issued[]): string {
  const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  return ['Name,Username,Password', ...items.map((i) => [i.name, i.username, i.password].map(cell).join(','))].join('\n')
}

/** The usernames and passwords just given out, to copy, download or print. They are not kept anywhere. */
function saveCsv(items: Issued[]) {
  const url = URL.createObjectURL(new Blob([csv(items)], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'fsg-logins.csv'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function IssuedList({ items, onClose }: { items: Issued[]; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const site = window.location.origin
  // The passwords exist nowhere else, so a copy is saved straight away, and again when more are added.
  const saved = useRef(0)
  useEffect(() => {
    if (items.length > saved.current) {
      saved.current = items.length
      saveCsv(items)
    }
  }, [items])

  const copy = () => {
    const text = items.map((i) => `${i.name}\nUsername: ${i.username}\nPassword: ${i.password}`).join('\n\n')
    void navigator.clipboard?.writeText(`Sign in at ${site}\n\n${text}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  const download = () => saveCsv(items)
  // One slip per person, to cut out and hand over.
  const print = () => {
    const w = window.open('', '_blank')
    if (!w) return
    const d = w.document
    const add = (parent: HTMLElement, tag: string, text?: string, style?: string) => {
      const el = d.createElement(tag)
      if (text) el.textContent = text
      if (style) el.setAttribute('style', style)
      parent.appendChild(el)
      return el
    }
    d.title = 'FSG logins'
    d.body.setAttribute('style', 'font:14px system-ui,sans-serif;padding:24px')
    add(d.body, 'h2', 'FSG Practice Manager logins', 'margin:0 0 4px')
    add(d.body, 'p', `Sign in at ${site}`, 'margin:0 0 16px;color:#555')
    for (const i of items) {
      const slip = add(d.body, 'div', undefined, 'border:1px dashed #999;border-radius:8px;padding:12px 16px;margin:0 0 12px;break-inside:avoid')
      add(slip, 'b', i.name)
      add(slip, 'div', `Username: ${i.username}`, 'font-family:monospace;margin-top:4px')
      add(slip, 'div', `Password: ${i.password}`, 'font-family:monospace')
    }
    w.print()
  }

  return (
    <Modal
      wide
      title={items.length === 1 ? 'Login details' : `${items.length} logins created`}
      subtitle="A copy has been downloaded as fsg-logins.csv. Give these to each person; the passwords are shown only now."
      onClose={onClose}
      footer={
        <>
          <Button icon={copied ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />} onClick={copy}>
            Copy
          </Button>
          <Button icon={<Download size={15} />} onClick={download}>
            Download CSV
          </Button>
          <Button icon={<Printer size={15} />} onClick={print}>
            Print
          </Button>
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </>
      }
    >
      <table className="w-full text-sm">
        <thead className="border-b border-ink-100 text-left text-xs text-ink-500">
          <tr>
            <th className="py-2 font-semibold">Name</th>
            <th className="py-2 font-semibold">Username</th>
            <th className="py-2 font-semibold">Password</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {items.map((i) => (
            <tr key={i.name + i.username}>
              <td className="py-2 pr-3 font-semibold text-ink-900">{i.name}</td>
              <td className="py-2 pr-3">
                <code className="rounded bg-ink-50 px-1.5 py-0.5">{i.username}</code>
              </td>
              <td className="py-2">
                <code className="tnum rounded bg-ink-50 px-1.5 py-0.5">{i.password}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-xs text-ink-500">Sign in at {site} with the username and password.</p>
    </Modal>
  )
}

/** Settings → Logins: for the admin and the CEO only. */
export default function Logins() {
  const me = useCurrentUser()
  const employees = useStore((s) => s.employees)
  const [editing, setEditing] = useState<{ emp: Employee; kind: 'create' | 'reset' | 'rename' }>()
  const [bulk, setBulk] = useState(false)
  const [issued, setIssued] = useState<Issued[]>()
  const [removing, setRemoving] = useState('')
  const [error, setError] = useState('')

  const people = useMemo(() => [...employees].sort((a, b) => Number(b.active) - Number(a.active)), [employees])
  const taken = useMemo(() => new Set(employees.flatMap((e) => (e.username ? [e.username] : []))), [employees])
  const without = people.filter((e) => e.active && !e.hasLogin)

  const remove = async (e: Employee) => {
    if (!window.confirm(`Remove ${e.name}'s login? They can no longer sign in until they are given a new one.`)) return
    setRemoving(e.id)
    setError('')
    try {
      await manageLogin({ action: 'remove', employee_id: e.id })
      await reloadRecord('employees', e.id)
    } catch (err) {
      setError(message(err))
    }
    setRemoving('')
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Logins"
          hint="Only people allowed to give out logins (Settings → Permissions) create them and set passwords. Nobody can sign up or reset a password on their own."
          action={
            without.length > 0 && (
              <Button variant="primary" size="sm" icon={<Users size={15} />} onClick={() => setBulk(true)}>
                Create logins for everyone ({without.length})
              </Button>
            )
          }
        />
        {error && (
          <div className="mx-5 mb-3">
            <Notice>{error}</Notice>
          </div>
        )}
        <div className="@container overflow-x-auto">
          <table className="stack w-full min-w-[720px] text-sm">
            <thead className="border-y border-ink-100 bg-ink-50/60">
              <tr>
                <Th>Person</Th>
                <Th>Username</Th>
                <Th>Can sign in</Th>
                <Th />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {people.map((e) => (
                <tr key={e.id} className={cn('relative', !e.active && 'opacity-60')}>
                  <Td>
                    <span className="flex items-center gap-2.5">
                      <Avatar name={e.name} hue={e.hue} photo={e.photo} size={30} />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-ink-900">
                          {e.name}
                          {e.id === me.id && <span className="ml-1.5 text-xs font-normal text-ink-500">(you)</span>}
                        </span>
                        <Badge tone={ROLES[e.role].tone}>{ROLES[e.role].label}</Badge>
                      </span>
                    </span>
                  </Td>
                  <Td label="Username">{e.username ? <code className="rounded bg-ink-50 px-1.5 py-0.5 text-[13px] text-ink-800">{e.username}</code> : e.hasLogin ? <span className="text-ink-500">Signs in with email</span> : <span className="text-ink-400">None</span>}</Td>
                  <Td label="Can sign in">
                    {!e.active ? <Badge>Not active</Badge> : e.hasLogin ? <Badge tone="green">Yes</Badge> : <Badge tone="amber">No login yet</Badge>}
                  </Td>
                  <Td className="text-right whitespace-nowrap">
                    {!e.hasLogin ? (
                      e.active && (
                        <Button size="sm" icon={<UserPlus size={14} />} onClick={() => setEditing({ emp: e, kind: 'create' })}>
                          Create login
                        </Button>
                      )
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <Button size="sm" variant="ghost" icon={<KeyRound size={14} />} onClick={() => setEditing({ emp: e, kind: 'reset' })}>
                          New password
                        </Button>
                        <Button size="sm" variant="ghost" icon={<Pencil size={14} />} onClick={() => setEditing({ emp: e, kind: 'rename' })}>
                          {e.username ? 'Username' : 'Set username'}
                        </Button>
                        {e.id !== me.id && (
                          <IconButton label={`Remove ${e.name}'s login`} onClick={() => void remove(e)} disabled={removing === e.id} className="hover:text-rose-600">
                            <Trash2 size={15} />
                          </IconButton>
                        )}
                      </span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-ink-100 px-5 py-3 text-xs text-ink-500">
          Someone who leaves: mark them not active on the Team page, which stops their sign-in at once, or remove their login here.
        </p>
      </Card>

      {editing && (
        <LoginForm
          emp={editing.emp}
          kind={editing.kind}
          taken={new Set([...taken].filter((u) => u !== editing.emp.username))}
          onClose={() => setEditing(undefined)}
          onIssued={(i) => setIssued([i])}
        />
      )}
      {/* A second try after some failed adds to the list rather than replacing it, so no password is lost. */}
      {bulk && <CreateForEveryone people={without} taken={taken} onClose={() => setBulk(false)} onIssued={(list) => setIssued((was) => [...(was ?? []), ...list])} />}
      {issued && <IssuedList items={issued} onClose={() => setIssued(undefined)} />}
    </div>
  )
}

import { ArrowRight, Mail, Phone, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, Badge, Button, Card, Field, Input, Modal, PageHeader, Progress, Select } from '../components/ui'
import { daysUntil } from '../lib/format'
import { ROLES, options } from '../lib/meta'
import { isHead, useCurrentUser, useStore } from '../store'
import type { Employee, Role } from '../types'

function EmployeeForm({ onClose }: { onClose: () => void }) {
  const addEmployee = useStore((s) => s.addEmployee)
  const employees = useStore((s) => s.employees)
  const [f, setF] = useState({
    name: '',
    title: 'Trainee',
    role: 'trainee' as Role,
    reportsTo: employees.find((e) => e.role === 'head')?.id ?? '',
    responsibilities: '',
    phone: '',
    email: '',
  })
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }))

  const save = () => {
    if (!f.name.trim()) return
    addEmployee({
      name: f.name.trim(),
      title: f.title.trim() || ROLES[f.role].label,
      role: f.role,
      reportsTo: f.reportsTo || undefined,
      responsibilities: f.responsibilities
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      phone: f.phone.trim(),
      email: f.email.trim(),
    })
    onClose()
  }

  return (
    <Modal
      title="Add team member"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={!f.name.trim()}>
            Add member
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <Input value={f.name} onChange={(e) => set('name', e.target.value)} autoFocus />
        </Field>
        <Field label="Designation">
          <Input value={f.title} onChange={(e) => set('title', e.target.value)} />
        </Field>
        <Field label="Role">
          <Select value={f.role} onChange={(e) => set('role', e.target.value as Role)}>
            {options(ROLES).map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Reports to">
          <Select value={f.reportsTo} onChange={(e) => set('reportsTo', e.target.value)}>
            <option value="">No one</option>
            {employees
              .filter((e) => isHead(e))
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Usually works on" hint="comma separated" className="sm:col-span-2">
          <Input value={f.responsibilities} onChange={(e) => set('responsibilities', e.target.value)} placeholder="GST filing, book keeping" />
        </Field>
        <Field label="Phone" hint="optional">
          <Input value={f.phone} onChange={(e) => set('phone', e.target.value)} inputMode="tel" />
        </Field>
        <Field label="Email" hint="optional">
          <Input value={f.email} onChange={(e) => set('email', e.target.value)} type="email" />
        </Field>
      </div>
    </Modal>
  )
}

function MemberCard({ e, stats, manager, max }: { e: Employee; stats: { open: number; overdue: number; review: number; done: number }; manager?: Employee; max: number }) {
  return (
    <Card className="flex flex-col p-4">
      <div className="flex items-start gap-3">
        <Avatar name={e.name} hue={e.hue} size={44} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold text-ink-900">{e.name}</p>
          <p className="truncate text-[13px] text-ink-500">{e.title}</p>
        </div>
        <Badge tone={ROLES[e.role].tone}>{ROLES[e.role].label}</Badge>
      </div>

      <div className="mt-3 flex flex-1 flex-wrap content-start gap-1">
        {e.responsibilities.map((r) => (
          <Badge key={r}>
            {r}
          </Badge>
        ))}
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        {[
          { label: 'Open', value: stats.open, warn: false },
          { label: 'Overdue', value: stats.overdue, warn: stats.overdue > 0 },
          { label: 'Completed', value: stats.done, warn: false },
        ].map((s) => (
          <div key={s.label} className="rounded-lg bg-ink-50 py-2">
            <dd className={`tnum text-lg leading-none font-extrabold ${s.warn ? 'text-rose-600' : 'text-ink-900'}`}>{s.value}</dd>
            <dt className="mt-1 text-[11px] font-semibold text-ink-500">{s.label}</dt>
          </div>
        ))}
      </dl>

      <div className="mt-3">
        <div className="mb-1 flex justify-between text-xs text-ink-500">
          <span>Workload</span>
          {stats.review > 0 && <span className="font-semibold text-amber-700">{stats.review} awaiting approval</span>}
        </div>
        <Progress value={(stats.open / max) * 100} tone={stats.overdue ? 'amber' : 'blue'} />
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-ink-100 pt-3 text-xs text-ink-500">
        <span className="min-w-0 truncate">{manager ? `Reports to ${manager.name}` : 'Leads the firm'}</span>
        <span className="flex shrink-0 items-center gap-2">
          {e.phone && (
            <a href={`tel:${e.phone}`} title={e.phone} className="hover:text-ink-800">
              <Phone size={14} />
            </a>
          )}
          {e.email && (
            <a href={`mailto:${e.email}`} title={e.email} className="hover:text-ink-800">
              <Mail size={14} />
            </a>
          )}
          <Link to={`/tasks?assignee=${e.id}`} className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline">
            Tasks <ArrowRight size={13} />
          </Link>
        </span>
      </div>
    </Card>
  )
}

export default function Team() {
  const me = useCurrentUser()
  const employees = useStore((s) => s.employees)
  const tasks = useStore((s) => s.tasks)
  const [adding, setAdding] = useState(false)

  const stats = useMemo(() => {
    const map = new Map<string, { open: number; overdue: number; review: number; done: number }>()
    for (const e of employees) map.set(e.id, { open: 0, overdue: 0, review: 0, done: 0 })
    for (const t of tasks) {
      const s = map.get(t.assigneeId)
      if (!s) continue
      if (t.status === 'completed') s.done++
      else {
        s.open++
        if (daysUntil(t.dueDate) < 0) s.overdue++
        if (t.status === 'in_review') s.review++
      }
    }
    return map
  }, [employees, tasks])

  const max = Math.max(1, ...[...stats.values()].map((s) => s.open))
  const groups = [
    { title: 'Leadership', hint: 'Assign work and approve it', list: employees.filter(isHead) },
    { title: 'Staff & trainees', hint: 'No fixed allocation: who does what changes month to month and client to client', list: employees.filter((e) => !isHead(e)) },
  ]

  return (
    <>
      <PageHeader
        title="Team"
        subtitle={`${employees.length} people · ${employees.filter(isHead).length} heads`}
        actions={
          isHead(me) && (
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setAdding(true)}>
              Add member
            </Button>
          )
        }
      />

      {groups.map((g) => (
        <section key={g.title} className="mb-6">
          <div className="mb-2.5 flex flex-wrap items-baseline gap-x-3">
            <h2 className="text-[15px] font-bold text-ink-900">{g.title}</h2>
            <p className="text-[13px] text-ink-500">{g.hint}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {g.list.map((e) => (
              <MemberCard key={e.id} e={e} stats={stats.get(e.id)!} manager={employees.find((x) => x.id === e.reportsTo)} max={max} />
            ))}
          </div>
        </section>
      ))}

      {adding && <EmployeeForm onClose={() => setAdding(false)} />}
    </>
  )
}

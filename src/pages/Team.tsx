import { ArrowRight, Cake, CalendarDays, Camera, Mail, Pencil, Phone, Plus } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, Badge, Button, Card, Field, IconButton, Input, Modal, PageHeader, Progress, Select } from '../components/ui'
import { cn, daysToBirthday, daysUntil, fmtDate, parseISO, todayISO } from '../lib/format'
import { ROLES, options } from '../lib/meta'
import { isHead, useCurrentUser, useStore } from '../store'
import type { Employee, Role } from '../types'

/** Crop to a centred square and shrink, so a phone photo fits in browser storage. */
function resizePhoto(file: File, size = 240): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const side = Math.min(img.width, img.height)
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = size
      canvas.getContext('2d')?.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read that image'))
    }
    img.src = url
  })
}

function birthdayLabel(dob: string): string {
  // Day and month only: the year is nobody else's business.
  return parseISO(dob).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function tenure(joined: string): string {
  const months = Math.max(0, Math.floor(-daysUntil(joined) / 30.44))
  if (months < 1) return 'new'
  return months < 12 ? `${months} mo` : `${Math.floor(months / 12)} yr${months >= 24 ? 's' : ''}`
}

function EmployeeForm({ employee, onClose }: { employee?: Employee; onClose: () => void }) {
  const addEmployee = useStore((s) => s.addEmployee)
  const updateEmployee = useStore((s) => s.updateEmployee)
  const employees = useStore((s) => s.employees)
  const file = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const [f, setF] = useState({
    name: employee?.name ?? '',
    title: employee?.title ?? 'Trainee',
    role: employee?.role ?? ('trainee' as Role),
    reportsTo: employee ? (employee.reportsTo ?? '') : (employees.find((e) => e.role === 'head')?.id ?? ''),
    responsibilities: employee?.responsibilities.join(', ') ?? '',
    phone: employee?.phone ?? '',
    email: employee?.email ?? '',
    joined: employee?.joined ?? todayISO(),
    dob: employee?.dob ?? '',
    photo: employee?.photo ?? '',
  })
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }))

  const pick = async (files: FileList | null) => {
    const picked = files?.[0]
    if (!picked) return
    try {
      set('photo', await resizePhoto(picked))
      setError('')
    } catch {
      setError('That file could not be read as an image. Try a JPG or PNG.')
    }
  }

  const save = () => {
    if (!f.name.trim()) return
    const data = {
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
      joined: f.joined || undefined,
      dob: f.dob || undefined,
      photo: f.photo || undefined,
    }
    if (employee) updateEmployee(employee.id, data)
    else addEmployee(data)
    onClose()
  }

  return (
    <Modal
      wide
      title={employee ? `Edit ${employee.name}` : 'Add team member'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={!f.name.trim()}>
            {employee ? 'Save changes' : 'Add member'}
          </Button>
        </>
      }
    >
      <div className="mb-4 flex items-center gap-4">
        <Avatar name={f.name || '?'} hue={employee?.hue} photo={f.photo || undefined} size={64} />
        <div>
          <div className="flex gap-2">
            <Button size="sm" icon={<Camera size={14} />} onClick={() => file.current?.click()}>
              {f.photo ? 'Change photo' : 'Add photo'}
            </Button>
            {f.photo && (
              <Button size="sm" variant="ghost" onClick={() => set('photo', '')}>
                Remove
              </Button>
            )}
          </div>
          <input ref={file} type="file" accept="image/*" hidden onChange={(e) => void pick(e.target.files)} />
          <p className={cn('mt-1.5 text-xs', error ? 'text-rose-600' : 'text-ink-500')}>{error || 'Cropped to a square and shrunk before saving.'}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <Input value={f.name} onChange={(e) => set('name', e.target.value)} autoFocus={!employee} />
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
              .filter((e) => isHead(e) && e.id !== employee?.id)
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Date of joining">
          <Input type="date" value={f.joined} max={todayISO()} onChange={(e) => set('joined', e.target.value)} />
        </Field>
        <Field label="Date of birth" hint="for birthday wishes">
          <Input type="date" value={f.dob} max={todayISO()} onChange={(e) => set('dob', e.target.value)} />
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

interface Stats {
  open: number
  overdue: number
  review: number
  done: number
}

function MemberCard({ e, stats, manager, max, onEdit }: { e: Employee; stats?: Stats; manager?: Employee; max: number; onEdit?: () => void }) {
  const birthdayIn = e.dob ? daysToBirthday(e.dob) : undefined
  return (
    <Card className="flex flex-col p-4">
      <div className="flex items-start gap-3">
        <Avatar name={e.name} hue={e.hue} photo={e.photo} size={48} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold text-ink-900">{e.name}</p>
          <p className="truncate text-[13px] text-ink-500">{e.title}</p>
        </div>
        <Badge tone={ROLES[e.role].tone}>{ROLES[e.role].label}</Badge>
        {onEdit && (
          <IconButton label={`Edit ${e.name}`} onClick={onEdit} className="-mt-1 -mr-1.5">
            <Pencil size={14} />
          </IconButton>
        )}
      </div>

      <div className="mt-3 flex flex-1 flex-wrap content-start gap-1">
        {e.responsibilities.map((r) => (
          <Badge key={r}>{r}</Badge>
        ))}
      </div>

      <dl className="mt-3 space-y-1 text-[13px] text-ink-600">
        <div className="flex items-center gap-2">
          <CalendarDays size={14} className="text-ink-400" />
          <dt className="sr-only">Joined</dt>
          <dd>{e.joined ? `Joined ${fmtDate(e.joined, true)} · ${tenure(e.joined)}` : 'Joining date not added'}</dd>
        </div>
        <div className={cn('flex items-center gap-2', birthdayIn === 0 && 'font-semibold text-amber-700')}>
          <Cake size={14} className={birthdayIn === 0 ? 'text-amber-600' : 'text-ink-400'} />
          <dt className="sr-only">Birthday</dt>
          <dd>
            {!e.dob
              ? 'Birthday not added'
              : birthdayIn === 0
                ? 'Birthday today. Wish them!'
                : `Birthday ${birthdayLabel(e.dob)}${birthdayIn !== undefined && birthdayIn <= 14 ? ` · in ${birthdayIn} days` : ''}`}
          </dd>
        </div>
      </dl>

      {stats && (
        <>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[
              { label: 'Open', value: stats.open, warn: false },
              { label: 'Overdue', value: stats.overdue, warn: stats.overdue > 0 },
              { label: 'Completed', value: stats.done, warn: false },
            ].map((s) => (
              <div key={s.label} className="rounded-lg bg-ink-50 py-2">
                <dd className={cn('tnum text-lg leading-none font-extrabold', s.warn ? 'text-rose-600' : 'text-ink-900')}>{s.value}</dd>
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
        </>
      )}

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
          {stats && (
            <Link to={`/tasks?assignee=${e.id}`} className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline">
              Tasks <ArrowRight size={13} />
            </Link>
          )}
        </span>
      </div>
    </Card>
  )
}

export default function Team() {
  const me = useCurrentUser()
  const head = isHead(me)
  const employees = useStore((s) => s.employees)
  const tasks = useStore((s) => s.tasks)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Employee>()

  const stats = useMemo(() => {
    const map = new Map<string, Stats>()
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

  const birthdays = useMemo(
    () =>
      employees
        .filter((e) => e.dob)
        .map((e) => ({ e, days: daysToBirthday(e.dob!) }))
        .filter((b) => b.days <= 30)
        .sort((a, b) => a.days - b.days),
    [employees],
  )

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
          head && (
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setAdding(true)}>
              Add member
            </Button>
          )
        }
      />

      {birthdays.length > 0 && (
        <Card className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3">
          <p className="flex items-center gap-2 text-[13px] font-bold text-ink-900">
            <Cake size={16} className="text-amber-600" />
            Birthdays in the next 30 days
          </p>
          {birthdays.map(({ e, days }) => (
            <span key={e.id} className="flex items-center gap-2 text-[13px]">
              <Avatar name={e.name} hue={e.hue} photo={e.photo} size={22} />
              <span className="font-semibold text-ink-800">{e.name}</span>
              <Badge tone={days === 0 ? 'amber' : 'neutral'}>{days === 0 ? 'Today' : `${birthdayLabel(e.dob!)} · ${days}d`}</Badge>
            </span>
          ))}
        </Card>
      )}

      {groups.map((g) => (
        <section key={g.title} className="mb-6">
          <div className="mb-2.5 flex flex-wrap items-baseline gap-x-3">
            <h2 className="text-[15px] font-bold text-ink-900">{g.title}</h2>
            <p className="text-[13px] text-ink-500">{g.hint}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {g.list.map((e) => (
              <MemberCard
                key={e.id}
                e={e}
                // Workload is for the heads; everyone else sees their own.
                stats={head || e.id === me.id ? stats.get(e.id) : undefined}
                manager={employees.find((x) => x.id === e.reportsTo)}
                max={max}
                onEdit={head ? () => setEditing(e) : undefined}
              />
            ))}
          </div>
        </section>
      ))}

      {adding && <EmployeeForm onClose={() => setAdding(false)} />}
      {editing && <EmployeeForm employee={editing} onClose={() => setEditing(undefined)} />}
    </>
  )
}

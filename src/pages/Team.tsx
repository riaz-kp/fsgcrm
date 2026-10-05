import { ArrowRight, Cake, CalendarDays, Mail, Pencil, Phone, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import EmployeeForm from '../components/EmployeeForm'
import { Avatar, Badge, Button, Card, IconButton, PageHeader, Progress } from '../components/ui'
import { cn, daysToBirthday, daysUntil, fmtDate, parseISO, telHref, tenure } from '../lib/format'
import { ROLES } from '../lib/meta'
import { isHead, useCan, useCurrentUser, useStore } from '../store'
import type { Employee } from '../types'

function birthdayLabel(dob: string): string {
  // Day and month only: the year is for the person's own page, which only heads and they can open in full.
  return parseISO(dob).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
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
        <Link to={`/team/${e.id}`} title={`Open ${e.name}'s page`} className="group flex min-w-0 flex-1 items-start gap-3">
          <Avatar name={e.name} hue={e.hue} photo={e.photo} size={48} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-bold text-ink-900 group-hover:text-brand-700 group-hover:underline">{e.name}</span>
            <span className="block truncate text-[13px] text-ink-500">{e.title}</span>
          </span>
        </Link>
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
        <span className="flex shrink-0 items-center gap-2.5">
          {e.phone && (
            <a href={telHref(e.phone)} title={`Call ${e.phone}`} className="hover:text-ink-800">
              <Phone size={14} />
            </a>
          )}
          {e.email && (
            <a href={`mailto:${e.email}`} title={`Email ${e.email}`} className="hover:text-ink-800">
              <Mail size={14} />
            </a>
          )}
          {stats && (
            <Link to={`/tasks?assignee=${e.id}`} className="font-semibold text-ink-600 hover:text-brand-700 hover:underline">
              Tasks
            </Link>
          )}
          <Link to={`/team/${e.id}`} className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline">
            Open <ArrowRight size={13} />
          </Link>
        </span>
      </div>
    </Card>
  )
}

export default function Team() {
  const me = useCurrentUser()
  const can = useCan()
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
        subtitle={`${employees.length} people · ${employees.filter(isHead).length} heads · open anyone for their details, work and attendance`}
        actions={
          can('edit_team') && (
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
                // Workload goes with seeing colleagues' details; everyone else sees their own.
                stats={can('view_team') || e.id === me.id ? stats.get(e.id) : undefined}
                manager={employees.find((x) => x.id === e.reportsTo)}
                max={max}
                onEdit={can('edit_team') ? () => setEditing(e) : undefined}
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

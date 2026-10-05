import { ArrowRight, Building2, Cake, CheckCircle2, Clock, IndianRupee, ListTodo, Target } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Due, StatCard } from '../components/bits'
import { Avatar, Badge, Button, Card, CardHeader, Empty, Progress, TONE_BAR } from '../components/ui'
import { statutoryDeadlines } from '../lib/deadlines'
import { addDays, cn, currentGstPeriod, daysUntil, fmtDate, fmtWeekday, fmtTime, greeting, inr, longToday, periodLabel, todayISO } from '../lib/format'
import { DEPARTMENTS, LEAD_STATUS, LEAD_STATUS_ORDER, PRIORITIES, TASK_STATUS, TASK_STATUS_ORDER } from '../lib/meta'
import { can, useCurrentUser, useLookup, useStore, useVisibleTasks } from '../store'
import type { Task } from '../types'

function GstProgress() {
  const period = currentGstPeriod()
  const gst = useStore((s) => s.gst)
  const rows = useMemo(() => gst.filter((g) => g.period === period && g.gstr1 !== 'na'), [gst, period])
  const done = (k: 'gstr1' | 'gstr3b') => rows.filter((r) => r[k] === 'filed' || r[k] === 'nil').length
  const total = rows.length || 1
  const today = todayISO()
  const month = today.slice(0, 8)

  const returns = [
    { key: 'gstr1' as const, label: 'GSTR-1', due: `${month}11`, cutoff: `${month}10` },
    { key: 'gstr3b' as const, label: 'GSTR-3B', due: `${month}20`, cutoff: `${month}19` },
  ]

  return (
    <Card>
      <CardHeader
        title={`GST filing · ${periodLabel(period)}`}
        hint={`${rows.length} clients on monthly or quarterly returns`}
        action={
          <Link to="/filings/gst" className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-700 hover:underline">
            Open tracker <ArrowRight size={14} />
          </Link>
        }
      />
      <div className="grid gap-5 px-5 pb-5 sm:grid-cols-2">
        {returns.map((r) => {
          const n = done(r.key)
          return (
            <div key={r.key}>
              <div className="flex items-baseline justify-between">
                <p className="font-bold text-ink-800">{r.label}</p>
                <p className="tnum text-[13px] text-ink-500">
                  <span className="text-base font-extrabold text-ink-900">{n}</span> of {rows.length} filed
                </p>
              </div>
              <Progress value={(n / total) * 100} tone="blue" thick className="mt-2" />
              <p className="mt-2 text-xs text-ink-500">
                Staff cut-off <span className="font-semibold text-ink-700">{fmtDate(r.cutoff)}</span> · statutory {fmtDate(r.due)} ·{' '}
                <span className={cn('font-semibold', daysUntil(r.cutoff) <= 3 ? 'text-amber-700' : 'text-ink-700')}>
                  {daysUntil(r.cutoff) >= 0 ? `${daysUntil(r.cutoff)} days left` : 'cut-off passed'}
                </span>
              </p>
            </div>
          )
        })}
      </div>

    </Card>
  )
}

function WorkQueue() {
  const me = useCurrentUser()
  const head = can(me, 'assign_tasks')
  const tasks = useVisibleTasks()
  const { emp, client } = useLookup()

  const { approvals, queue } = useMemo(() => {
    const open = tasks.filter((t) => t.status !== 'completed')
    return {
      approvals: head ? open.filter((t) => t.status === 'in_review') : [],
      queue: open
        .filter((t) => (head ? t.status !== 'in_review' && daysUntil(t.dueDate) <= 7 : t.assigneeId === me.id))
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
        .slice(0, 7),
    }
  }, [tasks, head, me.id])

  const row = (t: (typeof tasks)[number], approve?: boolean) => {
    const c = client(t.clientId)
    const a = emp(t.assigneeId)
    return (
      <li key={t.id}>
        <Link to={`/tasks?open=${t.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-ink-50">
          <span className={cn('h-8 w-1 shrink-0 rounded-full', TONE_BAR[PRIORITIES[t.priority].tone])} title={`${PRIORITIES[t.priority].label} priority`} />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold text-ink-800">{t.title}</span>
            <span className="block truncate text-[13px] text-ink-500">
              {c?.name ?? 'Internal'} · {DEPARTMENTS[t.department].label}
            </span>
          </span>
          {approve || t.status === 'in_review' ? (
            <Badge tone="amber" dot>
              {approve ? 'Review' : 'With head'}
            </Badge>
          ) : (
            <span className="hidden w-24 sm:block">
              <span className="tnum mb-1 block text-right text-xs font-semibold text-ink-500">{t.progress}%</span>
              <Progress value={t.progress} tone={daysUntil(t.dueDate) < 0 ? 'red' : 'blue'} />
            </span>
          )}
          <span className="hidden w-14 text-right text-[13px] md:block">
            <Due date={t.dueDate} compact />
          </span>
          {a && <Avatar name={a.name} hue={a.hue} photo={a?.photo} size={26} />}
        </Link>
      </li>
    )
  }

  return (
    <Card>
      <CardHeader
        title={head ? 'Needs your attention' : 'My tasks'}
        hint={head ? 'Work submitted for approval, and anything due within a week' : `Assigned to you by your heads`}
        action={
          <Link to="/tasks" className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-700 hover:underline">
            All tasks <ArrowRight size={14} />
          </Link>
        }
      />
      {approvals.length + queue.length === 0 ? (
        <Empty icon={<CheckCircle2 size={20} />} title="Nothing waiting" hint="New work appears here as soon as it is assigned or submitted." />
      ) : (
        <ul className="divide-y divide-ink-100 pb-2">
          {approvals.map((t) => row(t, true))}
          {queue.map((t) => row(t))}
        </ul>
      )}
    </Card>
  )
}

/** Due today and the count in each status, for the tasks this person can see. */
function TodayStrip() {
  const tasks = useVisibleTasks()
  const dueToday = tasks.filter((t) => t.status !== 'completed' && daysUntil(t.dueDate) === 0).length
  const tiles = [
    { label: 'Due today', value: dueToday, dot: 'bg-rose-500', strong: true },
    ...TASK_STATUS_ORDER.map((s) => ({
      label: TASK_STATUS[s].label,
      value: tasks.filter((t) => t.status === s).length,
      dot: TONE_BAR[TASK_STATUS[s].tone],
      strong: false,
    })),
  ]
  return (
    <Link to="/tasks" className="mt-3 grid grid-cols-2 overflow-hidden rounded-xl bg-white shadow-card ring-1 ring-ink-200/80 sm:grid-cols-5 sm:divide-x sm:divide-ink-100">
      {tiles.map((t) => (
        <div key={t.label} className={cn('px-4 py-3', t.strong && 'col-span-2 bg-brand-50/60 sm:col-span-1')}>
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-500">
            <span className={cn('size-2 rounded-full', t.dot)} />
            {t.label}
          </p>
          <p className="tnum mt-0.5 text-2xl leading-tight font-extrabold text-ink-900">{t.value}</p>
        </div>
      ))}
    </Link>
  )
}

/** What is due today (or already late): one box per person for heads, your own otherwise. */
function TodayTasks() {
  const me = useCurrentUser()
  const head = can(me, 'assign_tasks')
  const tasks = useVisibleTasks()
  const employees = useStore((s) => s.employees)
  const { client } = useLookup()

  const boxes = useMemo(() => {
    const due = tasks.filter((t) => t.status !== 'completed' && daysUntil(t.dueDate) <= 0)
    const people = head ? employees : employees.filter((e) => e.id === me.id)
    return people
      .map((e) => ({ e, list: due.filter((t) => t.assigneeId === e.id).sort((a, b) => a.dueDate.localeCompare(b.dueDate)) }))
      .sort((a, b) => b.list.length - a.list.length)
  }, [tasks, employees, head, me.id])

  const line = (t: Task) => (
    <li key={t.id}>
      <Link to={`/tasks?open=${t.id}`} className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-ink-50">
        <span className={cn('size-1.5 shrink-0 rounded-full', daysUntil(t.dueDate) < 0 ? 'bg-rose-500' : 'bg-brand-500')} />
        <span className="min-w-0 flex-1 truncate text-[13px]">
          <span className="font-semibold text-ink-800">{t.title}</span>
          <span className="text-ink-500"> · {client(t.clientId)?.name ?? 'Internal'}</span>
        </span>
        {daysUntil(t.dueDate) < 0 && <span className="shrink-0 text-xs font-semibold text-rose-600">late</span>}
        <span className="tnum shrink-0 text-xs font-semibold text-ink-500">{t.progress}%</span>
      </Link>
    </li>
  )

  return (
    <Card>
      <CardHeader title="Today's tasks" hint={head ? 'Due today or already late, for each person' : 'Due today or already late'} />
      <div className={cn('grid gap-3 px-5 pb-5', head && 'sm:grid-cols-2')}>
        {boxes.map(({ e, list }) => (
          <section key={e.id} className="rounded-lg p-2.5 ring-1 ring-ink-200/80">
            <header className="mb-1 flex items-center gap-2 px-1.5">
              <Avatar name={e.name} hue={e.hue} photo={e.photo} size={22} />
              <h3 className="flex-1 truncate text-[13px] font-bold text-ink-900">
                {e.name} <span className="font-medium text-ink-400">· {e.title}</span>
              </h3>
              <Badge tone={list.length ? 'blue' : 'neutral'}>{list.length}</Badge>
            </header>
            {list.length ? <ul>{list.map(line)}</ul> : <p className="px-1.5 py-1 text-[13px] text-ink-400">Nothing due today</p>}
          </section>
        ))}
      </div>
    </Card>
  )
}

/** The CEO's consultation diary for today and tomorrow. */
function ConsultationsToday() {
  const consultations = useStore((s) => s.consultations)
  const list = consultations
    .filter((c) => c.status === 'scheduled' && daysUntil(c.date) >= 0 && daysUntil(c.date) <= 1)
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
  return (
    <Card>
      <CardHeader
        title="Your consultations"
        hint="Today and tomorrow"
        action={
          <Link to="/consultations" className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-700 hover:underline">
            Schedule <ArrowRight size={14} />
          </Link>
        }
      />
      {list.length === 0 ? (
        <p className="px-5 pb-5 text-[13px] text-ink-500">No consultations today or tomorrow.</p>
      ) : (
        <ul className="divide-y divide-ink-100 pb-2">
          {list.map((c) => (
            <li key={c.id} className="flex items-start gap-3 px-5 py-2.5">
              <span className="tnum flex w-[84px] shrink-0 items-center gap-1 text-[13px] font-bold whitespace-nowrap text-ink-900">
                <Clock size={13} className="text-violet-500" />
                {fmtTime(c.time)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-ink-800">{c.withName}</span>
                <span className="block text-xs text-ink-500">
                  {c.topic} · {c.mode}
                </span>
              </span>
              <Badge tone={daysUntil(c.date) === 0 ? 'violet' : 'neutral'}>{daysUntil(c.date) === 0 ? 'Today' : 'Tomorrow'}</Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function Birthdays() {
  const me = useCurrentUser()
  const employees = useStore((s) => s.employees)
  const today = todayISO().slice(5)
  const people = employees.filter((e) => e.dob?.slice(5) === today)
  if (people.length === 0) return null
  const mine = people.some((e) => e.id === me.id)
  const others = people.filter((e) => e.id !== me.id).map((e) => e.name)
  return (
    <div className="mb-4 flex items-center gap-3 rounded-xl bg-amber-50 px-4 py-3 ring-1 ring-amber-200">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
        <Cake size={18} />
      </span>
      <p className="text-sm font-semibold text-amber-900">
        {mine && `Happy birthday, ${me.name}! `}
        {others.length > 0 && `It's ${others.join(' and ')}'s birthday today. Wish them a happy birthday.`}
      </p>
    </div>
  )
}

function Deadlines() {
  const clients = useStore((s) => s.clients)
  const items = useMemo(() => {
    const today = todayISO()
    return statutoryDeadlines(today, addDays(today, 45))
      .map((d) => ({ ...d, count: clients.filter(d.applies).length }))
      .filter((d) => d.count > 0)
      .slice(0, 6)
  }, [clients])

  return (
    <Card>
      <CardHeader
        title="Upcoming deadlines"
        action={
          <Link to="/calendar" className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-700 hover:underline">
            Calendar <ArrowRight size={14} />
          </Link>
        }
      />
      <ul className="divide-y divide-ink-100 pb-2">
        {items.map((d) => {
          const n = daysUntil(d.internalDate ?? d.date)
          return (
            <li key={d.id} className="flex items-center gap-3 px-5 py-2.5">
              <div className="w-11 shrink-0 rounded-lg bg-ink-50 py-1 text-center ring-1 ring-ink-200/70">
                <p className="text-[10px] font-bold tracking-wide text-ink-500 uppercase">{fmtWeekday(d.date)}</p>
                <p className="tnum text-[15px] leading-tight font-extrabold text-ink-900">{Number(d.date.slice(8))}</p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink-800">{d.title}</p>
                <p className="text-xs text-ink-500">
                  {d.detail} · {d.count} clients
                  {d.internalDate && (
                    <>
                      {' · '}
                      <span className="font-semibold text-ink-700">staff cut-off {fmtDate(d.internalDate)}</span>
                    </>
                  )}
                  {d.extendable && ' · may be extended'}
                </p>
              </div>
              <Badge tone={n <= 3 ? 'red' : n <= 10 ? 'amber' : 'neutral'}>{n === 0 ? 'Today' : `${n}d`}</Badge>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

function Workload() {
  const employees = useStore((s) => s.employees)
  const tasks = useStore((s) => s.tasks)
  const rows = useMemo(() => {
    const list = employees.map((e) => {
      const open = tasks.filter((t) => t.assigneeId === e.id && t.status !== 'completed')
      return { e, open: open.length, overdue: open.filter((t) => daysUntil(t.dueDate) < 0).length }
    })
    return list.sort((a, b) => b.open - a.open)
  }, [employees, tasks])
  const max = Math.max(1, ...rows.map((r) => r.open))

  return (
    <Card>
      <CardHeader title="Team workload" hint="Open tasks per person" />
      <ul className="space-y-3 px-5 pb-5">
        {rows.map(({ e, open, overdue }) => (
          <li key={e.id} className="flex items-center gap-3">
            <Avatar name={e.name} hue={e.hue} photo={e?.photo} size={26} />
            <Link to={`/team/${e.id}`} className="w-24 truncate text-[13px] font-semibold text-ink-700 hover:text-brand-700 hover:underline">
              {e.name}
            </Link>
            <Progress value={(open / max) * 100} tone={overdue ? 'amber' : 'blue'} className="flex-1" />
            <span className="tnum w-14 text-right text-[13px] font-bold text-ink-800">
              {open}
              {overdue > 0 && <span className="ml-1 font-semibold text-rose-600">· {overdue} late</span>}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function LeadPipeline() {
  const leads = useStore((s) => s.leads)
  const dueToday = leads.filter((l) => (l.status === 'new' || l.status === 'followup') && l.nextFollowUp && daysUntil(l.nextFollowUp) <= 0)
  return (
    <Card>
      <CardHeader
        title="Lead pipeline"
        action={
          <Link to="/leads" className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-700 hover:underline">
            Open <ArrowRight size={14} />
          </Link>
        }
      />
      <div className="grid grid-cols-4 gap-2 px-5">
        {LEAD_STATUS_ORDER.map((s) => (
          <div key={s} className="rounded-lg bg-ink-50 px-2 py-2.5 text-center">
            <p className="tnum text-xl leading-none font-extrabold text-ink-900">{leads.filter((l) => l.status === s).length}</p>
            <p className="mt-1.5 truncate text-[11px] font-semibold text-ink-500">{s === 'new' ? 'New' : LEAD_STATUS[s].label}</p>
          </div>
        ))}
      </div>
      <p className="px-5 pt-3 pb-4 text-[13px] text-ink-500">
        {dueToday.length > 0 ? (
          <>
            <span className="font-bold text-amber-700">{dueToday.length} follow-ups</span> due today or overdue:{' '}
            {dueToday.map((l) => l.name).join(', ')}
          </>
        ) : (
          'No follow-ups due today.'
        )}
      </p>
    </Card>
  )
}

export default function Dashboard() {
  const me = useCurrentUser()
  // The manager's dashboard goes with assigning work; the fee figure on it, with seeing fees.
  const head = can(me, 'assign_tasks')
  const clients = useStore((s) => s.clients)
  const tasks = useVisibleTasks()
  const leads = useStore((s) => s.leads)

  const active = clients.filter((c) => c.active).length
  const scoped = tasks.filter((t) => t.status !== 'completed')
  const overdue = scoped.filter((t) => daysUntil(t.dueDate) < 0).length
  const inReview = tasks.filter((t) => t.status === 'in_review').length
  const openLeads = leads.filter((l) => l.status === 'new' || l.status === 'followup').length
  // What clients owe: every charge in their ledger minus every payment.
  const outstanding = clients.reduce(
    (sum, c) => sum + Math.max(0, c.transactions.reduce((bal, x) => bal + (x.kind === 'charge' ? x.amount : -x.amount), 0)),
    0,
  )

  return (
    <>
      <Birthdays />
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] leading-tight font-extrabold tracking-tight text-ink-900">
            {greeting()}, {me.name}
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            {longToday()} · {me.title}
          </p>
        </div>
        {head && (
          <Link to="/tasks?new=1">
            <Button variant="primary" icon={<ListTodo size={16} />}>
              Assign a task
            </Button>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Active clients"
          value={active}
          sub={`${clients.length - active} inactive`}
          icon={<Building2 size={17} />}
        />
        <StatCard
          label={head ? 'Open tasks' : 'My open tasks'}
          value={scoped.length}
          tone="violet"
          sub={
            <>
              {overdue > 0 ? <span className="font-semibold text-rose-600">{overdue} overdue</span> : 'None overdue'}
              {inReview > 0 && ` · ${inReview} ${TASK_STATUS.in_review.label.toLowerCase()}`}
            </>
          }
          icon={<ListTodo size={17} />}
        />
        <StatCard label="Open leads" value={openLeads} tone="amber" sub={`${leads.filter((l) => l.status === 'won').length} won so far`} icon={<Target size={17} />} />
        {head && can(me, 'view_fees') ? (
          <StatCard label="Fees outstanding" value={inr(outstanding)} tone="green" sub="Receivable across all clients" icon={<IndianRupee size={17} />} />
        ) : (
          <StatCard
            label="Completed"
            value={tasks.filter((t) => t.status === 'completed').length}
            tone="green"
            sub="Tasks approved by your head"
            icon={<CheckCircle2 size={17} />}
          />
        )}
      </div>

      <TodayStrip />

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <TodayTasks />
          <WorkQueue />
          <GstProgress />
        </div>
        <div className="space-y-4">
          {me.role === 'ceo' && <ConsultationsToday />}
          <Deadlines />
          {head && <Workload />}
          <LeadPipeline />
        </div>
      </div>
    </>
  )
}

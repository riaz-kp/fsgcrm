import { ArrowRight, Building2, CheckCircle2, IndianRupee, ListTodo, Target } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Due, StatCard } from '../components/bits'
import { Avatar, Badge, Button, Card, CardHeader, Empty, Progress, TONE_BAR } from '../components/ui'
import { statutoryDeadlines } from '../lib/deadlines'
import { addDays, cn, currentGstPeriod, daysUntil, fmtDate, fmtWeekday, greeting, inr, longToday, periodLabel, todayISO } from '../lib/format'
import { DEPARTMENTS, LEAD_STATUS, LEAD_STATUS_ORDER, PRIORITIES, TASK_STATUS, type Tone } from '../lib/meta'
import { isHead, useCurrentUser, useLookup, useStore } from '../store'
import type { GstFiling } from '../types'

const STAGE_SEGMENTS: Array<{ key: GstFiling['stage']; label: string; tone: Tone }> = [
  { key: 'awaiting', label: 'Awaiting data', tone: 'red' },
  { key: 'bills', label: 'Bills', tone: 'amber' },
  { key: 'tally', label: 'Tally', tone: 'violet' },
  { key: 'excel', label: 'Excel', tone: 'teal' },
  { key: 'json', label: 'JSON ready', tone: 'green' },
]

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
          <Link to="/compliance" className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-700 hover:underline">
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

      <div className="border-t border-ink-100 px-5 py-4">
        <p className="mb-2.5 text-[13px] font-semibold text-ink-700">Where each client's data is</p>
        <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
          {STAGE_SEGMENTS.map((s) => {
            const n = rows.filter((r) => r.stage === s.key).length
            return n ? <div key={s.key} className={TONE_BAR[s.tone]} style={{ flex: n }} title={`${s.label}: ${n}`} /> : null
          })}
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
          {STAGE_SEGMENTS.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5 text-[13px] text-ink-600">
              <span className={cn('size-2 rounded-sm', TONE_BAR[s.tone])} />
              {s.label}
              <span className="tnum font-bold text-ink-900">{rows.filter((r) => r.stage === s.key).length}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  )
}

function WorkQueue() {
  const me = useCurrentUser()
  const head = isHead(me)
  const tasks = useStore((s) => s.tasks)
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
          {a && <Avatar name={a.name} hue={a.hue} size={26} />}
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
            <Avatar name={e.name} hue={e.hue} size={26} />
            <span className="w-24 truncate text-[13px] font-semibold text-ink-700">{e.name}</span>
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
  const head = isHead(me)
  const clients = useStore((s) => s.clients)
  const tasks = useStore((s) => s.tasks)
  const leads = useStore((s) => s.leads)
  const gst = useStore((s) => s.gst)
  const it = useStore((s) => s.it)
  const services = useStore((s) => s.services)

  const active = clients.filter((c) => c.active).length
  const scoped = tasks.filter((t) => t.status !== 'completed' && (head || t.assigneeId === me.id))
  const overdue = scoped.filter((t) => daysUntil(t.dueDate) < 0).length
  const inReview = tasks.filter((t) => t.status === 'in_review' && (head || t.assigneeId === me.id)).length
  const openLeads = leads.filter((l) => l.status === 'new' || l.status === 'followup').length
  const period = currentGstPeriod()
  const outstanding =
    gst.filter((g) => g.period === period).reduce((sum, g) => sum + Math.max(0, g.prevBalance + g.fee - g.received), 0) +
    it.reduce((sum, r) => sum + (r.status === 'filed' || r.status === 'completed' ? Math.max(0, r.fee - r.received) : 0), 0) +
    services.reduce((sum, r) => sum + (r.status !== 'to_begin' ? Math.max(0, r.fee - r.received) : 0), 0)

  return (
    <>
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
        {head ? (
          <StatCard label="Fees outstanding" value={inr(outstanding)} tone="green" sub="GST this month, IT and one-time work" icon={<IndianRupee size={17} />} />
        ) : (
          <StatCard
            label="Completed"
            value={tasks.filter((t) => t.assigneeId === me.id && t.status === 'completed').length}
            tone="green"
            sub="Tasks approved by your head"
            icon={<CheckCircle2 size={17} />}
          />
        )}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <GstProgress />
          <WorkQueue />
        </div>
        <div className="space-y-4">
          <Deadlines />
          <Workload />
          <LeadPipeline />
        </div>
      </div>
    </>
  )
}

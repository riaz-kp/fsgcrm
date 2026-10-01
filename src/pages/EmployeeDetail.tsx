import { AlarmClock, ArrowLeft, ArrowRight, Cake, CalendarDays, CheckCircle2, Droplet, GraduationCap, Hourglass, ListTodo, Lock, Mail, MapPin, Pencil, Phone } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AttendancePanel } from '../components/AttendancePanel'
import { Detail, Due, MailLink, PhoneLink, StatCard } from '../components/bits'
import EmployeeForm from '../components/EmployeeForm'
import WorkHistory from '../components/WorkHistory'
import { Avatar, Badge, Button, Card, CardHeader, Empty, Progress, Segmented, Select } from '../components/ui'
import { timing } from '../lib/attendance'
import { ageFrom, currentGstPeriod, daysUntil, fmtDate, periodLabel, tenure, todayISO } from '../lib/format'
import { workEntries } from '../lib/history'
import { ATTENDANCE, ROLES, TASK_STATUS } from '../lib/meta'
import { isHead, useCurrentUser, useLookup, useStore, useVisibleTasks } from '../store'
import type { Employee } from '../types'

type Tab = 'profile' | 'work' | 'attendance'

const closed = (s: string) => s === 'filed' || s === 'completed'
const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/* ---------- Profile ---------- */

/** What everyone at the firm can see about a colleague. */
function AtTheFirm({ emp, contact }: { emp: Employee; contact?: boolean }) {
  const employees = useStore((s) => s.employees)
  const today = useStore((s) => s.attendance[emp.id]?.[todayISO()])
  const manager = employees.find((e) => e.id === emp.reportsTo)
  const reports = employees.filter((e) => e.reportsTo === emp.id)

  return (
    <Card>
      <CardHeader title="At the firm" />
      <dl className="divide-y divide-ink-100 px-5 pb-3 text-sm">
        <Detail label="Designation">{emp.title}</Detail>
        <Detail label="Role">
          <Badge tone={ROLES[emp.role].tone}>{ROLES[emp.role].label}</Badge>
        </Detail>
        <Detail label="Reports to">
          {manager && (
            <Link to={`/team/${manager.id}`} className="text-brand-700 hover:underline">
              {manager.name}
            </Link>
          )}
        </Detail>
        <Detail label="Usually works on">
          {emp.responsibilities.length > 0 && (
            <span className="flex flex-wrap gap-1">
              {emp.responsibilities.map((r) => (
                <Badge key={r}>{r}</Badge>
              ))}
            </span>
          )}
        </Detail>
        {reports.length > 0 && (
          <Detail label="Team">
            <span className="flex flex-wrap gap-x-3 gap-y-1.5">
              {reports.map((r) => (
                <Link key={r.id} to={`/team/${r.id}`} className="inline-flex items-center gap-1.5 hover:text-brand-700 hover:underline">
                  <Avatar name={r.name} hue={r.hue} photo={r.photo} size={20} />
                  {r.name}
                </Link>
              ))}
            </span>
          </Detail>
        )}
        {contact ? (
          <>
            <Detail label="Mobile number" icon={<Phone size={14} />}>
              <PhoneLink phone={emp.phone} className="text-brand-700" />
            </Detail>
            <Detail label="Mail ID" icon={<Mail size={14} />}>
              <MailLink email={emp.email} className="text-brand-700" />
            </Detail>
          </>
        ) : (
          <Detail label="Today">
            {today ? (
              <>
                <Badge tone={ATTENDANCE[today.mark].tone}>{ATTENDANCE[today.mark].label}</Badge>
                {timing(today) && <span className="tnum ml-2 text-[13px] font-normal text-ink-500">{timing(today)}</span>}
              </>
            ) : (
              <span className="font-normal text-ink-400">Attendance not marked yet</span>
            )}
          </Detail>
        )}
      </dl>
    </Card>
  )
}

function Profile({ emp, onEdit }: { emp: Employee; onEdit?: () => void }) {
  const f = emp.family ?? {}
  const personal = [emp.dob, emp.address, emp.phone, emp.email, emp.bloodGroup, emp.qualification, emp.joined]
  const family = [f.fatherName, f.fatherOccupation, f.motherName, f.motherOccupation, f.fatherPhone, f.siblings]
  // Only heads can change these, so anyone else is told who to ask.
  const added = (list: Array<string | undefined>) => `${list.filter(Boolean).length} of ${list.length} added${onEdit ? '' : ' · ask a head to update them'}`
  const edit = onEdit && (
    <Button size="sm" icon={<Pencil size={14} />} onClick={onEdit}>
      Edit
    </Button>
  )

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="lg:self-start">
        <CardHeader title="Personal details" hint={added(personal)} action={edit} />
        <dl className="divide-y divide-ink-100 px-5 pb-3 text-sm">
          <Detail label="Name">{emp.name}</Detail>
          <Detail label="Date of birth" icon={<Cake size={14} />}>
            {emp.dob && (
              <>
                {fmtDate(emp.dob, true)} <span className="font-normal text-ink-500">· {ageFrom(emp.dob)} years old</span>
              </>
            )}
          </Detail>
          <Detail label="Address" icon={<MapPin size={14} />}>
            {emp.address && <span className="whitespace-pre-line">{emp.address}</span>}
          </Detail>
          <Detail label="Mobile number" icon={<Phone size={14} />}>
            <PhoneLink phone={emp.phone} className="text-brand-700" />
          </Detail>
          <Detail label="Mail ID" icon={<Mail size={14} />}>
            <MailLink email={emp.email} className="text-brand-700" />
          </Detail>
          <Detail label="Blood group" icon={<Droplet size={14} />}>
            {emp.bloodGroup && <Badge tone="red">{emp.bloodGroup}</Badge>}
          </Detail>
          <Detail label="Qualification" icon={<GraduationCap size={14} />}>
            {emp.qualification}
          </Detail>
          <Detail label="Date of joining" icon={<CalendarDays size={14} />}>
            {emp.joined && (
              <>
                {fmtDate(emp.joined, true)} <span className="font-normal text-ink-500">· {tenure(emp.joined)}</span>
              </>
            )}
          </Detail>
        </dl>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader title="Family details" hint={added(family)} action={edit} />
          <dl className="divide-y divide-ink-100 px-5 pb-3 text-sm">
            <Detail label="Name of father">{f.fatherName}</Detail>
            <Detail label="Occupation">{f.fatherOccupation}</Detail>
            <Detail label="Name of mother">{f.motherName}</Detail>
            <Detail label="Occupation">{f.motherOccupation}</Detail>
            <Detail label="Mobile of father" icon={<Phone size={14} />}>
              <PhoneLink phone={f.fatherPhone} className="text-brand-700" />
            </Detail>
            <Detail label="Siblings">{f.siblings}</Detail>
          </dl>
        </Card>
        <AtTheFirm emp={emp} />
      </div>
    </div>
  )
}

/* ---------- Work ---------- */

function Work({ emp }: { emp: Employee }) {
  const me = useCurrentUser()
  const visible = useVisibleTasks()
  const clients = useStore((s) => s.clients)
  const gst = useStore((s) => s.gst)
  const tds = useStore((s) => s.tds)
  const it = useStore((s) => s.it)
  const audits = useStore((s) => s.audits)
  const services = useStore((s) => s.services)
  const leads = useStore((s) => s.leads)
  const { client } = useLookup()
  const period = currentGstPeriod()
  const today = todayISO()

  const tasks = visible.filter((t) => t.assigneeId === emp.id)
  const open = tasks.filter((t) => t.status !== 'completed').sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const overdue = open.filter((t) => daysUntil(t.dueDate) < 0).length
  const review = open.filter((t) => t.status === 'in_review').length

  const history = useMemo(
    () => workEntries({ gst, tds, it, audits, services, tasks: visible }, clients).filter((e) => e.assigneeId === emp.id),
    [gst, tds, it, audits, services, visible, clients, emp.id],
  )

  // What sits with this person in each tracker right now.
  const inHand: Array<{ label: string; detail: string; text: string; to: string }> = []
  const tracker = (tab: string) => `/filings/${tab}?assignee=${emp.id}`
  const myGst = gst.filter((g) => g.assigneeId === emp.id && g.period === period && g.gstr1 !== 'na')
  if (myGst.length) {
    const filed = (k: 'gstr1' | 'gstr3b') => myGst.filter((g) => g[k] === 'filed' || g[k] === 'nil').length
    inHand.push({ label: 'GST filing', detail: periodLabel(period), text: `${count(myGst.length, 'client')} · ${filed('gstr1')} GSTR-1 filed · ${filed('gstr3b')} GSTR-3B filed`, to: tracker('gst') })
  }
  const myTds = tds.filter((t) => t.assigneeId === emp.id)
  if (myTds.length) {
    const due = myTds.filter((t) => (t.payments[period] ?? 'due') === 'due').length
    inHand.push({ label: 'TDS', detail: `FY ${myTds[0].fy}`, text: `${count(myTds.length, 'deductor')} · ${count(due, 'payment')} due for ${periodLabel(period, true)}`, to: tracker('tds') })
  }
  const myIt = it.filter((r) => r.assigneeId === emp.id)
  if (myIt.length)
    inHand.push({ label: 'Income tax', detail: `AY ${myIt[0].ay}`, text: `${count(myIt.length, 'return')} · ${myIt.filter((r) => closed(r.status)).length} filed or completed`, to: tracker('it') })
  const myAudits = audits.filter((a) => a.assigneeId === emp.id)
  if (myAudits.length)
    inHand.push({ label: 'Audit', detail: `FY ${myAudits[0].fy}`, text: `${count(myAudits.length, 'audit')} · ${myAudits.filter((a) => closed(a.status)).length} filed or completed`, to: tracker('audit') })
  const myJobs = services.filter((s) => s.assigneeId === emp.id && s.status !== 'completed')
  if (myJobs.length)
    inHand.push({ label: 'One-time work', detail: 'Open jobs', text: `${count(myJobs.length, 'job')} · ${myJobs.filter((s) => s.committedDate < today).length} past the committed date`, to: tracker('services') })
  const myLeads = leads.filter((l) => l.ownerId === emp.id && (l.status === 'new' || l.status === 'followup'))
  if (myLeads.length)
    inHand.push({ label: 'Leads', detail: 'Open enquiries', text: `${count(myLeads.length, 'enquiry', 'enquiries')} · ${myLeads.filter((l) => l.nextFollowUp && daysUntil(l.nextFollowUp) <= 0).length} follow-ups due`, to: '/leads' })

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Open tasks" value={open.length} icon={<ListTodo size={17} />} sub={open.length ? `next due ${fmtDate(open[0].dueDate)}` : 'nothing pending'} />
        <StatCard label="Overdue" value={overdue} tone="amber" icon={<AlarmClock size={17} />} sub={overdue ? 'past their due date' : 'all on time'} />
        <StatCard label="Awaiting approval" value={review} tone="violet" icon={<Hourglass size={17} />} sub="submitted to a head" />
        <StatCard label="Completed" value={tasks.length - open.length} tone="green" icon={<CheckCircle2 size={17} />} sub="tasks approved" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Open tasks"
            hint={open.length ? 'Soonest due first' : undefined}
            action={
              <Link to={isHead(me) ? `/tasks?assignee=${emp.id}` : '/tasks'} className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-700 hover:underline">
                All tasks <ArrowRight size={14} />
              </Link>
            }
          />
          {open.length === 0 ? (
            <p className="px-5 pb-5 text-[13px] text-ink-500">No open tasks.</p>
          ) : (
            <ul className="divide-y divide-ink-100 pb-2">
              {open.map((t) => (
                <li key={t.id}>
                  <Link to={`/tasks?open=${t.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-ink-50">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-ink-800">{t.title}</span>
                      <span className="mt-1 flex items-center gap-2">
                        <Progress value={t.progress} tone={daysUntil(t.dueDate) < 0 ? 'red' : 'blue'} className="w-20" />
                        <span className="tnum text-xs text-ink-500">{t.progress}%</span>
                        <span className="truncate text-xs text-ink-500">{client(t.clientId)?.name ?? 'Internal'}</span>
                      </span>
                    </span>
                    <Badge tone={TASK_STATUS[t.status].tone}>{TASK_STATUS[t.status].label}</Badge>
                    <span className="text-[13px]">
                      <Due date={t.dueDate} compact />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="lg:self-start">
          <CardHeader title="In hand now" hint="Filings and jobs assigned in each tracker" />
          {inHand.length === 0 ? (
            <p className="px-5 pb-5 text-[13px] text-ink-500">No filings or one-time jobs are assigned right now.</p>
          ) : (
            <ul className="divide-y divide-ink-100 pb-2">
              {inHand.map((l) => (
                <li key={l.label}>
                  <Link to={l.to} className="group flex items-center gap-3 px-5 py-2.5 hover:bg-ink-50">
                    <span className="w-28 shrink-0">
                      <span className="block font-semibold text-ink-800">{l.label}</span>
                      <span className="block text-xs text-ink-500">{l.detail}</span>
                    </span>
                    <span className="min-w-0 flex-1 text-[13px] text-ink-700">{l.text}</span>
                    <ArrowRight size={15} className="shrink-0 text-ink-300 group-hover:text-brand-600" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <WorkHistory entries={history} by="client" hint="Month by month: what they worked on and for whom" recent={2} className="lg:col-span-2" />
      </div>
    </>
  )
}

/* ---------- Page ---------- */

export default function EmployeeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const me = useCurrentUser()
  const head = isHead(me)
  const employees = useStore((s) => s.employees)
  const openTasks = useStore((s) => s.tasks.filter((t) => t.assigneeId === id && t.status !== 'completed').length)
  const [tab, setTab] = useState<Tab>('profile')
  const [editing, setEditing] = useState(false)
  const emp = employees.find((e) => e.id === id)

  if (!emp) {
    return (
      <Card>
        <Empty title="No such person" hint="They may have been removed when the sample data was reset." action={<Link to="/team"><Button>Back to team</Button></Link>} />
      </Card>
    )
  }
  // Personal details, work and attendance are for the heads and for the person themself.
  const full = head || emp.id === me.id
  const manager = employees.find((e) => e.id === emp.reportsTo)

  return (
    <>
      <Link to="/team" className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-500 hover:text-ink-800">
        <ArrowLeft size={15} /> Team
      </Link>

      <div className="mb-5 flex flex-wrap items-center gap-4">
        <Avatar name={emp.name} hue={emp.hue} photo={emp.photo} size={56} />
        <div className="min-w-48 flex-1">
          <h1 className="truncate text-[22px] leading-tight font-extrabold tracking-tight text-ink-900">{emp.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-500">
            <Badge tone={ROLES[emp.role].tone}>{ROLES[emp.role].label}</Badge>
            {/* A trainee's designation is just "Trainee" again. */}
            <span>{[emp.title !== ROLES[emp.role].label && emp.title, manager ? `reports to ${manager.name}` : 'leads the firm'].filter(Boolean).join(' · ')}</span>
          </p>
        </div>
        {head && (
          <div className="flex flex-wrap items-center gap-3">
            <Select fit value={emp.id} onChange={(e) => navigate(`/team/${e.target.value}`)} aria-label="Show another person">
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
            <Button icon={<Pencil size={15} />} onClick={() => setEditing(true)}>
              Edit
            </Button>
          </div>
        )}
      </div>

      {full ? (
        <>
          <div className="mb-4">
            <Segmented
              value={tab}
              onChange={setTab}
              items={[
                { value: 'profile', label: 'Profile' },
                { value: 'work', label: 'Work', count: openTasks },
                { value: 'attendance', label: 'Attendance' },
              ]}
            />
          </div>
          {tab === 'profile' && <Profile emp={emp} onEdit={head ? () => setEditing(true) : undefined} />}
          {tab === 'work' && <Work emp={emp} />}
          {tab === 'attendance' && <AttendancePanel emp={emp} canEdit={head} />}
        </>
      ) : (
        <div className="max-w-xl space-y-3">
          <AtTheFirm emp={emp} contact />
          <p className="flex items-start gap-2 px-1 text-[13px] text-ink-500">
            <Lock size={14} className="mt-0.5 shrink-0" />
            Personal and family details, work and attendance are shown to the heads and to {emp.name} only.
          </p>
        </div>
      )}

      {editing && <EmployeeForm employee={emp} onClose={() => setEditing(false)} />}
    </>
  )
}

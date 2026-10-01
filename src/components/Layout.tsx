import {
  Bell,
  Building2,
  CalendarCheck,
  CalendarDays,
  Check,
  ChevronsUpDown,
  Clock,
  FileCheck2,
  Landmark,
  LayoutDashboard,
  ListTodo,
  Menu,
  Plus,
  Receipt,
  RotateCcw,
  ScrollText,
  Search,
  Stamp,
  Target,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { statutoryDeadlines } from '../lib/deadlines'
import { addDays, cn, daysUntil, fmtDate, fmtTime, relDue, todayISO } from '../lib/format'
import { DEPARTMENTS, ROLES } from '../lib/meta'
import { isHead, useCurrentUser, useStore, useVisibleTasks } from '../store'
import { Avatar, Badge, Button, IconButton } from './ui'

/** Close a popover when the user clicks elsewhere or presses Escape. */
function useDismiss(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])
  return ref
}

function NavItem({ to, icon, label, count, onNavigate }: { to: string; icon: ReactNode; label: string; count?: number; onNavigate: () => void }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm font-semibold transition-colors',
          isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute top-2 bottom-2 -left-3 w-[3px] rounded-r bg-brand-500" />}
          <span className={cn(isActive ? 'text-brand-600' : 'text-ink-400 group-hover:text-ink-600')}>{icon}</span>
          <span className="flex-1 truncate">{label}</span>
          {!!count && (
            <span className={cn('tnum rounded-md px-1.5 text-[11px] font-bold', isActive ? 'bg-brand-100 text-brand-700' : 'bg-ink-100 text-ink-500')}>
              {count}
            </span>
          )}
        </>
      )}
    </NavLink>
  )
}

function UserSwitcher() {
  const [open, setOpen] = useState(false)
  const ref = useDismiss(open, () => setOpen(false))
  const me = useCurrentUser()
  const employees = useStore((s) => s.employees)
  const setCurrentUser = useStore((s) => s.setCurrentUser)
  const resetDemo = useStore((s) => s.resetDemo)

  return (
    <div ref={ref} className="relative">
      {open && (
        <div className="absolute right-0 bottom-full left-0 z-30 mb-2 animate-pop-in overflow-hidden rounded-xl bg-white shadow-pop ring-1 ring-ink-200">
          <p className="px-3 pt-3 pb-1.5 text-[11px] font-bold tracking-wider text-ink-400 uppercase">View the demo as</p>
          <ul className="scroll-thin max-h-72 overflow-y-auto px-1.5 pb-1.5">
            {employees.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentUser(e.id)
                    setOpen(false)
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left hover:bg-ink-50"
                >
                  <Avatar name={e.name} hue={e.hue} photo={e?.photo} size={28} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-ink-800">{e.name}</span>
                    <span className="block truncate text-xs text-ink-500">{e.title}</span>
                  </span>
                  {e.id === me.id && <Check size={16} className="text-brand-600" />}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => {
              resetDemo()
              setOpen(false)
            }}
            className="flex w-full items-center gap-2 border-t border-ink-100 px-3 py-2.5 text-[13px] font-semibold text-ink-600 hover:bg-ink-50"
          >
            <RotateCcw size={14} /> Reset sample data
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-xl p-2 text-left ring-1 ring-ink-200 transition-colors hover:bg-ink-50"
      >
        <Avatar name={me.name} hue={me.hue} photo={me?.photo} size={34} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-bold text-ink-900">{me.name}</span>
          <span className="block truncate text-xs text-ink-500">{me.title}</span>
        </span>
        <ChevronsUpDown size={15} className="text-ink-400" />
      </button>
    </div>
  )
}

function GlobalSearch() {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useDismiss(open, () => setOpen(false))
  const navigate = useNavigate()
  const clients = useStore((s) => s.clients)
  const leads = useStore((s) => s.leads)
  const tasks = useVisibleTasks()

  const results = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (term.length < 2) return []
    const hit = (s?: string) => !!s && s.toLowerCase().includes(term)
    return [
      ...clients
        .filter((c) => hit(c.name) || hit(c.code) || hit(c.phone) || hit(c.gstin) || hit(c.place))
        .slice(0, 5)
        .map((c) => ({ key: c.id, kind: 'Client', title: c.name, sub: `${c.code} · ${c.place}`, to: `/clients/${c.id}` })),
      ...leads
        .filter((l) => hit(l.name) || hit(l.contact) || hit(l.phone))
        .slice(0, 3)
        .map((l) => ({ key: l.id, kind: 'Lead', title: l.name, sub: `${l.contact} · ${l.place}`, to: `/leads?open=${l.id}` })),
      ...tasks
        .filter((t) => hit(t.title))
        .slice(0, 4)
        .map((t) => ({ key: t.id, kind: 'Task', title: t.title, sub: `Due ${fmtDate(t.dueDate)}`, to: `/tasks?open=${t.id}` })),
    ]
  }, [q, clients, leads, tasks])

  return (
    <div ref={ref} className="relative w-full max-w-md">
      <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-400" />
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search clients, leads, tasks…"
        aria-label="Search"
        className="h-9 w-full rounded-lg bg-ink-100/70 pr-3 pl-9 text-sm text-ink-800 placeholder:text-ink-400 focus:bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
      />
      {open && q.trim().length >= 2 && (
        <div className="absolute top-full right-0 left-0 z-40 mt-2 animate-pop-in overflow-hidden rounded-xl bg-white shadow-pop ring-1 ring-ink-200">
          {results.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-ink-500">Nothing matches “{q.trim()}”.</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto p-1.5">
              {results.map((r) => (
                <li key={r.key}>
                  <button
                    type="button"
                    onClick={() => {
                      navigate(r.to)
                      setOpen(false)
                      setQ('')
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-ink-50"
                  >
                    <span className="w-11 shrink-0 text-[11px] font-bold tracking-wide text-ink-400 uppercase">{r.kind}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-ink-800">{r.title}</span>
                      <span className="block truncate text-xs text-ink-500">{r.sub}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function Reminders() {
  const [open, setOpen] = useState(false)
  const ref = useDismiss(open, () => setOpen(false))
  const navigate = useNavigate()
  const me = useCurrentUser()
  const tasks = useStore((s) => s.tasks)
  const leads = useStore((s) => s.leads)
  const clients = useStore((s) => s.clients)
  const employees = useStore((s) => s.employees)
  const consultations = useStore((s) => s.consultations)

  const items = useMemo(() => {
    const today = todayISO()
    const head = isHead(me)
    const out: Array<{ key: string; title: string; sub: string; when: string; urgent: boolean; to: string }> = []

    // The CEO's consultation diary: today's and tomorrow's appointments.
    if (me.role === 'ceo')
      for (const c of consultations) {
        if (c.status !== 'scheduled' || daysUntil(c.date) < 0 || daysUntil(c.date) > 1) continue
        out.push({
          key: c.id,
          title: `${fmtTime(c.time)} · ${c.withName}`,
          sub: `Consultation ${daysUntil(c.date) === 0 ? 'today' : 'tomorrow'} · ${c.topic}`,
          when: `${c.date} ${c.time}`,
          urgent: daysUntil(c.date) === 0,
          to: '/consultations',
        })
      }
    for (const e of employees) {
      if (e.dob?.slice(5) !== today.slice(5)) continue
      out.push({
        key: `b-${e.id}`,
        title: e.id === me.id ? 'Happy birthday!' : `It's ${e.name}'s birthday today`,
        sub: e.id === me.id ? 'From everyone at FSG' : 'Wish them a happy birthday',
        when: today,
        urgent: false,
        to: '/team',
      })
    }

    for (const t of tasks) {
      if (t.status === 'completed') continue
      const mine = t.assigneeId === me.id
      if (head && t.status === 'in_review' && t.assignedById === me.id)
        out.push({ key: `a-${t.id}`, title: `Approve: ${t.title}`, sub: 'Submitted for your approval', when: today, urgent: true, to: `/tasks?open=${t.id}` })
      else if (mine && daysUntil(t.dueDate) <= 2)
        out.push({ key: t.id, title: t.title, sub: `Task · ${relDue(t.dueDate)}`, when: t.dueDate, urgent: daysUntil(t.dueDate) < 0, to: `/tasks?open=${t.id}` })
    }
    for (const l of leads) {
      if (l.ownerId === me.id && l.nextFollowUp && (l.status === 'new' || l.status === 'followup') && daysUntil(l.nextFollowUp) <= 0)
        out.push({ key: l.id, title: `Follow up with ${l.name}`, sub: `Lead · ${relDue(l.nextFollowUp)}`, when: l.nextFollowUp, urgent: daysUntil(l.nextFollowUp) < 0, to: `/leads?open=${l.id}` })
    }
    for (const d of statutoryDeadlines(today, addDays(today, 10))) {
      const n = clients.filter(d.applies).length
      if (n === 0) continue
      out.push({
        key: d.id,
        title: `${d.title} — ${d.detail}`,
        sub: `${DEPARTMENTS[d.dept].label} · ${n} clients · ${relDue(d.internalDate ?? d.date)}`,
        when: d.internalDate ?? d.date,
        urgent: false,
        to: '/calendar',
      })
    }
    return out.sort((a, b) => Number(b.urgent) - Number(a.urgent) || a.when.localeCompare(b.when))
  }, [tasks, leads, clients, employees, consultations, me])

  return (
    <div ref={ref} className="relative">
      <IconButton label="Reminders" onClick={() => setOpen((o) => !o)} className="relative">
        <Bell size={18} />
        {items.length > 0 && (
          <span className="tnum absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {items.length}
          </span>
        )}
      </IconButton>
      {open && (
        <div className="absolute top-full right-0 z-40 mt-2 w-[min(360px,calc(100vw-24px))] animate-pop-in overflow-hidden rounded-xl bg-white shadow-pop ring-1 ring-ink-200">
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
            <p className="font-bold text-ink-900">Reminders</p>
            <span className="text-xs text-ink-500">for {me.name}</span>
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-ink-500">You're all caught up.</p>
          ) : (
            <ul className="scroll-thin max-h-96 divide-y divide-ink-100 overflow-y-auto">
              {items.map((it) => (
                <li key={it.key}>
                  <button
                    type="button"
                    onClick={() => {
                      navigate(it.to)
                      setOpen(false)
                    }}
                    className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-ink-50"
                  >
                    <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', it.urgent ? 'bg-rose-500' : 'bg-brand-400')} />
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold text-ink-800">{it.title}</span>
                      <span className={cn('block truncate text-xs', it.urgent ? 'text-rose-600' : 'text-ink-500')}>{it.sub}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function QuickAdd() {
  const [open, setOpen] = useState(false)
  const ref = useDismiss(open, () => setOpen(false))
  const navigate = useNavigate()
  const me = useCurrentUser()
  const go = (to: string) => {
    navigate(to)
    setOpen(false)
  }
  const items = [
    { label: 'Client', icon: <Building2 size={16} />, to: '/clients?new=1', show: true },
    { label: 'Lead', icon: <UserPlus size={16} />, to: '/leads?new=1', show: true },
    { label: 'Task', icon: <ListTodo size={16} />, to: '/tasks?new=1', show: isHead(me) },
  ].filter((i) => i.show)

  return (
    <div ref={ref} className="relative">
      <Button variant="primary" icon={<Plus size={16} />} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="hidden sm:inline">New</span>
      </Button>
      {open && (
        <div className="absolute top-full right-0 z-40 mt-2 w-44 animate-pop-in rounded-xl bg-white p-1.5 shadow-pop ring-1 ring-ink-200">
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              onClick={() => go(it.to)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-semibold text-ink-700 hover:bg-ink-50"
            >
              <span className="text-ink-400">{it.icon}</span>
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Layout() {
  const [navOpen, setNavOpen] = useState(false)
  const location = useLocation()
  const me = useCurrentUser()
  const tasks = useVisibleTasks()
  const leads = useStore((s) => s.leads)
  const consultations = useStore((s) => s.consultations)

  const openTasks = tasks.filter((t) => t.status !== 'completed').length
  const consultsToday = consultations.filter((c) => c.status === 'scheduled' && c.date === todayISO()).length
  const openLeads = leads.filter((l) => l.status === 'new' || l.status === 'followup').length
  const closeNav = () => setNavOpen(false)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  return (
    <div className="min-h-dvh lg:pl-56">
      {navOpen && <div className="fixed inset-0 z-40 animate-fade-in bg-ink-900/40 lg:hidden" onClick={closeNav} />}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-56 flex-col border-r border-ink-200 bg-white transition-transform duration-200 lg:translate-x-0',
          navOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center justify-between px-4">
          <NavLink to="/" onClick={closeNav} className="flex items-center gap-2.5">
            <img src="/logo-mark.jpeg" alt="FSG" className="h-8 w-auto" />
            <span className="border-l border-ink-200 pl-2.5 text-[11px] leading-tight font-bold tracking-wide text-ink-500 uppercase">
              Practice
              <br />
              Manager
            </span>
          </NavLink>
          <IconButton label="Close menu" onClick={closeNav} className="lg:hidden">
            <X size={18} />
          </IconButton>
        </div>

        <nav className="scroll-thin flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
          <NavItem to="/" icon={<LayoutDashboard size={17} />} label="Dashboard" onNavigate={closeNav} />
          <NavItem to="/tasks" icon={<ListTodo size={17} />} label="Tasks" count={openTasks} onNavigate={closeNav} />
          <NavItem to="/calendar" icon={<CalendarDays size={17} />} label="Deadlines" onNavigate={closeNav} />
          {isHead(me) && (
            <NavItem to="/consultations" icon={<Clock size={17} />} label="Consultations" count={consultsToday} onNavigate={closeNav} />
          )}

          <p className="px-2.5 pt-5 pb-1.5 text-[11px] font-bold tracking-wider text-ink-400 uppercase">Filings</p>
          <NavItem to="/filings/gst" icon={<Receipt size={17} />} label="GST" onNavigate={closeNav} />
          <NavItem to="/filings/tds" icon={<ScrollText size={17} />} label="TDS" onNavigate={closeNav} />
          <NavItem to="/filings/it" icon={<Landmark size={17} />} label="Income tax" onNavigate={closeNav} />
          <NavItem to="/filings/audit" icon={<FileCheck2 size={17} />} label="Audit" onNavigate={closeNav} />
          <NavItem to="/filings/services" icon={<Stamp size={17} />} label="One-time" onNavigate={closeNav} />

          <p className="px-2.5 pt-5 pb-1.5 text-[11px] font-bold tracking-wider text-ink-400 uppercase">Relationships</p>
          <NavItem to="/clients" icon={<Building2 size={17} />} label="Clients" onNavigate={closeNav} />
          <NavItem to="/leads" icon={<Target size={17} />} label="Leads" count={openLeads} onNavigate={closeNav} />

          <p className="px-2.5 pt-5 pb-1.5 text-[11px] font-bold tracking-wider text-ink-400 uppercase">Firm</p>
          <NavItem to="/team" icon={<Users size={17} />} label="Team" onNavigate={closeNav} />
          <NavItem to="/attendance" icon={<CalendarCheck size={17} />} label="Attendance" onNavigate={closeNav} />
        </nav>

        <div className="p-3">
          <UserSwitcher />
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-ink-200 bg-white/85 px-4 backdrop-blur sm:px-6">
        <IconButton label="Open menu" onClick={() => setNavOpen(true)} className="lg:hidden">
          <Menu size={19} />
        </IconButton>
        <GlobalSearch />
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden md:block">
            <Badge tone={ROLES[me.role].tone}>{isHead(me) ? 'Can assign & approve' : 'Reports progress'}</Badge>
          </span>
          <Reminders />
          <QuickAdd />
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
        <Outlet key={me.id} />
      </main>
    </div>
  )
}

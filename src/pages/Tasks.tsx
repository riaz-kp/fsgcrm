import { CheckCircle2, ListTodo, Plus, RotateCcw, Search, Send, Undo2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Due, RecurringTag } from '../components/bits'
import { Avatar, Badge, Button, Card, Drawer, Empty, Field, IconButton, Input, Modal, PageHeader, Person, Progress, Segmented, Select, StatusSelect, Td, Textarea, Th, TONE_BAR } from '../components/ui'
import { addDays, cn, daysUntil, fmtDate, todayISO } from '../lib/format'
import { DEPARTMENTS, PRIORITIES, PRIORITY_ORDER, TASK_STATUS, TASK_STATUS_ORDER, options } from '../lib/meta'
import { isHead, useCurrentUser, useLookup, useStore, useVisibleTasks } from '../store'
import type { Department, Priority, Recurrence, Task, TaskStatus } from '../types'

function progressTone(t: Task) {
  return t.status === 'completed' ? 'green' : daysUntil(t.dueDate) < 0 ? 'red' : t.status === 'in_review' ? 'amber' : 'blue'
}

function TaskForm({ onClose }: { onClose: () => void }) {
  const addTask = useStore((s) => s.addTask)
  const employees = useStore((s) => s.employees)
  const clients = useStore((s) => s.clients)
  const [f, setF] = useState({
    title: '',
    description: '',
    clientId: '',
    department: 'gst' as Department,
    assigneeId: employees.find((e) => e.role === 'trainee')?.id ?? employees[0].id,
    priority: 'medium' as Priority,
    dueDate: addDays(todayISO(), 7),
    recurring: '' as Recurrence | '',
  })
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }))
  const valid = f.title.trim() && f.dueDate

  const save = () => {
    if (!valid) return
    addTask({
      title: f.title.trim(),
      description: f.description.trim() || undefined,
      clientId: f.clientId || undefined,
      department: f.department,
      assigneeId: f.assigneeId,
      priority: f.priority,
      dueDate: f.dueDate,
      recurring: f.recurring || undefined,
      status: 'to_begin',
      progress: 0,
    })
    onClose()
  }

  return (
    <Modal
      wide
      title="Assign a task"
      subtitle="The assignee reports progress and remarks; you approve when it's done."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={!valid}>
            Assign task
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="What needs to be done" className="sm:col-span-2">
          <Input value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. GSTR-1 for September" autoFocus />
        </Field>
        <Field label="Client" hint="optional">
          <Select value={f.clientId} onChange={(e) => set('clientId', e.target.value)}>
            <option value="">Internal / no client</option>
            {clients
              .filter((c) => c.active)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Work head">
          <Select value={f.department} onChange={(e) => set('department', e.target.value as Department)}>
            {options(DEPARTMENTS).map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Assign to">
          <Select value={f.assigneeId} onChange={(e) => set('assigneeId', e.target.value)}>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} — {e.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Priority">
          <Select value={f.priority} onChange={(e) => set('priority', e.target.value as Priority)}>
            {PRIORITY_ORDER.map((p) => (
              <option key={p} value={p}>
                {PRIORITIES[p].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Due date">
          <Input type="date" value={f.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
        </Field>
        <Field label="Repeats">
          <Select value={f.recurring} onChange={(e) => set('recurring', e.target.value as Recurrence | '')}>
            <option value="">Does not repeat</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
          </Select>
        </Field>
        <Field label="Notes" hint="optional" className="sm:col-span-2">
          <Textarea value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="Anything the assignee should know before starting" />
        </Field>
      </div>
    </Modal>
  )
}

function TaskDrawer({ task, onClose }: { task: Task; onClose: () => void }) {
  const me = useCurrentUser()
  const head = isHead(me)
  const mine = task.assigneeId === me.id
  const canWork = (mine || head) && task.status !== 'completed'
  const updateTask = useStore((s) => s.updateTask)
  const addTaskRemark = useStore((s) => s.addTaskRemark)
  const employees = useStore((s) => s.employees)
  const { emp, client } = useLookup()
  const [text, setText] = useState('')
  const c = client(task.clientId)

  const remark = (fallback?: string) => {
    const body = text.trim() || fallback
    if (body) addTaskRemark(task.id, body)
    setText('')
  }
  const setProgress = (progress: number) =>
    updateTask(task.id, { progress, status: task.status === 'to_begin' && progress > 0 ? 'in_progress' : task.status })

  const submit = () => {
    remark('Submitted for approval.')
    updateTask(task.id, { status: 'in_review', progress: 100 })
  }
  const approve = () => {
    remark('Approved.')
    updateTask(task.id, { status: 'completed', progress: 100 })
  }
  const sendBack = () => {
    remark('Sent back for changes.')
    updateTask(task.id, { status: 'in_progress', progress: Math.min(task.progress, 80) })
  }
  const complete = () => {
    remark()
    updateTask(task.id, { status: 'completed', progress: 100 })
  }
  const reopen = () => updateTask(task.id, { status: 'in_progress', progress: Math.min(task.progress, 80) })

  return (
    <Drawer onClose={onClose} label={task.title}>
      <header className="border-b border-ink-100 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={DEPARTMENTS[task.department].tone}>{DEPARTMENTS[task.department].label}</Badge>
              <Badge tone={TASK_STATUS[task.status].tone} dot>
                {TASK_STATUS[task.status].label}
              </Badge>
              <RecurringTag every={task.recurring} />
            </div>
            <h2 className="mt-2 text-lg leading-snug font-extrabold text-ink-900">{task.title}</h2>
            {c ? (
              <Link to={`/clients/${c.id}`} className="mt-0.5 inline-block text-[13px] font-semibold text-brand-700 hover:underline">
                {c.name}
              </Link>
            ) : (
              <p className="mt-0.5 text-[13px] text-ink-500">Internal task</p>
            )}
          </div>
          <IconButton label="Close" onClick={onClose} className="-mr-2">
            <X size={18} />
          </IconButton>
        </div>
      </header>

      <div className="scroll-thin flex-1 overflow-y-auto">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-4 px-5 py-4 text-sm">
          <div>
            <dt className="mb-1 text-xs text-ink-500">Assigned to</dt>
            <dd>
              {head && task.status !== 'completed' ? (
                <Select value={task.assigneeId} onChange={(e) => updateTask(task.id, { assigneeId: e.target.value })} small aria-label="Assignee">
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </Select>
              ) : (
                <Person emp={emp(task.assigneeId)} />
              )}
            </dd>
          </div>
          <div>
            <dt className="mb-1 text-xs text-ink-500">Assigned by</dt>
            <dd className="flex h-8 items-center">
              <Person emp={emp(task.assignedById)} />
            </dd>
          </div>
          <div>
            <dt className="mb-1 text-xs text-ink-500">Due</dt>
            <dd>
              {head && task.status !== 'completed' ? (
                <Input type="date" value={task.dueDate} onChange={(e) => e.target.value && updateTask(task.id, { dueDate: e.target.value })} small aria-label="Due date" />
              ) : (
                <Due date={task.dueDate} done={task.status === 'completed'} />
              )}
            </dd>
          </div>
          <div>
            <dt className="mb-1 text-xs text-ink-500">Priority</dt>
            <dd className="flex h-8 items-center">
              <StatusSelect label="Priority" value={task.priority} options={options(PRIORITIES)} onChange={(priority) => updateTask(task.id, { priority })} disabled={!head} />
            </dd>
          </div>
        </dl>

        <section className="mx-5 rounded-xl bg-ink-50 p-4 ring-1 ring-ink-200/70">
          <div className="flex items-baseline justify-between">
            <h3 className="text-[13px] font-bold text-ink-900">Progress</h3>
            <span className="tnum text-xl font-extrabold text-ink-900">{task.progress}%</span>
          </div>
          {canWork && task.status !== 'in_review' ? (
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={task.progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              aria-label="Progress"
              className="mt-2 w-full accent-brand-600"
            />
          ) : (
            <Progress value={task.progress} tone={progressTone(task)} thick className="mt-3" />
          )}
          <p className="mt-2 text-xs text-ink-500">
            {task.status === 'completed'
              ? 'Approved and closed.'
              : task.status === 'in_review'
                ? head
                  ? 'Submitted as done. Approve it, or send it back with feedback.'
                  : `Waiting for ${emp(task.assignedById)?.name ?? 'a head'} to approve.`
                : mine
                  ? 'Drag to update, then add a remark so your head can see where it stands.'
                  : `${emp(task.assigneeId)?.name ?? 'The assignee'} updates this as the work moves.`}
          </p>
        </section>

        {task.description && (
          <section className="px-5 pt-4">
            <h3 className="mb-1 text-[13px] font-bold text-ink-900">Notes</h3>
            <p className="text-sm text-ink-700">{task.description}</p>
          </section>
        )}

        <section className="px-5 py-4">
          <h3 className="mb-3 text-[13px] font-bold text-ink-900">Remarks & feedback</h3>
          {task.remarks.length === 0 && <p className="text-[13px] text-ink-500">No remarks yet.</p>}
          <ol className="space-y-4">
            {task.remarks.map((r) => {
              const by = emp(r.by)
              return (
                <li key={r.id} className="flex gap-3">
                  <Avatar name={by?.name ?? '?'} hue={by?.hue} photo={by?.photo} size={26} />
                  <div className="min-w-0">
                    <p className="text-xs text-ink-500">
                      <span className="font-semibold text-ink-800">{by?.name}</span> · {fmtDate(r.at)}
                    </p>
                    <p className="mt-0.5 text-sm text-ink-700">{r.text}</p>
                  </div>
                </li>
              )
            })}
          </ol>
        </section>
      </div>

      <footer className="space-y-3 border-t border-ink-100 p-4">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={head && task.status === 'in_review' ? 'Feedback for the assignee (optional)…' : 'Add a remark…'}
          rows={2}
          aria-label="Remark"
        />
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="ghost" onClick={() => remark()} disabled={!text.trim()} icon={<Send size={15} />} className="mr-auto">
            Add remark
          </Button>
          {task.status === 'in_review' && head && (
            <>
              <Button icon={<Undo2 size={15} />} onClick={sendBack}>
                Send back
              </Button>
              <Button variant="primary" icon={<CheckCircle2 size={15} />} onClick={approve}>
                Approve
              </Button>
            </>
          )}
          {(task.status === 'to_begin' || task.status === 'in_progress') &&
            mine &&
            (head ? (
              <Button variant="primary" icon={<CheckCircle2 size={15} />} onClick={complete}>
                Mark completed
              </Button>
            ) : (
              <Button variant="primary" icon={<Send size={15} />} onClick={submit}>
                Submit for approval
              </Button>
            ))}
          {task.status === 'completed' && head && (
            <Button icon={<RotateCcw size={15} />} onClick={reopen}>
              Reopen
            </Button>
          )}
        </div>
      </footer>
    </Drawer>
  )
}

type StatusTab = 'open' | TaskStatus

export default function Tasks() {
  const me = useCurrentUser()
  const head = isHead(me)
  const tasks = useVisibleTasks()
  const employees = useStore((s) => s.employees)
  const clients = useStore((s) => s.clients)
  const { emp } = useLookup()
  const clientName = useMemo(() => new Map(clients.map((c) => [c.id, c.name])), [clients])
  const nameOf = (t: Task) => (t.clientId && clientName.get(t.clientId)) || 'Internal'
  const [params, setParams] = useSearchParams()
  const preset = params.get('assignee') ?? ''
  const [mineOnly, setMineOnly] = useState<'mine' | 'all'>('all')
  const [tab, setTab] = useState<StatusTab>('open')
  const [dept, setDept] = useState<Department | ''>('')
  const [assignee, setAssignee] = useState(preset)
  const [q, setQ] = useState('')
  const [view, setView] = useState<'list' | 'board'>('list')

  const open = tasks.find((t) => t.id === params.get('open'))

  const base = useMemo(() => {
    const term = q.trim().toLowerCase()
    return tasks.filter(
      (t) =>
        (mineOnly === 'all' || t.assigneeId === me.id) &&
        (!dept || t.department === dept) &&
        (!assignee || t.assigneeId === assignee) &&
        (!term || t.title.toLowerCase().includes(term) || !!(t.clientId && clientName.get(t.clientId)?.toLowerCase().includes(term))),
    )
  }, [tasks, clientName, mineOnly, me.id, dept, assignee, q])

  const count = (s: StatusTab) => base.filter((t) => (s === 'open' ? t.status !== 'completed' : t.status === s)).length
  const rows = useMemo(
    () =>
      base
        .filter((t) => (tab === 'open' ? t.status !== 'completed' : t.status === tab))
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority)),
    [base, tab],
  )

  return (
    <>
      <PageHeader
        title="Tasks"
        subtitle={head ? 'Assign work, follow progress and approve what is submitted.' : 'Only the work assigned to you. Update progress and submit when done.'}
        actions={
          <>
            <Segmented
              value={view}
              onChange={setView}
              items={[
                { value: 'list', label: 'List' },
                { value: 'board', label: 'Board' },
              ]}
            />
            {head && (
              <Button variant="primary" icon={<Plus size={16} />} onClick={() => setParams({ new: '1' })}>
                Assign task
              </Button>
            )}
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {head && (
          <Segmented
            value={mineOnly}
            onChange={setMineOnly}
            items={[
              { value: 'all', label: 'Everyone' },
              { value: 'mine', label: 'My tasks' },
            ]}
          />
        )}
        {view === 'list' && (
          <Segmented
            value={tab}
            onChange={setTab}
            items={[
              { value: 'open', label: 'All open', count: count('open') },
              ...TASK_STATUS_ORDER.map((s) => ({ value: s as StatusTab, label: TASK_STATUS[s].label, count: count(s) })),
            ]}
          />
        )}
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 p-3">
          <div className="relative min-w-52 flex-1">
            <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Task or client…"
              aria-label="Filter tasks"
              className="h-9 w-full rounded-lg bg-white pr-3 pl-9 text-sm ring-1 ring-ink-200 ring-inset placeholder:text-ink-400 focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>
          <Select value={dept} onChange={(e) => setDept(e.target.value as Department | '')} fit aria-label="Work head">
            <option value="">All work heads</option>
            {options(DEPARTMENTS).map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </Select>
          {head && mineOnly === 'all' && (
            <Select value={assignee} onChange={(e) => setAssignee(e.target.value)} fit aria-label="Assignee">
              <option value="">Anyone</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
          )}
        </div>

        {view === 'list' ? (
          rows.length === 0 ? (
            <Empty icon={<ListTodo size={20} />} title="No tasks here" hint={head ? 'Nothing matches these filters.' : 'Nothing is assigned to you in this view.'} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-sm">
                <thead className="border-b border-ink-100 bg-ink-50/60">
                  <tr>
                    <Th>Task</Th>
                    <Th>Work head</Th>
                    <Th>Assigned to</Th>
                    <Th>Due</Th>
                    <Th>Progress</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {rows.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => setParams({ open: t.id })}
                      onKeyDown={(e) => e.key === 'Enter' && setParams({ open: t.id })}
                      tabIndex={0}
                      className="cursor-pointer hover:bg-brand-50/40 focus-visible:bg-brand-50/60"
                    >
                      <Td>
                        <div className="flex items-center gap-3">
                          <span className={cn('h-9 w-1 shrink-0 rounded-full', TONE_BAR[PRIORITIES[t.priority].tone])} title={`${PRIORITIES[t.priority].label} priority`} />
                          <div className="min-w-0">
                            <p className="max-w-[360px] truncate font-semibold text-ink-900">{t.title}</p>
                            <p className="flex items-center gap-2 text-xs text-ink-500">
                              <span className="max-w-[240px] truncate">{nameOf(t)}</span>
                              <RecurringTag every={t.recurring} />
                            </p>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <Badge tone={DEPARTMENTS[t.department].tone}>{DEPARTMENTS[t.department].label}</Badge>
                      </Td>
                      <Td>
                        <Person emp={emp(t.assigneeId)} />
                      </Td>
                      <Td className="text-[13px]">
                        <Due date={t.dueDate} done={t.status === 'completed'} />
                      </Td>
                      <Td>
                        <div className="flex w-32 items-center gap-2">
                          <Progress value={t.progress} tone={progressTone(t)} className="flex-1" />
                          <span className="tnum w-9 text-right text-xs font-semibold text-ink-600">{t.progress}%</span>
                        </div>
                      </Td>
                      <Td>
                        <Badge tone={TASK_STATUS[t.status].tone} dot>
                          {TASK_STATUS[t.status].label}
                        </Badge>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <div className="scroll-thin flex gap-3 overflow-x-auto p-3 xl:grid xl:grid-cols-4">
            {TASK_STATUS_ORDER.map((s) => {
              const col = base.filter((t) => t.status === s).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
              return (
                <section key={s} className="flex w-[280px] shrink-0 flex-col rounded-xl bg-ink-100/60 p-2 xl:w-auto">
                  <header className="flex items-center gap-2 px-2 pt-1 pb-2.5">
                    <span className={cn('size-2 rounded-full', TONE_BAR[TASK_STATUS[s].tone])} />
                    <h2 className="text-[13px] font-bold text-ink-800">{TASK_STATUS[s].label}</h2>
                    <span className="tnum text-[13px] font-semibold text-ink-400">{col.length}</span>
                  </header>
                  <div className="flex min-h-20 flex-col gap-2">
                    {col.map((t) => {
                      const a = emp(t.assigneeId)
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setParams({ open: t.id })}
                          className="rounded-lg bg-white p-3 text-left shadow-card ring-1 ring-ink-200/80 transition-shadow hover:shadow-pop hover:ring-brand-300"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <Badge tone={PRIORITIES[t.priority].tone}>{PRIORITIES[t.priority].label}</Badge>
                            <span className="text-xs">
                              <Due date={t.dueDate} done={s === 'completed'} compact />
                            </span>
                          </div>
                          <p className="mt-2 line-clamp-2 leading-snug font-semibold text-ink-900">{t.title}</p>
                          <p className="mt-0.5 truncate text-xs text-ink-500">{nameOf(t)}</p>
                          <div className="mt-2.5 flex items-center gap-2">
                            <Progress value={t.progress} tone={progressTone(t)} className="flex-1" />
                            <span className="tnum text-xs font-semibold text-ink-500">{t.progress}%</span>
                            {a && <Avatar name={a.name} hue={a.hue} photo={a?.photo} size={22} />}
                          </div>
                        </button>
                      )
                    })}
                    {col.length === 0 && <p className="px-2 py-5 text-center text-xs text-ink-400">Nothing here</p>}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </Card>

      {open && <TaskDrawer key={open.id} task={open} onClose={() => setParams({})} />}
      {params.get('new') && head && <TaskForm onClose={() => setParams({})} />}
    </>
  )
}

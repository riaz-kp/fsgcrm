import { useMemo } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { buildSeed, type SeedData } from './data/seed'
import { addDays, currentGstPeriod, todayISO, uid } from './lib/format'
import { ROLE_PERMISSIONS, TEMPLATES } from './lib/meta'
import type {
  AttendanceEntry,
  AttendanceMark,
  AuditFiling,
  Client,
  Consultation,
  Employee,
  GstFiling,
  ItFiling,
  Lead,
  Permission,
  Reminder,
  ScopeDef,
  ScopeKey,
  ServiceJob,
  SimpleStatus,
  Task,
  TdsFiling,
  TemplateKey,
} from './types'

interface Actions {
  setCurrentUser: (id: string) => void
  resetDemo: () => void

  addClient: (c: Omit<Client, 'id' | 'code' | 'since' | 'requirementsSent' | 'clarifications' | 'transactions'>) => string
  updateClient: (id: string, patch: Partial<Client>) => void

  addLead: (l: Omit<Lead, 'id' | 'createdAt' | 'remarks'>, note?: string) => string
  updateLead: (id: string, patch: Partial<Lead>) => void
  addLeadRemark: (id: string, text: string) => void
  convertLead: (id: string) => string

  addTask: (t: Omit<Task, 'id' | 'createdAt' | 'remarks' | 'assignedById'>) => string
  updateTask: (id: string, patch: Partial<Task>) => void
  addTaskRemark: (id: string, text: string) => void

  updateGst: (id: string, patch: Partial<GstFiling>) => void
  updateTds: (id: string, patch: Partial<TdsFiling>) => void
  updateIt: (id: string, patch: Partial<ItFiling>) => void
  updateAudit: (id: string, patch: Partial<AuditFiling>) => void
  updateService: (id: string, patch: Partial<ServiceJob>) => void
  addService: (s: Omit<ServiceJob, 'id'>) => void

  addEmployee: (e: Omit<Employee, 'id' | 'hue' | 'active'>) => void
  updateEmployee: (id: string, patch: Partial<Employee>) => void

  addConsultation: (c: Omit<Consultation, 'id'>) => void
  updateConsultation: (id: string, patch: Partial<Consultation>) => void
  /** Move a consultation to a new slot, keeping the old one on record. */
  postponeConsultation: (id: string, date: string, time: string, reason?: string) => void

  addScope: (s: Omit<ScopeDef, 'key' | 'builtin'>) => void
  updateScope: (key: ScopeKey, patch: Partial<Omit<ScopeDef, 'key' | 'builtin'>>) => void
  /** Takes the scope off every client and lead too. Built-in scopes stay. */
  deleteScope: (key: ScopeKey) => void

  /** Pass nothing to go back to what the person's role gives. */
  setPermissions: (employeeId: string, permissions?: Permission[]) => void
  /** Pass nothing to go back to the wording the app ships with. */
  setTemplate: (key: TemplateKey, text?: string) => void

  addReminder: (r: Omit<Reminder, 'id' | 'createdBy' | 'done'>) => void
  updateReminder: (id: string, patch: Partial<Reminder>) => void
  deleteReminder: (id: string) => void
  /** Tick off (or untick) one occurrence of a reminder. */
  toggleReminderDone: (id: string, date: string) => void

  /** Pass no mark to clear the day. Times are kept only for days worked. */
  setAttendance: (employeeId: string, date: string, mark?: AttendanceMark) => void
  /** Record time in or out; an empty string clears it. Marks the day present if it was blank. */
  setAttendanceTime: (employeeId: string, date: string, patch: Pick<AttendanceEntry, 'in' | 'out'>) => void
}

export interface State extends SeedData, Actions {
  currentUserId: string
}

function patchIn<T extends { id: string }>(list: T[], id: string, patch: Partial<T>): T[] {
  return list.map((x) => (x.id === id ? { ...x, ...patch } : x))
}

/** Like patchIn, but notes the day the work was filed or completed, and forgets it if the status is moved back. */
function patchStatus<T extends { id: string; status: SimpleStatus; doneOn?: string }>(list: T[], id: string, patch: Partial<T>): T[] {
  return list.map((x) => {
    if (x.id !== id) return x
    const next = { ...x, ...patch }
    const done = next.status === 'filed' || next.status === 'completed'
    next.doneOn = done ? (x.doneOn ?? todayISO()) : undefined
    return next
  })
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...buildSeed(),
      // Praveen allocates the work, so the demo opens on his view.
      currentUserId: 'e-praveen',

      setCurrentUser: (id) => set({ currentUserId: id }),
      resetDemo: () => set({ ...buildSeed(), currentUserId: 'e-praveen' }),

      addClient: (c) => {
        const { clients } = get()
        const next = Math.max(1000, ...clients.map((x) => Number(x.code.split('-')[1]) || 0)) + 1
        const id = uid('c')
        set({
          clients: [
            { ...c, id, code: `FSG-${next}`, since: todayISO(), requirementsSent: {}, clarifications: [], transactions: [] },
            ...clients,
          ],
        })
        return id
      },
      updateClient: (id, patch) => set((s) => ({ clients: patchIn(s.clients, id, patch) })),

      addLead: (l, note) => {
        const id = uid('l')
        const at = todayISO()
        const remarks = note ? [{ id: uid('r'), by: get().currentUserId, at, text: note }] : []
        set((s) => ({ leads: [{ ...l, id, createdAt: at, remarks }, ...s.leads] }))
        return id
      },
      updateLead: (id, patch) => set((s) => ({ leads: patchIn(s.leads, id, patch) })),
      addLeadRemark: (id, text) =>
        set((s) => ({
          leads: s.leads.map((l) =>
            l.id === id
              ? { ...l, remarks: [...l.remarks, { id: uid('r'), by: s.currentUserId, at: todayISO(), text }] }
              : l,
          ),
        })),
      convertLead: (id) => {
        const lead = get().leads.find((l) => l.id === id)
        if (!lead) return ''
        const clientId = get().addClient({
          name: lead.name,
          category: lead.category,
          business: '',
          place: lead.place,
          phone: lead.phone,
          whatsapp: lead.whatsapp,
          email: '',
          active: true,
          scopes: lead.scopes,
          scopeDetails: lead.scopeDetails,
          gstFrequency: lead.scopes.includes('gst_filing') ? 'M' : undefined,
          credentials: [],
          documents: [],
        })
        if (lead.scopes.includes('gst_filing')) {
          const period = currentGstPeriod()
          set((s) => ({
            gst: [
              ...s.gst,
              {
                id: `g-${clientId}-${period}`,
                clientId,
                period,
                gstr1: 'to_begin',
                gstr3b: 'to_begin',
                assigneeId: 'e-anna',
                prevBalance: 0,
                fee: 1500,
                received: 0,
                remark: 'New client',
              },
            ],
          }))
        }
        get().updateLead(id, { status: 'won', nextFollowUp: undefined })
        return clientId
      },

      addTask: (t) => {
        const id = uid('t')
        set((s) => ({
          tasks: [{ ...t, id, createdAt: todayISO(), remarks: [], assignedById: s.currentUserId }, ...s.tasks],
        }))
        return id
      },
      updateTask: (id, patch) => set((s) => ({ tasks: patchIn(s.tasks, id, patch) })),
      addTaskRemark: (id, text) =>
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id
              ? { ...t, remarks: [...t.remarks, { id: uid('r'), by: s.currentUserId, at: todayISO(), text }] }
              : t,
          ),
        })),

      updateGst: (id, patch) => set((s) => ({ gst: patchIn(s.gst, id, patch) })),
      updateTds: (id, patch) => set((s) => ({ tds: patchIn(s.tds, id, patch) })),
      updateIt: (id, patch) => set((s) => ({ it: patchStatus(s.it, id, patch) })),
      updateAudit: (id, patch) => set((s) => ({ audits: patchStatus(s.audits, id, patch) })),
      updateService: (id, patch) => set((s) => ({ services: patchStatus(s.services, id, patch) })),
      addService: (job) => set((s) => ({ services: [{ ...job, id: uid('s') }, ...s.services] })),

      addEmployee: (e) =>
        set((s) => ({
          employees: [...s.employees, { ...e, id: uid('e'), hue: (s.employees.length * 47 + 120) % 360, active: true }],
        })),
      updateEmployee: (id, patch) => set((s) => ({ employees: patchIn(s.employees, id, patch) })),

      addConsultation: (c) => set((s) => ({ consultations: [...s.consultations, { ...c, id: uid('k') }] })),
      updateConsultation: (id, patch) => set((s) => ({ consultations: patchIn(s.consultations, id, patch) })),
      postponeConsultation: (id, date, time, reason) =>
        set((s) => ({
          consultations: s.consultations.map((c) =>
            c.id === id
              ? { ...c, date, time, status: 'scheduled', postponed: [...(c.postponed ?? []), { date: c.date, time: c.time, on: todayISO(), reason: reason || undefined }] }
              : c,
          ),
        })),

      addScope: (def) => set((s) => ({ scopes: [...s.scopes, { ...def, key: uid('x') }] })),
      updateScope: (key, patch) => set((s) => ({ scopes: s.scopes.map((x) => (x.key === key ? { ...x, ...patch } : x)) })),
      deleteScope: (key) =>
        set((s) => {
          if (s.scopes.find((x) => x.key === key)?.builtin) return {}
          const drop = <T extends Partial<Record<ScopeKey, string>>>(rec: T | undefined): T | undefined => {
            if (!rec || !(key in rec)) return rec
            const next = { ...rec }
            delete next[key]
            return next
          }
          return {
            scopes: s.scopes.filter((x) => x.key !== key),
            clients: s.clients.map((c) =>
              c.scopes.includes(key) || c.clarifications.some((q) => q.scope === key)
                ? {
                    ...c,
                    scopes: c.scopes.filter((k) => k !== key),
                    scopeDetails: drop(c.scopeDetails),
                    requirementsSent: drop(c.requirementsSent) ?? {},
                    // Call notes are kept; they just stop pointing at a scope that is gone.
                    clarifications: c.clarifications.map((q) => (q.scope === key ? { ...q, scope: 'general' as const } : q)),
                  }
                : c,
            ),
            leads: s.leads.map((l) => (l.scopes.includes(key) ? { ...l, scopes: l.scopes.filter((k) => k !== key), scopeDetails: drop(l.scopeDetails) } : l)),
          }
        }),

      setPermissions: (employeeId, permissions) => set((s) => ({ employees: patchIn(s.employees, employeeId, { permissions }) })),
      setTemplate: (key, text) =>
        set((s) => {
          const templates = { ...s.templates }
          if (text === undefined || text === TEMPLATES[key].text) delete templates[key]
          else templates[key] = text
          return { templates }
        }),

      addReminder: (r) => set((s) => ({ reminders: [...s.reminders, { ...r, id: uid('m'), createdBy: s.currentUserId, done: [] }] })),
      updateReminder: (id, patch) => set((s) => ({ reminders: patchIn(s.reminders, id, patch) })),
      deleteReminder: (id) => set((s) => ({ reminders: s.reminders.filter((r) => r.id !== id) })),
      toggleReminderDone: (id, date) =>
        set((s) => ({
          reminders: s.reminders.map((r) => (r.id === id ? { ...r, done: r.done.includes(date) ? r.done.filter((d) => d !== date) : [...r.done, date] } : r)),
        })),

      setAttendance: (employeeId, date, mark) =>
        set((s) => {
          const days = { ...s.attendance[employeeId] }
          if (!mark) delete days[date]
          else if (mark === 'P' || mark === 'H') days[date] = { ...days[date], mark }
          else days[date] = { mark }
          return { attendance: { ...s.attendance, [employeeId]: days } }
        }),
      setAttendanceTime: (employeeId, date, patch) =>
        set((s) => {
          const days = { ...s.attendance[employeeId] }
          const was = days[date]
          const entry: AttendanceEntry = { ...was, mark: was?.mark === 'H' ? 'H' : 'P', ...patch }
          if (!entry.in) delete entry.in
          if (!entry.out) delete entry.out
          days[date] = entry
          return { attendance: { ...s.attendance, [employeeId]: days } }
        }),
    }),
    {
      name: 'fsg-crm-demo',
      version: 5,
      // The demo's shape changed; older saved sample data is replaced rather than patched.
      migrate: () => ({ ...buildSeed(), currentUserId: 'e-praveen' }) as State,
    },
  ),
)

/* ---------- Small derived helpers ---------- */

export function useCurrentUser(): Employee {
  const id = useStore((s) => s.currentUserId)
  const employees = useStore((s) => s.employees)
  return employees.find((e) => e.id === id) ?? employees[0]
}

/** Heads and the CEO lead the firm and are who people report to. What anyone may do is a separate matter: see `can`. */
export function isHead(e: Employee): boolean {
  return e.role === 'ceo' || e.role === 'head'
}

/** What a person may do: what was set for them in Settings, or else what their role gives. */
export function permissionsOf(e: Employee): Permission[] {
  return e.permissions ?? ROLE_PERMISSIONS[e.role]
}

export function can(e: Employee, p: Permission): boolean {
  return permissionsOf(e).includes(p)
}

/** `const can = useCan(); can('view_fees')` for the person using the app. */
export function useCan(): (p: Permission) => boolean {
  const me = useCurrentUser()
  return useMemo(() => {
    const mine = new Set(permissionsOf(me))
    return (p: Permission) => mine.has(p)
  }, [me])
}

/** People who assign work see every task; everyone else sees only what is assigned to them. */
export function useVisibleTasks(): Task[] {
  const me = useCurrentUser()
  const tasks = useStore((s) => s.tasks)
  return useMemo(() => (can(me, 'assign_tasks') ? tasks : tasks.filter((t) => t.assigneeId === me.id)), [tasks, me])
}

/** The firm's scopes of work, with lookups that cope with a key whose scope has since been deleted. */
export function useScopes() {
  const list = useStore((s) => s.scopes)
  return useMemo(() => {
    const byKey = new Map(list.map((s) => [s.key, s]))
    return {
      list,
      groups: [...new Set(list.map((s) => s.group))],
      get: (key: ScopeKey) => byKey.get(key),
      label: (key: ScopeKey) => byKey.get(key)?.label ?? 'Removed scope',
      short: (key: ScopeKey) => byKey.get(key)?.short ?? '?',
    }
  }, [list])
}

export function useTemplate(key: TemplateKey): string {
  return useStore((s) => s.templates[key]) ?? TEMPLATES[key].text
}

/* ---------- Reminders ---------- */

export interface Occurrence {
  reminder: Reminder
  date: string
  done: boolean
}

/** Every date a reminder falls on inside [from, to]. Monthly ones on the 29th to 31st fall on the last day of shorter months. */
export function occurrences(r: Reminder, from: string, to: string): Occurrence[] {
  const out: Occurrence[] = []
  const push = (date: string) => date >= from && date <= to && date >= r.date && out.push({ reminder: r, date, done: r.done.includes(date) })
  if (r.repeat === 'none') {
    push(r.date)
    return out
  }
  const day = Number(r.date.slice(8, 10))
  const month = r.date.slice(5, 7)
  const startY = Number(from.slice(0, 4))
  const endY = Number(to.slice(0, 4))
  for (let y = startY; y <= endY; y++) {
    for (let m = 1; m <= 12; m++) {
      const mm = String(m).padStart(2, '0')
      if (r.repeat === 'yearly' && mm !== month) continue
      const last = new Date(y, m, 0).getDate()
      push(`${y}-${mm}-${String(Math.min(day, last)).padStart(2, '0')}`)
    }
  }
  return out
}

/** A person's reminders (their own and everyone's) that fall inside [from, to]. */
export function useReminderOccurrences(from: string, to: string): Occurrence[] {
  const me = useCurrentUser()
  const reminders = useStore((s) => s.reminders)
  return useMemo(
    () =>
      reminders
        .filter((r) => !r.forId || r.forId === me.id)
        .flatMap((r) => occurrences(r, from, to))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [reminders, me, from, to],
  )
}

/**
 * Open reminders whose notice period has started. A missed one stays until it is ticked off, going back up to a
 * year; for a repeating reminder only the latest missed date is kept, so a monthly one does not pile up.
 */
export function useDueReminders(): Occurrence[] {
  const today = todayISO()
  const list = useReminderOccurrences(addDays(today, -365), addDays(today, 60))
  return useMemo(() => {
    const open = list.filter((o) => !o.done && addDays(o.date, -o.reminder.notifyDays) <= today)
    const latestMissed = new Map<string, string>()
    for (const o of open) if (o.date < today) latestMissed.set(o.reminder.id, o.date)
    return open.filter((o) => o.date >= today || latestMissed.get(o.reminder.id) === o.date)
  }, [list, today])
}

export function useLookup() {
  const employees = useStore((s) => s.employees)
  const clients = useStore((s) => s.clients)
  return {
    emp: (id?: string) => employees.find((e) => e.id === id),
    client: (id?: string) => clients.find((c) => c.id === id),
  }
}

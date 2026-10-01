import { useMemo } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { buildSeed, type SeedData } from './data/seed'
import { currentGstPeriod, todayISO, uid } from './lib/format'
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
  ServiceJob,
  SimpleStatus,
  Task,
  TdsFiling,
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
                source: 'bills',
                stage: 'awaiting',
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
      version: 4,
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

/** Heads and the CEO allocate work and approve it; trainees report on it. */
export function isHead(e: Employee): boolean {
  return e.role === 'ceo' || e.role === 'head'
}

/** Heads see every task; everyone else sees only what is assigned to them. */
export function useVisibleTasks(): Task[] {
  const me = useCurrentUser()
  const tasks = useStore((s) => s.tasks)
  return useMemo(() => (isHead(me) ? tasks : tasks.filter((t) => t.assigneeId === me.id)), [tasks, me])
}

export function useLookup() {
  const employees = useStore((s) => s.employees)
  const clients = useStore((s) => s.clients)
  return {
    emp: (id?: string) => employees.find((e) => e.id === id),
    client: (id?: string) => clients.find((c) => c.id === id),
  }
}

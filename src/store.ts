import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { buildSeed, type SeedData } from './data/seed'
import { currentGstPeriod, todayISO, uid } from './lib/format'
import type {
  AuditFiling,
  Client,
  Employee,
  GstFiling,
  ItFiling,
  Lead,
  ScopeKey,
  ServiceJob,
  Task,
  TdsFiling,
} from './types'

interface Actions {
  setCurrentUser: (id: string) => void
  resetDemo: () => void

  addClient: (c: Omit<Client, 'id' | 'code' | 'since'>) => string
  updateClient: (id: string, patch: Partial<Client>) => void
  toggleScope: (id: string, scope: ScopeKey) => void

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
}

export interface State extends SeedData, Actions {
  currentUserId: string
}

function patchIn<T extends { id: string }>(list: T[], id: string, patch: Partial<T>): T[] {
  return list.map((x) => (x.id === id ? { ...x, ...patch } : x))
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
        set({ clients: [{ ...c, id, code: `FSG-${next}`, since: todayISO() }, ...clients] })
        return id
      },
      updateClient: (id, patch) => set((s) => ({ clients: patchIn(s.clients, id, patch) })),
      toggleScope: (id, scope) =>
        set((s) => ({
          clients: s.clients.map((c) =>
            c.id === id
              ? { ...c, scopes: c.scopes.includes(scope) ? c.scopes.filter((x) => x !== scope) : [...c.scopes, scope] }
              : c,
          ),
        })),

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
          email: '',
          active: true,
          scopes: lead.scopes,
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
      updateIt: (id, patch) => set((s) => ({ it: patchIn(s.it, id, patch) })),
      updateAudit: (id, patch) => set((s) => ({ audits: patchIn(s.audits, id, patch) })),
      updateService: (id, patch) => set((s) => ({ services: patchIn(s.services, id, patch) })),
      addService: (job) => set((s) => ({ services: [{ ...job, id: uid('s') }, ...s.services] })),

      addEmployee: (e) =>
        set((s) => ({
          employees: [...s.employees, { ...e, id: uid('e'), hue: (s.employees.length * 47 + 120) % 360, active: true }],
        })),
    }),
    { name: 'fsg-crm-demo', version: 1 },
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

export function useLookup() {
  const employees = useStore((s) => s.employees)
  const clients = useStore((s) => s.clients)
  return {
    emp: (id?: string) => employees.find((e) => e.id === id),
    client: (id?: string) => clients.find((c) => c.id === id),
  }
}

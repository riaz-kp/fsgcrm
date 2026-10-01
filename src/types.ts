export type Role = 'ceo' | 'head' | 'trainee' | 'staff'

export interface Employee {
  id: string
  name: string
  title: string
  role: Role
  reportsTo?: string
  responsibilities: string[]
  phone: string
  email: string
  hue: number
  active: boolean
}

export type ClientCategory =
  | 'Company'
  | 'LLP'
  | 'Individual'
  | 'Proprietorship'
  | 'Partnership'
  | 'Trust'

export type ScopeKey =
  | 'gst_registration'
  | 'gst_filing'
  | 'incorporation'
  | 'it_non_audit'
  | 'it_audit'
  | 'internal_audit'
  | 'tds'
  | 'eway'
  | 'pf'
  | 'esi'
  | 'project_report'

export type Portal = 'gst' | 'eway' | 'it' | 'tds' | 'traces_deductor' | 'traces_taxpayer'

export interface Credential {
  portal: Portal
  username: string
  password: string
}

export type DocKind =
  | 'Aadhaar'
  | 'PAN'
  | 'Financial statement'
  | 'Tally backup'
  | 'Bills'
  | 'Other'

export interface ClientDoc {
  id: string
  name: string
  kind: DocKind
  sizeKb: number
  uploadedAt: string
}

export interface Client {
  id: string
  code: string
  name: string
  category: ClientCategory
  profession?: string
  business: string
  place: string
  phone: string
  email: string
  gstin?: string
  pan?: string
  tan?: string
  gstFrequency?: 'M' | 'Q'
  active: boolean
  scopes: ScopeKey[]
  credentials: Credential[]
  documents: ClientDoc[]
  since: string
}

export interface Remark {
  id: string
  by: string
  at: string
  text: string
}

export type LeadStatus = 'new' | 'followup' | 'won' | 'lost'

export interface Lead {
  id: string
  name: string
  contact: string
  phone: string
  place: string
  source: string
  category: ClientCategory
  scopes: ScopeKey[]
  status: LeadStatus
  ownerId: string
  nextFollowUp?: string
  createdAt: string
  remarks: Remark[]
}

export type Department = 'gst' | 'tds' | 'it' | 'audit' | 'registration' | 'bookkeeping' | 'general'

export type Priority = 'low' | 'medium' | 'high' | 'urgent'

export type TaskStatus = 'to_begin' | 'in_progress' | 'in_review' | 'completed'

export type Recurrence = 'monthly' | 'quarterly' | 'yearly'

export interface Task {
  id: string
  title: string
  description?: string
  clientId?: string
  department: Department
  assigneeId: string
  assignedById: string
  priority: Priority
  status: TaskStatus
  progress: number
  dueDate: string
  recurring?: Recurrence
  createdAt: string
  remarks: Remark[]
}

/* ---------- Compliance trackers ---------- */

export type GstStatus = 'to_begin' | 'data_pending' | 'in_progress' | 'filed' | 'nil' | 'na'

/** How far the client's data has travelled: bills -> Tally -> Excel -> JSON for the offline tool. */
export type GstStage = 'awaiting' | 'bills' | 'tally' | 'excel' | 'json'

export interface GstFiling {
  id: string
  clientId: string
  period: string // YYYY-MM
  source: 'bills' | 'tally' | 'excel'
  stage: GstStage
  gstr1: GstStatus
  gstr3b: GstStatus
  assigneeId: string
  prevBalance: number
  fee: number
  received: number
  remark: string
}

export type SimpleStatus = 'to_begin' | 'pending' | 'filed' | 'completed'

export interface TdsFiling {
  id: string
  clientId: string
  fy: string
  payment: 'paid' | 'due' | 'na'
  quarters: [SimpleStatus, SimpleStatus, SimpleStatus, SimpleStatus]
  assigneeId: string
  remark: string
}

export interface ItFiling {
  id: string
  clientId: string
  ay: string
  kind: 'non_audit' | 'audit'
  status: SimpleStatus
  dataReceived: boolean
  assigneeId: string
  fee: number
  received: number
  remark: string
}

export interface AuditFiling {
  id: string
  clientId: string
  fy: string
  kind: 'Tax audit' | 'Statutory audit' | 'Internal audit' | 'Nil audit'
  status: SimpleStatus
  reconciliation: boolean
  assigneeId: string
  dueDate: string
  remark: string
}

export type ServiceKind =
  | 'GST registration'
  | 'MSME registration'
  | 'LLP incorporation'
  | 'Company incorporation'
  | 'Partnership formation'
  | 'Trademark'
  | 'FSSAI'
  | 'DSC'

export interface ServiceJob {
  id: string
  party: string
  clientId?: string
  kind: ServiceKind
  status: SimpleStatus
  committedDate: string
  assigneeId: string
  fee: number
  received: number
  remark: string
}

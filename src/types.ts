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
  joined?: string
  dob?: string
  /** Small data-URL image, resized in the browser before saving. */
  photo?: string
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
  | 'annual_return'
  | 'incorporation'
  | 'it_non_audit'
  | 'it_audit'
  | 'internal_audit'
  | 'tds'
  | 'eway'
  | 'pf'
  | 'esi'
  | 'project_report'
  | 'legal_metrology'
  | 'certification'
  | 'tan_application'
  | 'pan_application'
  | 'other'

export type ScopeDetails = Partial<Record<ScopeKey, string>>

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
  /** Kept apart from the phone: many clients message from a different number. */
  whatsapp?: string
  email: string
  gstin?: string
  pan?: string
  tan?: string
  gstFrequency?: 'M' | 'Q'
  active: boolean
  scopes: ScopeKey[]
  /** Which certificate, what "other" means, and so on. */
  scopeDetails?: ScopeDetails
  credentials: Credential[]
  documents: ClientDoc[]
  /** Date the requirement list for a scope was sent to the client. */
  requirementsSent: Partial<Record<ScopeKey, string>>
  clarifications: Clarification[]
  transactions: Transaction[]
  since: string
}

export interface Clarification {
  id: string
  scope: ScopeKey | 'general'
  at: string
  by: string
  summary: string
  recording?: { name: string; sizeKb: number }
}

export type PaymentMode = 'Cash' | 'UPI' | 'Bank transfer' | 'Cheque'

export interface Transaction {
  id: string
  date: string
  /** A charge raises what the client owes; a payment reduces it. */
  kind: 'charge' | 'payment'
  description: string
  amount: number
  mode?: PaymentMode
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
  whatsapp?: string
  place: string
  source: string
  category: ClientCategory
  scopes: ScopeKey[]
  scopeDetails?: ScopeDetails
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

export type TdsPayment = 'paid' | 'due' | 'na'

export interface TdsFiling {
  id: string
  clientId: string
  fy: string
  /** Month the tax was deducted in (YYYY-MM) -> whether it has been deposited. */
  payments: Record<string, TdsPayment>
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
  /** Stamped when the status moves to filed or completed. */
  doneOn?: string
}

export interface AuditFiling {
  id: string
  clientId: string
  fy: string
  kind: 'Tax audit' | 'Statutory audit' | 'Internal audit' | 'Nil audit'
  status: SimpleStatus
  reconciliation: boolean
  /** Tracked for internal audits only. */
  dataReceived: boolean
  assigneeId: string
  dueDate: string
  remark: string
  doneOn?: string
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
  | 'Legal metrology'
  | 'Certification'
  | 'TAN application'
  | 'PAN application'
  | 'Other'

export interface ServiceJob {
  id: string
  party: string
  clientId?: string
  kind: ServiceKind
  /** Which certificate, what "other" means, and so on. */
  details?: string
  status: SimpleStatus
  committedDate: string
  assigneeId: string
  fee: number
  received: number
  remark: string
  doneOn?: string
}

/* ---------- Consultations & attendance ---------- */

export type ConsultMode = 'In person' | 'Phone' | 'Video'

export interface Consultation {
  id: string
  withName: string
  clientId?: string
  date: string
  time: string // HH:MM, 24h
  durationMin: number
  topic: string
  mode: ConsultMode
  status: 'scheduled' | 'done' | 'cancelled'
  notes: string
}

export type AttendanceMark = 'P' | 'H' | 'L' | 'A'

export interface AttendanceEntry {
  mark: AttendanceMark
  /** Time in and out, HH:MM in 24h. Only kept for days worked. */
  in?: string
  out?: string
}

/** employee id -> date -> entry */
export type Attendance = Record<string, Record<string, AttendanceEntry>>

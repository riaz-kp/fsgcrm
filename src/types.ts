export type Role = 'ceo' | 'head' | 'trainee' | 'staff'

export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-'

export interface FamilyDetails {
  fatherName?: string
  fatherOccupation?: string
  fatherPhone?: string
  motherName?: string
  motherOccupation?: string
  siblings?: string
}

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
  /** Age is worked out from this, never stored. */
  dob?: string
  address?: string
  bloodGroup?: BloodGroup
  qualification?: string
  family?: FamilyDetails
  /** Small data-URL image, resized in the browser before saving. */
  photo?: string
  /** What this person may do. Left unset, it follows their role (see ROLE_PERMISSIONS). */
  permissions?: Permission[]
}

/** Things the firm can allow or withhold person by person, in Settings. */
export type Permission =
  | 'assign_tasks'
  | 'edit_clients'
  | 'view_logins'
  | 'view_fees'
  | 'consultations'
  | 'manage_attendance'
  | 'view_team'
  | 'edit_team'
  | 'settings'

export type ClientCategory =
  | 'Company'
  | 'LLP'
  | 'Individual'
  | 'Proprietorship'
  | 'Partnership'
  | 'Trust'

/** The scopes the app ships with. Deadlines and trackers are worked out from these keys, so they cannot be deleted. */
export type BuiltinScope =
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

/** A built-in key, or one made in Settings (those start with `x-`). */
export type ScopeKey = BuiltinScope | (string & {})

export type TrackerTab = 'gst' | 'tds' | 'it' | 'audit' | 'services'

export interface ScopeDef {
  key: ScopeKey
  label: string
  /** For the small chips on lists. */
  short: string
  group: string
  /** The filing tracker this scope's work is followed in, if it has one. */
  tracker?: TrackerTab
  /** Set for scopes that need a line saying what exactly is meant. */
  detailHint?: string
  builtin?: boolean
}

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

/** What the client sent for the month. Bills go into Tally, Tally out to Excel, Excel to JSON for the offline tool. */
export type GstDataType = 'bills' | 'tally' | 'excel' | 'json'

export interface GstFiling {
  id: string
  clientId: string
  period: string // YYYY-MM
  dataType?: GstDataType
  /** The day the client's data for the period came in. */
  dataIn?: string
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
  /** Month (YYYY-MM) -> the day that month's deduction details came in. */
  dataIn: Record<string, string>
  assigneeId: string
  /** Billed for the year's TDS work so far, and what has come in against it. */
  fee: number
  received: number
  remark: string
}

export interface ItFiling {
  id: string
  clientId: string
  ay: string
  kind: 'non_audit' | 'audit'
  status: SimpleStatus
  dataIn?: string
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
  dataIn?: string
  assigneeId: string
  dueDate: string
  fee: number
  received: number
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
  dataIn?: string
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
  /** Earlier slots, oldest first, each with the day it was moved and why. */
  postponed?: Postponement[]
}

export interface Postponement {
  date: string
  time: string
  on: string
  reason?: string
}

/* ---------- Reminders & message templates ---------- */

export type ReminderRepeat = 'none' | 'monthly' | 'yearly'

/** A date someone wants to be reminded of, on top of the ones worked out from scopes, tasks and leads. */
export interface Reminder {
  id: string
  title: string
  note?: string
  /** The first (or only) date. A monthly reminder repeats on this day of the month, a yearly one on this day and month. */
  date: string
  repeat: ReminderRepeat
  /** How many days ahead it starts showing under the bell. */
  notifyDays: number
  /** Whose reminder it is; unset means everyone's. */
  forId?: string
  clientId?: string
  createdBy: string
  /** Dates (one per occurrence) that have been ticked off. */
  done: string[]
}

export type TemplateKey = 'status' | 'requirements'

export type AttendanceMark = 'P' | 'H' | 'L' | 'A'

export interface AttendanceEntry {
  mark: AttendanceMark
  /** Time in and out, HH:MM in 24h. Only kept for days worked. */
  in?: string
  out?: string
}

/** employee id -> date -> entry */
export type Attendance = Record<string, Record<string, AttendanceEntry>>

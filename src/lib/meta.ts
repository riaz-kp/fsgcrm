import type {
  AttendanceMark,
  BloodGroup,
  ClientCategory,
  ConsultMode,
  PaymentMode,
  Department,
  DocKind,
  GstStage,
  GstStatus,
  LeadStatus,
  Portal,
  Priority,
  Role,
  ScopeDetails,
  ScopeKey,
  ServiceKind,
  SimpleStatus,
  TaskStatus,
} from '../types'

export type Tone = 'neutral' | 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'teal'

type Meta<K extends string> = Record<K, { label: string; tone: Tone }>

export const CATEGORIES: ClientCategory[] = [
  'Company',
  'LLP',
  'Partnership',
  'Proprietorship',
  'Individual',
  'Trust',
]

export const CATEGORY_TONE: Record<ClientCategory, Tone> = {
  Company: 'blue',
  LLP: 'violet',
  Partnership: 'teal',
  Proprietorship: 'amber',
  Individual: 'neutral',
  Trust: 'green',
}

export type TrackerTab = 'gst' | 'tds' | 'it' | 'audit' | 'services'

export interface ScopeMeta {
  key: ScopeKey
  label: string
  short: string
  group: string
  /** The filing tracker this scope's work is followed in, if it has one. */
  tracker?: TrackerTab
  /** Set for scopes that need a line saying what exactly is meant. */
  detailHint?: string
}

export const SCOPES: ScopeMeta[] = [
  { key: 'gst_registration', label: 'GST registration', short: 'GST Reg', group: 'GST', tracker: 'services' },
  { key: 'gst_filing', label: 'GST filing', short: 'GST', group: 'GST', tracker: 'gst' },
  { key: 'annual_return', label: 'Annual return', short: 'Annual', group: 'GST', tracker: 'gst' },
  { key: 'eway', label: 'E-way bill', short: 'E-way', group: 'GST', tracker: 'gst' },
  { key: 'it_non_audit', label: 'IT · non-audit case', short: 'IT', group: 'Income tax & audit', tracker: 'it' },
  { key: 'it_audit', label: 'IT · audit case', short: 'IT Audit', group: 'Income tax & audit', tracker: 'it' },
  { key: 'internal_audit', label: 'Internal audit', short: 'Int. Audit', group: 'Income tax & audit', tracker: 'audit' },
  { key: 'tds', label: 'TDS', short: 'TDS', group: 'Payroll & TDS', tracker: 'tds' },
  { key: 'pf', label: 'PF', short: 'PF', group: 'Payroll & TDS' },
  { key: 'esi', label: 'ESI', short: 'ESI', group: 'Payroll & TDS' },
  { key: 'incorporation', label: 'Incorporation / formation', short: 'Incorp', group: 'One-time', tracker: 'services' },
  { key: 'project_report', label: 'Project report', short: 'Proj. Report', group: 'One-time' },
  { key: 'legal_metrology', label: 'Legal metrology', short: 'Legal Met.', group: 'One-time', tracker: 'services' },
  { key: 'certification', label: 'Certifications', short: 'Cert.', group: 'One-time', tracker: 'services', detailHint: 'Which certificate? e.g. ISO 9001 renewal' },
  { key: 'tan_application', label: 'TAN application', short: 'TAN', group: 'One-time', tracker: 'services' },
  { key: 'pan_application', label: 'PAN application', short: 'PAN', group: 'One-time', tracker: 'services' },
  { key: 'other', label: 'Other', short: 'Other', group: 'One-time', tracker: 'services', detailHint: 'What is the work?' },
]

export const SCOPE_GROUPS = [...new Set(SCOPES.map((s) => s.group))]

/** Keep only the notes that belong to a ticked scope and say something. */
export function pruneScopeDetails(scopes: ScopeKey[], details: ScopeDetails): ScopeDetails | undefined {
  const kept = Object.fromEntries(
    SCOPES.filter((s) => s.detailHint && scopes.includes(s.key) && details[s.key]?.trim()).map((s) => [s.key, details[s.key]!.trim()]),
  )
  return Object.keys(kept).length ? kept : undefined
}

export const SCOPE_LABEL = Object.fromEntries(SCOPES.map((s) => [s.key, s.label])) as Record<ScopeKey, string>
export const SCOPE_SHORT = Object.fromEntries(SCOPES.map((s) => [s.key, s.short])) as Record<ScopeKey, string>

export const PORTALS: Record<Portal, { label: string; hint: string }> = {
  gst: { label: 'GST portal', hint: 'gst.gov.in' },
  eway: { label: 'E-way bill', hint: 'ewaybillgst.gov.in' },
  it: { label: 'Income tax', hint: 'PAN as username' },
  tds: { label: 'Income tax (TDS)', hint: 'TAN as username' },
  traces_deductor: { label: 'TRACES · deductor', hint: 'tdscpc.gov.in' },
  traces_taxpayer: { label: 'TRACES · taxpayer', hint: 'tdscpc.gov.in' },
}

export const DOC_KINDS: DocKind[] = ['Aadhaar', 'PAN', 'Financial statement', 'Tally backup', 'Bills', 'Other']

export const DEPARTMENTS: Meta<Department> = {
  gst: { label: 'GST', tone: 'blue' },
  tds: { label: 'TDS', tone: 'violet' },
  it: { label: 'Income tax', tone: 'teal' },
  audit: { label: 'Audit', tone: 'amber' },
  registration: { label: 'Registration', tone: 'green' },
  bookkeeping: { label: 'Book keeping', tone: 'neutral' },
  general: { label: 'General', tone: 'neutral' },
}

export const PRIORITIES: Meta<Priority> = {
  low: { label: 'Low', tone: 'neutral' },
  medium: { label: 'Medium', tone: 'blue' },
  high: { label: 'High', tone: 'amber' },
  urgent: { label: 'Urgent', tone: 'red' },
}

export const PRIORITY_ORDER: Priority[] = ['urgent', 'high', 'medium', 'low']

export const TASK_STATUS: Meta<TaskStatus> = {
  to_begin: { label: 'To begin', tone: 'neutral' },
  in_progress: { label: 'In progress', tone: 'blue' },
  in_review: { label: 'Awaiting approval', tone: 'amber' },
  completed: { label: 'Completed', tone: 'green' },
}

export const TASK_STATUS_ORDER: TaskStatus[] = ['to_begin', 'in_progress', 'in_review', 'completed']

export const LEAD_STATUS: Meta<LeadStatus> = {
  new: { label: 'New enquiry', tone: 'blue' },
  followup: { label: 'Follow-up', tone: 'amber' },
  won: { label: 'Won', tone: 'green' },
  lost: { label: 'Lost', tone: 'red' },
}

export const LEAD_STATUS_ORDER: LeadStatus[] = ['new', 'followup', 'won', 'lost']

export const GST_STATUS: Meta<GstStatus> = {
  to_begin: { label: 'To begin', tone: 'neutral' },
  data_pending: { label: 'No data yet', tone: 'red' },
  in_progress: { label: 'In progress', tone: 'amber' },
  filed: { label: 'Filed', tone: 'green' },
  nil: { label: 'Nil filed', tone: 'teal' },
  na: { label: 'N/A', tone: 'neutral' },
}

export const GST_STAGES: Array<{ key: GstStage; label: string }> = [
  { key: 'bills', label: 'Bills' },
  { key: 'tally', label: 'Tally' },
  { key: 'excel', label: 'Excel' },
  { key: 'json', label: 'JSON' },
]

export const SIMPLE_STATUS: Meta<SimpleStatus> = {
  to_begin: { label: 'To begin', tone: 'neutral' },
  pending: { label: 'Pending', tone: 'amber' },
  filed: { label: 'Filed', tone: 'blue' },
  completed: { label: 'Completed', tone: 'green' },
}

export const SERVICE_KINDS: ServiceKind[] = [
  'GST registration',
  'MSME registration',
  'LLP incorporation',
  'Company incorporation',
  'Partnership formation',
  'Trademark',
  'FSSAI',
  'DSC',
  'Legal metrology',
  'Certification',
  'TAN application',
  'PAN application',
  'Other',
]

export const ATTENDANCE: Record<AttendanceMark, { label: string; tone: Tone }> = {
  P: { label: 'Present', tone: 'green' },
  H: { label: 'Half day', tone: 'amber' },
  L: { label: 'Leave', tone: 'violet' },
  A: { label: 'Absent', tone: 'red' },
}

export const ATTENDANCE_ORDER: AttendanceMark[] = ['P', 'H', 'L', 'A']

export const PAYMENT_MODES: PaymentMode[] = ['UPI', 'Cash', 'Bank transfer', 'Cheque']

export const CONSULT_MODES: ConsultMode[] = ['In person', 'Phone', 'Video']

export const BLOOD_GROUPS: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

/** How the firm signs what goes out to clients. */
export const FIRM_NAME = 'Fin Savvy Consultors LLP'

export const ROLES: Meta<Role> = {
  ceo: { label: 'CEO', tone: 'blue' },
  head: { label: 'Head', tone: 'violet' },
  staff: { label: 'Staff', tone: 'teal' },
  trainee: { label: 'Trainee', tone: 'neutral' },
}

export const LEAD_SOURCES = ['Referral', 'Walk-in', 'Phone call', 'WhatsApp', 'Existing client', 'Website']

export function options<K extends string>(meta: Meta<K>): Array<{ value: K; label: string; tone: Tone }> {
  return (Object.keys(meta) as K[]).map((value) => ({ value, ...meta[value] }))
}

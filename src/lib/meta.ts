import type {
  AttendanceMark,
  BloodGroup,
  ClientCategory,
  ConsultMode,
  PaymentMode,
  Department,
  DocKind,
  BuiltinScope,
  GstDataType,
  GstStatus,
  LeadStatus,
  Permission,
  Portal,
  Priority,
  Role,
  ScopeDef,
  ScopeDetails,
  ScopeKey,
  ServiceKind,
  SimpleStatus,
  TaskStatus,
  TemplateKey,
  TrackerTab,
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

export type { TrackerTab }

/** Where a scope's work is followed, for the scope form in Settings. */
export const TRACKERS: Record<TrackerTab, string> = {
  gst: 'GST filing',
  tds: 'TDS',
  it: 'Income tax',
  audit: 'Audit',
  services: 'One-time work',
}

/** The scopes the firm started with. More can be added, and these renamed, in Settings. */
export const BUILTIN_SCOPES: ScopeDef[] = (
  [
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
  ] satisfies Array<ScopeDef & { key: BuiltinScope }>
).map((s) => ({ ...s, builtin: true }))

/** Groups in the order their first scope appears. */
export function scopeGroups(defs: ScopeDef[]): string[] {
  return [...new Set(defs.map((s) => s.group))]
}

/** Keep only the notes that belong to a ticked scope and say something. */
export function pruneScopeDetails(scopes: ScopeKey[], details: ScopeDetails, defs: ScopeDef[]): ScopeDetails | undefined {
  const kept = Object.fromEntries(
    defs.filter((s) => s.detailHint && scopes.includes(s.key) && details[s.key]?.trim()).map((s) => [s.key, details[s.key]!.trim()]),
  )
  return Object.keys(kept).length ? kept : undefined
}

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

export const GST_DATA_TYPES: Array<{ value: GstDataType; label: string }> = [
  { value: 'bills', label: 'Bills' },
  { value: 'tally', label: 'Tally backup' },
  { value: 'excel', label: 'Excel file' },
  { value: 'json', label: 'JSON file' },
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
}

export const ATTENDANCE_ORDER: AttendanceMark[] = ['P', 'H', 'L']

export const PAYMENT_MODES: PaymentMode[] = ['UPI', 'Cash', 'Bank transfer', 'Cheque']

export const CONSULT_MODES: ConsultMode[] = ['In person', 'Phone', 'Video']

export const BLOOD_GROUPS: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

/** How the firm signs what goes out to clients. */
export const FIRM_NAME = 'Fin Savvy Consultors LLP'

export const ROLES: Meta<Role> = {
  admin: { label: 'Admin', tone: 'blue' },
  ceo: { label: 'CEO', tone: 'blue' },
  head: { label: 'Head', tone: 'violet' },
  staff: { label: 'Staff', tone: 'teal' },
  trainee: { label: 'Trainee', tone: 'neutral' },
}

export const LEAD_SOURCES = ['Referral', 'Walk-in', 'Phone call', 'WhatsApp', 'Existing client', 'Website']

/* ---------- Permissions ---------- */

export const PERMISSIONS: Array<{ key: Permission; label: string; short: string; hint: string }> = [
  { key: 'assign_tasks', label: 'Assign & approve tasks', short: 'Tasks', hint: "Assigns work, sees everyone's tasks and approves what is submitted. Without it a person sees only their own tasks." },
  { key: 'edit_clients', label: 'Add & edit clients', short: 'Clients', hint: 'Adds clients, edits their details and scope of work, and marks them active or inactive.' },
  { key: 'view_logins', label: 'See portal passwords', short: 'Passwords', hint: "Sees and copies clients' GST, income tax and TRACES passwords. Without it only usernames show." },
  { key: 'view_fees', label: 'See fees & payments', short: 'Fees', hint: 'Sees fees, payments and balances in the trackers, on client pages and on the dashboard.' },
  { key: 'consultations', label: "CEO's consultations", short: 'Consults', hint: "Opens the CEO's consultation diary to schedule, postpone or close appointments." },
  { key: 'manage_attendance', label: 'Keep attendance', short: 'Attendance', hint: 'Marks attendance and time in and out for everyone. Without it a person sees only their own.' },
  {
    key: 'view_team',
    label: "See colleagues' details",
    short: 'Team',
    hint: "Sees everyone's personal and family details, work and attendance. Without it a person sees only their own, and of colleagues just their role, contact and birthday.",
  },
  {
    key: 'edit_team',
    label: 'Add & edit team',
    short: 'Edit team',
    hint: "Adds team members and edits anyone's profile, role and reporting line. Without it a person edits only their own photo, personal and family details.",
  },
  { key: 'settings', label: 'Change settings', short: 'Settings', hint: 'Changes scopes, permissions and message templates in Settings.' },
  {
    key: 'manage_logins',
    label: 'Give out logins',
    short: 'Logins',
    hint: 'Creates usernames and passwords for the team, sets new passwords and removes logins, and can make someone admin or CEO. Only people who have it can give it to others.',
  },
]

const ALL_PERMISSIONS = PERMISSIONS.map((p) => p.key)

/** What each role gets until someone changes it person by person. The admin and the CEO get everything; heads all but giving out logins. Mirrors role_permissions in the database. */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: ALL_PERMISSIONS,
  ceo: ALL_PERMISSIONS,
  head: ALL_PERMISSIONS.filter((p) => p !== 'manage_logins'),
  staff: ['edit_clients', 'view_logins', 'view_fees'],
  trainee: ['edit_clients', 'view_logins', 'view_fees'],
}

/* ---------- WhatsApp templates ---------- */

export const TEMPLATES: Record<TemplateKey, { label: string; hint: string; fields: Array<{ key: string; hint: string }>; text: string }> = {
  status: {
    label: 'Work status',
    hint: 'Send status on a client page drafts this, with the lines the staff member ticks in place of {status}.',
    fields: [
      { key: 'greeting', hint: 'Dear Sir/Madam, or Dear <name> for individuals' },
      { key: 'client', hint: 'Client name' },
      { key: 'date', hint: "Today's date" },
      { key: 'status', hint: 'The ticked status lines, one per line' },
      { key: 'staff', hint: 'Name of the person sending it' },
      { key: 'firm', hint: 'Fin Savvy Consultors LLP' },
    ],
    text: `{greeting},

Status of the work for {client} as on {date}:

{status}

Please let us know if you need anything further.

Regards,
{staff}
{firm}`,
  },
  requirements: {
    label: 'Documents required',
    hint: 'Send on WhatsApp on the Requirements page drafts this, with the ticked checklist in place of {checklist}.',
    fields: [
      { key: 'greeting', hint: 'Dear Sir/Madam, or Dear <name> for individuals' },
      { key: 'client', hint: 'Client name, or "you" when no client is picked' },
      { key: 'services', hint: 'The services picked, e.g. GST registration (Partnership)' },
      { key: 'checklist', hint: 'The ticked documents, grouped' },
      { key: 'staff', hint: 'Name of the person sending it' },
      { key: 'firm', hint: 'Fin Savvy Consultors LLP' },
    ],
    text: `{greeting},

For {services}, please send us the following:

{checklist}

All mobile numbers given should be linked to Aadhaar.

Regards,
{staff}
{firm}`,
  },
}

/** Fill a template's {placeholders}; anything not known is left as written. */
export function fillTemplate(text: string, values: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (all, key: string) => values[key] ?? all)
}

export function options<K extends string>(meta: Meta<K>): Array<{ value: K; label: string; tone: Tone }> {
  return (Object.keys(meta) as K[]).map((value) => ({ value, ...meta[value] }))
}

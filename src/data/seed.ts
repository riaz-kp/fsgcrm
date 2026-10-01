/**
 * Sample data for the demo. Staff are FSG's own team; every client, lead,
 * credential and figure below is made up.
 */
import { addDays, currentGstPeriod, financialYear, periodLabel, shiftPeriod, todayISO } from '../lib/format'
import type {
  Attendance,
  AttendanceMark,
  AuditFiling,
  Client,
  Consultation,
  ClientCategory,
  ClientDoc,
  Credential,
  Employee,
  GstFiling,
  GstStage,
  GstStatus,
  ItFiling,
  Lead,
  Remark,
  ScopeKey,
  ServiceJob,
  SimpleStatus,
  Task,
  TdsFiling,
} from '../types'

export interface SeedData {
  employees: Employee[]
  clients: Client[]
  leads: Lead[]
  tasks: Task[]
  gst: GstFiling[]
  tds: TdsFiling[]
  it: ItFiling[]
  audits: AuditFiling[]
  services: ServiceJob[]
  consultations: Consultation[]
  attendance: Attendance
}

const E = {
  vijeesh: 'e-vijeesh',
  praveen: 'e-praveen',
  anna: 'e-anna',
  husni: 'e-husni',
  henna: 'e-henna',
  afna: 'e-afna',
  hari: 'e-harikrishna',
  ramees: 'e-ramees',
  shani: 'e-shani',
} as const

function employees(today: string): Employee[] {
  let n = 0
  const mk = (
    id: string,
    name: string,
    title: string,
    role: Employee['role'],
    hue: number,
    responsibilities: string[],
    reportsTo?: string,
  ): Employee => {
    const i = n++
    // Placeholder dates so the demo has something to show. One birthday lands
    // today and one later this week; replace with the real ones.
    const birthday = i === 4 ? today : i === 7 ? addDays(today, 5) : addDays(today, 40 + i * 37)
    return {
      joined: addDays(today, -(2400 - i * 260)),
      dob: `${1984 + i * 2}${birthday.slice(4)}`,
      ...base(id, name, title, role, hue, responsibilities, reportsTo),
    }
  }
  const base = (
    id: string,
    name: string,
    title: string,
    role: Employee['role'],
    hue: number,
    responsibilities: string[],
    reportsTo?: string,
  ): Employee => ({
    id,
    name,
    title,
    role,
    hue,
    responsibilities,
    reportsTo,
    phone: '',
    email: `${name.toLowerCase()}@fsg.example`,
    active: true,
  })
  return [
    mk(E.vijeesh, 'Vijeesh', 'CEO', 'ceo', 212, ['Audit head', 'TDS filing', 'IT filing']),
    mk(E.praveen, 'Praveen', 'Operations Head', 'head', 262, ['Operations', 'Audit head', 'Task allocation'], E.vijeesh),
    mk(
      E.anna,
      'Anna',
      'GST Filing Head',
      'head',
      332,
      ['GST filing', 'MSME registration', 'LLP incorporation', 'Company nil audit'],
      E.praveen,
    ),
    mk(E.husni, 'Husni', 'Trainee', 'trainee', 24, ['Book keeping'], E.anna),
    mk(E.henna, 'Henna', 'Trainee', 'trainee', 162, ['GST registration'], E.anna),
    mk(E.afna, 'Afna', 'Trainee', 'trainee', 292, ['DSC'], E.anna),
    mk(E.hari, 'Harikrishna', 'Trainee', 'trainee', 190, ['GST filing'], E.anna),
    mk(E.ramees, 'Ramees', 'Trainee', 'trainee', 46, ['GST filing'], E.anna),
    mk(E.shani, 'Shani', 'Trainee', 'trainee', 348, ['Client lead management'], E.praveen),
  ]
}

type ClientRow = [
  name: string,
  category: ClientCategory,
  business: string,
  place: string,
  scopes: ScopeKey[],
  extra?: { profession?: string; freq?: 'M' | 'Q'; inactive?: boolean },
]

const CLIENT_ROWS: ClientRow[] = [
  ['Malabar Spice Traders', 'Proprietorship', 'Spices wholesale', 'Kozhikode', ['gst_filing', 'it_non_audit', 'eway']],
  [
    'Kadalundi Marine Exports Pvt Ltd',
    'Company',
    'Seafood export',
    'Kozhikode',
    ['gst_filing', 'it_audit', 'tds', 'eway', 'pf', 'esi'],
  ],
  ['Greenleaf Ayurveda LLP', 'LLP', 'Ayurvedic products', 'Thrissur', ['gst_filing', 'it_audit', 'tds']],
  ['Dr. Anjali Menon', 'Individual', 'Medical practice', 'Manjeri', ['it_non_audit'], { profession: 'Doctor' }],
  [
    'Nila Builders & Developers',
    'Partnership',
    'Construction',
    'Malappuram',
    ['gst_filing', 'it_audit', 'tds', 'project_report'],
  ],
  ['Thejas Electricals', 'Proprietorship', 'Electrical goods retail', 'Perinthalmanna', ['gst_filing', 'it_non_audit'], { freq: 'Q' }],
  ['Coastal Cashew Company', 'Partnership', 'Cashew processing', 'Kollam', ['gst_filing', 'it_audit', 'eway', 'pf', 'esi']],
  ['Ponnani Textiles', 'Proprietorship', 'Textile retail', 'Ponnani', ['gst_filing', 'it_non_audit']],
  [
    'Zenith Infotech Pvt Ltd',
    'Company',
    'Software services',
    'Kochi',
    ['gst_filing', 'it_audit', 'tds', 'pf', 'internal_audit'],
  ],
  ['Hilltop Plantations LLP', 'LLP', 'Tea & cardamom estate', 'Wayanad', ['gst_filing', 'it_audit', 'tds'], { freq: 'Q' }],
  ['Rahul K. Nair', 'Individual', 'Salaried', 'Kochi', ['it_non_audit'], { profession: 'Software engineer' }],
  [
    'Sahara Hypermarket',
    'Partnership',
    'Supermarket',
    'Tirur',
    ['gst_filing', 'it_audit', 'tds', 'eway', 'pf', 'esi'],
  ],
  ['Aura Dental Clinic', 'Proprietorship', 'Dental clinic', 'Kottakkal', ['it_non_audit', 'tds'], { profession: 'Doctor' }],
  ['Kerala Timber Mart', 'Proprietorship', 'Timber trading', 'Nilambur', ['gst_filing', 'eway', 'it_audit']],
  [
    'Bright Future Educational Trust',
    'Trust',
    'School',
    'Malappuram',
    ['it_audit', 'internal_audit', 'tds', 'pf', 'esi'],
  ],
  ['FreshBake Foods', 'Proprietorship', 'Bakery', 'Manjeri', ['gst_registration', 'gst_filing', 'it_non_audit'], { freq: 'Q' }],
  ['Orbit Logistics LLP', 'LLP', 'Transport & logistics', 'Palakkad', ['gst_filing', 'eway', 'tds', 'it_audit']],
  ['Fathima Beevi', 'Individual', 'Commission income', 'Tirur', ['it_non_audit'], { profession: 'Commission agent' }],
  ['Metro Steel Agencies', 'Partnership', 'Steel distribution', 'Kozhikode', ['gst_filing', 'eway', 'it_audit', 'tds']],
  [
    'Lakeview Resorts Pvt Ltd',
    'Company',
    'Hospitality',
    'Alappuzha',
    ['gst_filing', 'tds', 'it_audit', 'pf', 'esi', 'internal_audit'],
  ],
  ['Suresh Babu P.', 'Individual', 'Salaried', 'Malappuram', ['it_non_audit'], { profession: 'Bank manager' }],
  ['Evergreen Agro Mills', 'Proprietorship', 'Rice mill', 'Palakkad', ['gst_filing', 'it_non_audit', 'project_report'], { freq: 'Q' }],
  ['Pixel Print House', 'Proprietorship', 'Printing press', 'Tirur', ['gst_filing', 'it_non_audit'], { freq: 'Q', inactive: true }],
  ['Crescent Medicals', 'Partnership', 'Pharmacy', 'Perinthalmanna', ['gst_filing', 'it_non_audit', 'tds']],
  ['Skyline Interiors LLP', 'LLP', 'Interior design', 'Kochi', ['incorporation', 'gst_registration', 'gst_filing']],
  ['Dr. Vivek Raj', 'Individual', 'Medical practice', 'Thrissur', ['it_non_audit'], { profession: 'Doctor' }],
]

function clients(today: string): Client[] {
  return CLIENT_ROWS.map(([name, category, business, place, rowScopes, extra], i) => {
    const n = 1001 + i
    // Companies, LLPs and partnerships on GST also file the annual return.
    const scopes: ScopeKey[] =
      rowScopes.includes('gst_filing') && category !== 'Proprietorship' ? [...rowScopes, 'annual_return'] : rowScopes
    const code = `FSG-${n}`
    const pan = `DEMOP${n}X`
    const tan = `DEMO${10000 + i}T`
    const hasGst = scopes.includes('gst_filing')
    const hasTds = scopes.includes('tds')
    const slug = name.toLowerCase().replace(/[^a-z]/g, '').slice(0, 10)
    const pw = (p: string) => `Sample@${p}${n}`

    const credentials: Credential[] = []
    if (hasGst) credentials.push({ portal: 'gst', username: `${slug}_gst`, password: pw('G') })
    if (scopes.includes('eway')) credentials.push({ portal: 'eway', username: `${slug}_ewb`, password: pw('E') })
    if (scopes.includes('it_non_audit') || scopes.includes('it_audit'))
      credentials.push({ portal: 'it', username: pan, password: pw('I') })
    if (hasTds) {
      credentials.push({ portal: 'tds', username: tan, password: pw('T') })
      credentials.push({ portal: 'traces_deductor', username: `${slug}${n}`, password: pw('D') })
      if (i % 2 === 0) credentials.push({ portal: 'traces_taxpayer', username: pan, password: pw('P') })
    }

    const documents: ClientDoc[] = []
    const doc = (label: string, kind: ClientDoc['kind'], sizeKb: number, daysAgo: number) =>
      documents.push({ id: `${code}-d${documents.length}`, name: label, kind, sizeKb, uploadedAt: addDays(today, -daysAgo) })
    if (category === 'Individual' || category === 'Proprietorship') doc('Aadhaar.pdf', 'Aadhaar', 420, 200 + i)
    doc('PAN card.pdf', 'PAN', 180, 200 + i)
    if (scopes.includes('it_audit')) doc('Financial statements FY 2025-26.xlsx', 'Financial statement', 1380, 40 + i)
    if (hasGst && i % 3 === 0) doc('Tally backup Sep.zip', 'Tally backup', 184_000, 2)
    if (hasGst && i % 3 === 1) doc('Purchase & sales bills Sep.zip', 'Bills', 96_000, 3)

    const requirementsSent: Client['requirementsSent'] = {}
    scopes.forEach((s, k) => {
      if ((i + k) % 3 !== 0) requirementsSent[s] = addDays(today, -(18 + k * 4))
    })

    const clarifications: Client['clarifications'] = []
    if (i % 4 === 0)
      clarifications.push({
        id: `${code}-q0`,
        scope: 'general',
        at: addDays(today, -6),
        by: E.shani,
        summary: 'Client asked for one consolidated fee statement each month instead of separate messages per filing.',
      })
    if (i % 4 === 1)
      clarifications.push({
        id: `${code}-q1`,
        scope: scopes[0],
        at: addDays(today, -3),
        by: E.anna,
        summary: 'Called about two purchase bills with a mismatched GSTIN. Client will get corrected bills from the supplier this week.',
        recording: { name: `call-${addDays(today, -3)}.m4a`, sizeKb: 2140 },
      })

    return {
      id: `c-${n}`,
      code,
      name,
      category,
      profession: extra?.profession,
      business,
      place,
      phone: `90000 ${String(10000 + n).slice(-5)}`,
      email: `${slug}@example.com`,
      gstin: hasGst ? `32${pan}1Z${i % 9}` : undefined,
      pan,
      tan: hasTds ? tan : undefined,
      gstFrequency: hasGst ? (extra?.freq ?? 'M') : undefined,
      active: !extra?.inactive,
      scopes,
      credentials,
      documents,
      requirementsSent,
      clarifications,
      transactions: [],
      since: addDays(today, -(900 - i * 28)),
    }
  })
}

function remark(by: string, at: string, text: string): Remark {
  return { id: `r-${by}-${at}-${text.length}`, by, at, text }
}

function leads(today: string): Lead[] {
  const d = (n: number) => addDays(today, n)
  return [
    {
      id: 'l-1',
      name: 'Oceanic Sea Foods',
      contact: 'Shameer',
      phone: '90000 20001',
      place: 'Beypore',
      source: 'Referral',
      category: 'Partnership',
      scopes: ['gst_filing', 'it_audit', 'eway'],
      status: 'new',
      ownerId: E.shani,
      nextFollowUp: d(1),
      createdAt: d(-1),
      remarks: [remark(E.shani, d(-1), 'Referred by Kadalundi Marine. Currently filing with another consultant, unhappy with delays.')],
    },
    {
      id: 'l-2',
      name: 'Nisha Boutique',
      contact: 'Nisha',
      phone: '90000 20002',
      place: 'Manjeri',
      source: 'Walk-in',
      category: 'Proprietorship',
      scopes: ['gst_registration', 'gst_filing'],
      status: 'new',
      ownerId: E.shani,
      nextFollowUp: d(0),
      createdAt: d(0),
      remarks: [remark(E.shani, d(0), 'New shop opening next month. Wants GST registration before stock purchase.')],
    },
    {
      id: 'l-3',
      name: 'TechNest Solutions',
      contact: 'Arun',
      phone: '90000 20003',
      place: 'Kozhikode',
      source: 'Website',
      category: 'Company',
      scopes: ['incorporation', 'gst_registration', 'tds'],
      status: 'new',
      ownerId: E.shani,
      nextFollowUp: d(2),
      createdAt: d(-2),
      remarks: [remark(E.shani, d(-2), 'Two founders, want a private limited company. Asked for a fee quote.')],
    },
    {
      id: 'l-4',
      name: 'Al Ameen Bakers',
      contact: 'Ameen',
      phone: '90000 20004',
      place: 'Tirur',
      source: 'Phone call',
      category: 'Proprietorship',
      scopes: ['gst_filing', 'it_non_audit'],
      status: 'followup',
      ownerId: E.shani,
      nextFollowUp: d(0),
      createdAt: d(-9),
      remarks: [
        remark(E.shani, d(-9), 'Enquired about monthly GST filing charges.'),
        remark(E.shani, d(-4), 'Shared fee. Will confirm after speaking with partner.'),
      ],
    },
    {
      id: 'l-5',
      name: 'Royal Granites',
      contact: 'Basheer',
      phone: '90000 20005',
      place: 'Malappuram',
      source: 'Existing client',
      category: 'Partnership',
      scopes: ['it_audit', 'tds', 'project_report'],
      status: 'followup',
      ownerId: E.praveen,
      nextFollowUp: d(3),
      createdAt: d(-14),
      remarks: [
        remark(E.shani, d(-14), 'Needs project report for a term loan and takeover of audit.'),
        remark(E.praveen, d(-6), 'Met at their office. Waiting for last two years financials.'),
      ],
    },
    {
      id: 'l-6',
      name: 'Dr. Sameera K.',
      contact: 'Sameera',
      phone: '90000 20006',
      place: 'Perinthalmanna',
      source: 'Referral',
      category: 'Individual',
      scopes: ['it_non_audit'],
      status: 'followup',
      ownerId: E.shani,
      nextFollowUp: d(-1),
      createdAt: d(-7),
      remarks: [remark(E.shani, d(-7), 'Referred by Dr. Anjali Menon. Asked to call back after clinic hours.')],
    },
    {
      id: 'l-7',
      name: 'Harvest Organic Farms',
      contact: 'Jithin',
      phone: '90000 20007',
      place: 'Wayanad',
      source: 'WhatsApp',
      category: 'LLP',
      scopes: ['incorporation', 'gst_registration'],
      status: 'followup',
      ownerId: E.shani,
      nextFollowUp: d(5),
      createdAt: d(-11),
      remarks: [remark(E.shani, d(-11), 'Wants LLP incorporation. Partners to finalise name options.')],
    },
    {
      id: 'l-8',
      name: 'Skyline Interiors',
      contact: 'Nithin',
      phone: '90000 20008',
      place: 'Kochi',
      source: 'Referral',
      category: 'LLP',
      scopes: ['incorporation', 'gst_registration', 'gst_filing'],
      status: 'won',
      ownerId: E.shani,
      createdAt: d(-32),
      remarks: [
        remark(E.shani, d(-32), 'Wants LLP incorporation and GST.'),
        remark(E.anna, d(-20), 'Fee agreed. Onboarded as client.'),
      ],
    },
    {
      id: 'l-9',
      name: 'FreshBake Foods',
      contact: 'Rasheed',
      phone: '90000 20009',
      place: 'Manjeri',
      source: 'Walk-in',
      category: 'Proprietorship',
      scopes: ['gst_registration', 'gst_filing'],
      status: 'won',
      ownerId: E.shani,
      createdAt: d(-48),
      remarks: [remark(E.shani, d(-40), 'Confirmed. GST registration started by Henna.')],
    },
    {
      id: 'l-10',
      name: 'Star Mobiles',
      contact: 'Faisal',
      phone: '90000 20010',
      place: 'Kottakkal',
      source: 'Phone call',
      category: 'Proprietorship',
      scopes: ['gst_filing'],
      status: 'lost',
      ownerId: E.shani,
      createdAt: d(-26),
      remarks: [remark(E.shani, d(-18), 'Went with a consultant nearer to the shop. Fee was not the issue.')],
    },
    {
      id: 'l-11',
      name: 'Unity Travels',
      contact: 'Sajid',
      phone: '90000 20011',
      place: 'Kozhikode',
      source: 'Website',
      category: 'Partnership',
      scopes: ['gst_filing', 'tds'],
      status: 'lost',
      ownerId: E.shani,
      createdAt: d(-35),
      remarks: [remark(E.shani, d(-28), 'No response after three follow-ups.')],
    },
  ]
}

function tasks(today: string, cs: Client[]): Task[] {
  const d = (n: number) => addDays(today, n)
  const c = (name: string) => cs.find((x) => x.name.startsWith(name))?.id
  const period = currentGstPeriod()
  const mon = periodLabel(period, true).split(' ')[0]
  let i = 0
  const t = (
    title: string,
    client: string | undefined,
    department: Task['department'],
    assigneeId: string,
    assignedById: string,
    priority: Task['priority'],
    status: Task['status'],
    progress: number,
    due: number,
    extra: Partial<Task> = {},
  ): Task => ({
    id: `t-${++i}`,
    title,
    clientId: client ? c(client) : undefined,
    department,
    assigneeId,
    assignedById,
    priority,
    status,
    progress,
    dueDate: d(due),
    createdAt: d(Math.min(due - 6, -2)),
    remarks: [],
    ...extra,
  })

  return [
    t(`GSTR-1 for ${mon} — convert bills to Tally`, 'Malabar Spice', 'gst', E.hari, E.anna, 'high', 'in_progress', 60, 8, {
      recurring: 'monthly',
      description: 'Client sent purchase and sales bills as photos. Enter in Tally, export to Excel, then JSON for the offline tool.',
      remarks: [remark(E.hari, d(-1), 'Sales bills entered. 14 purchase bills still unclear, asked client to resend.')],
    }),
    t(`GSTR-1 for ${mon}`, 'Kadalundi Marine', 'gst', E.ramees, E.anna, 'high', 'in_review', 100, 8, {
      recurring: 'monthly',
      remarks: [remark(E.ramees, d(0), 'JSON generated from Tally backup and uploaded. Ready for review before filing.')],
    }),
    t(`GSTR-1 for ${mon}`, 'Sahara Hypermarket', 'gst', E.ramees, E.anna, 'urgent', 'to_begin', 0, 7, {
      recurring: 'monthly',
      description: 'High volume. Tally backup expected from their accountant.',
    }),
    t(`GSTR-3B for ${mon}`, 'Greenleaf Ayurveda', 'gst', E.hari, E.anna, 'medium', 'to_begin', 0, 17, { recurring: 'monthly' }),
    t(`GSTR-1 for ${mon} — Excel to JSON`, 'Metro Steel', 'gst', E.husni, E.anna, 'medium', 'in_progress', 40, 9, {
      recurring: 'monthly',
      remarks: [remark(E.husni, d(-1), 'Excel received in their own format. Re-mapping columns to the standard template.')],
    }),
    t('Follow up for August sales data', 'Thejas Electricals', 'gst', E.husni, E.anna, 'high', 'in_progress', 20, -2, {
      remarks: [remark(E.husni, d(-3), 'Called twice. Owner travelling, will send by weekend.')],
    }),
    t('GST registration — new application', 'FreshBake Foods', 'registration', E.henna, E.anna, 'high', 'in_progress', 75, 4, {
      description: 'Date committed to the client. ARN generated, waiting on officer query.',
      remarks: [remark(E.henna, d(-2), 'Clarification raised on rental agreement. Reply filed with fresh NOC.')],
    }),
    t('GST registration documents collection', 'Skyline Interiors', 'registration', E.henna, E.anna, 'medium', 'to_begin', 0, 6),
    t('DSC renewal for both directors', 'Zenith Infotech', 'registration', E.afna, E.praveen, 'medium', 'in_progress', 50, 0, {
      remarks: [remark(E.afna, d(-1), 'One director video verification done. Second pending.')],
    }),
    t('DSC for designated partners', 'Skyline Interiors', 'registration', E.afna, E.anna, 'low', 'completed', 100, -5),
    t('TDS payment challan — September', 'Lakeview Resorts', 'tds', E.vijeesh, E.vijeesh, 'urgent', 'in_progress', 50, 0, {
      recurring: 'monthly',
    }),
    t('TDS return Q2 — 24Q and 26Q', 'Sahara Hypermarket', 'tds', E.vijeesh, E.vijeesh, 'high', 'to_begin', 0, 30, {
      recurring: 'quarterly',
    }),
    t('TDS return Q2 — collect deduction details', 'Orbit Logistics', 'tds', E.ramees, E.vijeesh, 'medium', 'to_begin', 0, 20, {
      recurring: 'quarterly',
    }),
    t('Tax audit — finalise 3CD', 'Nila Builders', 'audit', E.praveen, E.vijeesh, 'urgent', 'in_progress', 85, -1, {
      recurring: 'yearly',
      description: 'Statutory date has passed; filing under the extended window.',
      remarks: [remark(E.praveen, d(-1), 'Stock valuation note pending from client. Rest of 3CD complete.')],
    }),
    t('Reconciliation — 26AS vs books', 'Coastal Cashew', 'audit', E.husni, E.praveen, 'high', 'in_review', 100, 0, {
      remarks: [remark(E.husni, d(0), 'Reconciled. Two TDS entries not reflecting in 26AS, noted in sheet.')],
    }),
    t('ITR — audit case filing', 'Kerala Timber Mart', 'it', E.vijeesh, E.vijeesh, 'high', 'to_begin', 0, 28, { recurring: 'yearly' }),
    t('ITR — audit case filing', 'Metro Steel', 'it', E.vijeesh, E.vijeesh, 'medium', 'in_progress', 30, 26, { recurring: 'yearly' }),
    t('Company nil audit — batch 3 (20 companies)', undefined, 'audit', E.anna, E.praveen, 'medium', 'in_progress', 55, 14, {
      description: 'Nil audit for dormant companies. 11 of 20 done in this batch.',
    }),
    t('Internal audit — Q2 vouching', 'Bright Future', 'audit', E.praveen, E.vijeesh, 'medium', 'to_begin', 0, 21),
    t('Book keeping — September entries', 'Crescent Medicals', 'bookkeeping', E.husni, E.praveen, 'medium', 'in_progress', 65, 5, {
      recurring: 'monthly',
    }),
    t('Project report for term loan', 'Evergreen Agro', 'general', E.praveen, E.vijeesh, 'high', 'in_progress', 45, 10, {
      description: 'Bank asked for 5-year projections with DSCR.',
    }),
    t('MSME (Udyam) registration', 'FreshBake Foods', 'registration', E.anna, E.praveen, 'low', 'completed', 100, -8),
    t('LLP incorporation — file FiLLiP', 'Skyline Interiors', 'registration', E.anna, E.praveen, 'high', 'completed', 100, -12),
    t('Call back new enquiries from this week', undefined, 'general', E.shani, E.praveen, 'medium', 'in_progress', 35, 0),
    t('Send fee reminder to clients with balance over ₹5,000', undefined, 'general', E.shani, E.praveen, 'low', 'to_begin', 0, 4),
    t('E-way bill portal — reset password', 'Kerala Timber Mart', 'gst', E.hari, E.anna, 'low', 'completed', 100, -3),
  ]
}

function gst(cs: Client[]): GstFiling[] {
  const filers = cs.filter((c) => c.scopes.includes('gst_filing'))
  const staff = [E.hari, E.ramees, E.husni, E.anna, E.henna]
  const current = currentGstPeriod()
  const out: GstFiling[] = []
  const ORDER: GstStage[] = ['bills', 'tally', 'excel', 'json']

  // What the current month looks like part-way through: a mix of every state.
  const live: Array<[GstStage, GstStatus, GstStatus, string]> = [
    ['tally', 'in_progress', 'to_begin', ''],
    ['json', 'filed', 'in_progress', ''],
    ['json', 'filed', 'filed', ''],
    ['awaiting', 'data_pending', 'to_begin', 'Reminder sent on WhatsApp'],
    ['excel', 'in_progress', 'to_begin', ''],
    ['json', 'nil', 'nil', 'No transactions this month'],
    ['bills', 'in_progress', 'to_begin', ''],
    ['json', 'filed', 'to_begin', ''],
  ]

  filers.forEach((c, i) => {
    const source: GstFiling['source'] = (['bills', 'tally', 'excel'] as const)[i % 3]
    const fee = c.category === 'Company' || c.category === 'LLP' ? 2500 : c.gstFrequency === 'Q' ? 1000 : 1500
    for (let back = 0; back < 3; back++) {
      const period = shiftPeriod(current, -back)
      const isCurrent = back === 0
      const [rawStage, gstr1, gstr3b, note] = isCurrent ? live[i % live.length] : (['json', 'filed', 'filed', ''] as const)
      const stage = rawStage !== 'awaiting' && ORDER.indexOf(rawStage) < ORDER.indexOf(source) ? source : rawStage
      const prevBalance = i % 4 === 1 ? fee : i % 7 === 3 ? fee * 2 : 0
      const received = isCurrent ? (i % 3 === 0 ? fee + prevBalance : i % 3 === 1 ? 0 : fee) : fee + prevBalance
      out.push({
        id: `g-${c.id}-${period}`,
        clientId: c.id,
        period,
        source,
        stage: c.active ? stage : 'awaiting',
        gstr1: c.active ? gstr1 : 'na',
        gstr3b: c.active ? gstr3b : 'na',
        assigneeId: staff[i % staff.length],
        prevBalance: c.active ? prevBalance : 0,
        fee: c.active ? fee : 0,
        received: c.active ? received : 0,
        remark: c.active ? note : 'Work lost — client moved to another consultant',
      })
    }
  })
  return out
}

function tds(cs: Client[], today: string): TdsFiling[] {
  const fy = financialYear(today)
  const patterns: Array<TdsFiling['quarters']> = [
    ['completed', 'to_begin', 'to_begin', 'to_begin'],
    ['completed', 'pending', 'to_begin', 'to_begin'],
    ['filed', 'to_begin', 'to_begin', 'to_begin'],
  ]
  return cs
    .filter((c) => c.scopes.includes('tds'))
    .map((c, i) => ({
      id: `tds-${c.id}`,
      clientId: c.id,
      fy,
      payment: i % 3 === 0 ? 'paid' : 'due',
      quarters: patterns[i % patterns.length],
      assigneeId: i % 4 === 3 ? E.ramees : E.vijeesh,
      remark: i % 3 === 1 ? 'Waiting for salary register' : '',
    }))
}

function it(cs: Client[], today: string): ItFiling[] {
  const fy = financialYear(today)
  const nonAudit: SimpleStatus[] = ['completed', 'completed', 'filed', 'completed', 'pending', 'completed']
  return cs
    .filter((c) => c.scopes.includes('it_non_audit') || c.scopes.includes('it_audit'))
    .map((c, i) => {
      const audit = c.scopes.includes('it_audit')
      const status: SimpleStatus = !c.active
        ? 'to_begin'
        : audit
          ? (['to_begin', 'pending', 'to_begin', 'filed'] as const)[i % 4]
          : nonAudit[i % nonAudit.length]
      const fee = audit ? 7500 : c.category === 'Individual' ? 1500 : 2500
      const done = status === 'completed' || status === 'filed'
      return {
        id: `it-${c.id}`,
        clientId: c.id,
        ay: fy,
        kind: audit ? 'audit' : 'non_audit',
        status,
        dataReceived: status !== 'to_begin',
        assigneeId: E.vijeesh,
        fee,
        received: status === 'completed' ? fee : done ? fee / 2 : 0,
        remark: status === 'pending' ? (audit ? 'Audit report in progress' : 'Form 16 awaited from employer') : '',
      }
    })
}

function audits(cs: Client[], today: string): AuditFiling[] {
  const y = Number(financialYear(today).slice(0, 4))
  const fy = `${y - 1}-${String(y).slice(2)}`
  const out: AuditFiling[] = []
  const states: Array<[SimpleStatus, boolean, string]> = [
    ['completed', true, ''],
    ['pending', true, 'Stock valuation note pending from client'],
    ['filed', true, ''],
    ['pending', false, 'Bank reconciliation for two accounts open'],
    ['completed', true, ''],
  ]
  cs.forEach((c, i) => {
    if (c.scopes.includes('it_audit')) {
      const [status, reconciliation, note] = states[i % states.length]
      out.push({
        id: `au-${c.id}`,
        clientId: c.id,
        fy,
        kind: c.category === 'Company' ? 'Statutory audit' : 'Tax audit',
        status,
        reconciliation,
        dataReceived: true,
        assigneeId: i % 2 === 0 ? E.praveen : E.vijeesh,
        dueDate: `${y}-09-30`,
        remark: note,
      })
    }
    if (c.scopes.includes('internal_audit')) {
      out.push({
        id: `ia-${c.id}`,
        clientId: c.id,
        fy,
        kind: 'Internal audit',
        status: i % 2 === 0 ? 'pending' : 'to_begin',
        reconciliation: false,
        dataReceived: i % 2 === 0,
        assigneeId: E.praveen,
        dueDate: `${y}-10-31`,
        remark: i % 2 === 0 ? 'Q2 vouching under way' : '',
      })
    }
  })
  return out
}

function services(cs: Client[], today: string): ServiceJob[] {
  const d = (n: number) => addDays(today, n)
  const id = (name: string) => cs.find((x) => x.name.startsWith(name))?.id
  const rows: Array<Omit<ServiceJob, 'id'>> = [
    { party: 'FreshBake Foods', clientId: id('FreshBake'), kind: 'GST registration', status: 'pending', committedDate: d(4), assigneeId: E.henna, fee: 3000, received: 1500, remark: 'Officer query replied, awaiting approval' },
    { party: 'Skyline Interiors LLP', clientId: id('Skyline'), kind: 'GST registration', status: 'to_begin', committedDate: d(9), assigneeId: E.henna, fee: 3000, received: 0, remark: 'Waiting for rental agreement' },
    { party: 'Skyline Interiors LLP', clientId: id('Skyline'), kind: 'LLP incorporation', status: 'completed', committedDate: d(-12), assigneeId: E.anna, fee: 12000, received: 12000, remark: '' },
    { party: 'FreshBake Foods', clientId: id('FreshBake'), kind: 'MSME registration', status: 'completed', committedDate: d(-8), assigneeId: E.anna, fee: 1000, received: 1000, remark: '' },
    { party: 'FreshBake Foods', clientId: id('FreshBake'), kind: 'FSSAI', status: 'filed', committedDate: d(12), assigneeId: E.henna, fee: 2500, received: 2500, remark: 'Application filed, inspection awaited' },
    { party: 'Zenith Infotech Pvt Ltd', clientId: id('Zenith'), kind: 'DSC', status: 'pending', committedDate: d(5), assigneeId: E.afna, fee: 2400, received: 2400, remark: 'One director verified' },
    { party: 'Greenleaf Ayurveda LLP', clientId: id('Greenleaf'), kind: 'Trademark', status: 'filed', committedDate: d(-20), assigneeId: E.anna, fee: 8500, received: 8500, remark: 'Under examination' },
    { party: 'Harvest Organic Farms', kind: 'LLP incorporation', status: 'to_begin', committedDate: d(18), assigneeId: E.anna, fee: 12000, received: 0, remark: 'Lead — starts once name options are confirmed' },
    { party: 'Thejas Electricals', clientId: id('Thejas'), kind: 'Legal metrology', details: 'Weighing scale verification and stamping', status: 'pending', committedDate: d(7), assigneeId: E.henna, fee: 2000, received: 0, remark: 'Inspection slot requested' },
    { party: 'Greenleaf Ayurveda LLP', clientId: id('Greenleaf'), kind: 'Certification', details: 'ISO 9001 and GMP certificate renewal', status: 'to_begin', committedDate: d(25), assigneeId: E.anna, fee: 15000, received: 5000, remark: '' },
    { party: 'Aura Dental Clinic', clientId: id('Aura'), kind: 'TAN application', status: 'filed', committedDate: d(3), assigneeId: E.afna, fee: 800, received: 800, remark: 'Acknowledgement received' },
    { party: 'Nisha Boutique', kind: 'PAN application', status: 'to_begin', committedDate: d(6), assigneeId: E.afna, fee: 500, received: 0, remark: 'Lead — needed before GST registration' },
    { party: 'Malabar Spice Traders', clientId: id('Malabar'), kind: 'Partnership formation', status: 'pending', committedDate: d(15), assigneeId: E.anna, fee: 6000, received: 3000, remark: 'Deed draft shared with partners' },
  ]
  return rows.map((r, i) => ({ id: `s-${i + 1}`, ...r }))
}

/** Fee ledger per client, built from the same figures the trackers show. */
function ledger(cs: Client[], data: Pick<SeedData, 'gst' | 'it' | 'services'>, today: string) {
  const period = currentGstPeriod()
  const modes = ['UPI', 'Bank transfer', 'Cash', 'UPI', 'Cheque'] as const
  cs.forEach((c, i) => {
    const out: Client['transactions'] = []
    const add = (daysAgo: number, kind: 'charge' | 'payment', description: string, amount: number) => {
      if (amount <= 0) return
      out.push({
        id: `${c.code}-x${out.length}`,
        date: addDays(today, -daysAgo),
        kind,
        description,
        amount,
        mode: kind === 'payment' ? modes[(i + out.length) % modes.length] : undefined,
      })
    }
    const itRow = data.it.find((r) => r.clientId === c.id)
    if (itRow && (itRow.status === 'filed' || itRow.status === 'completed')) {
      add(62, 'charge', `Income tax return · AY ${itRow.ay}`, itRow.fee)
      add(55, 'payment', 'Received for income tax return', itRow.received)
    }
    const g = data.gst.find((r) => r.clientId === c.id && r.period === period)
    if (g) {
      add(31, 'charge', `GST filing · ${periodLabel(shiftPeriod(period, -1))} (carried forward)`, g.prevBalance)
      add(1, 'charge', `GST filing · ${periodLabel(period)}`, g.fee)
      add(0, 'payment', 'Received for GST filing', g.received)
    }
    for (const s of data.services) {
      if (s.clientId !== c.id || s.status === 'to_begin') continue
      add(20, 'charge', s.kind, s.fee)
      add(14, 'payment', `Received for ${s.kind}`, s.received)
    }
    c.transactions = out.sort((a, b) => b.date.localeCompare(a.date))
  })
}

function consultations(cs: Client[], today: string): Consultation[] {
  const d = (n: number) => addDays(today, n)
  const id = (name: string) => cs.find((x) => x.name.startsWith(name))?.id
  const rows: Array<Omit<Consultation, 'id'>> = [
    { withName: 'Lakeview Resorts Pvt Ltd', clientId: id('Lakeview'), date: d(-1), time: '15:00', durationMin: 45, topic: 'Advance tax estimate for Q3', mode: 'Video', status: 'done', notes: 'Shared working. They will pay by the 15th.' },
    { withName: 'Royal Granites', date: d(0), time: '11:00', durationMin: 60, topic: 'Project report for term loan and audit takeover', mode: 'In person', status: 'scheduled', notes: 'Lead. Bring last two years financials.' },
    { withName: 'Kadalundi Marine Exports Pvt Ltd', clientId: id('Kadalundi'), date: d(0), time: '16:30', durationMin: 30, topic: 'Export refund under GST', mode: 'Phone', status: 'scheduled', notes: '' },
    { withName: 'Zenith Infotech Pvt Ltd', clientId: id('Zenith'), date: d(1), time: '10:30', durationMin: 45, topic: 'ESOP tax treatment for employees', mode: 'Video', status: 'scheduled', notes: '' },
    { withName: 'Bright Future Educational Trust', clientId: id('Bright Future'), date: d(3), time: '14:00', durationMin: 60, topic: '12A / 80G renewal and internal audit scope', mode: 'In person', status: 'scheduled', notes: '' },
    { withName: 'Dr. Anjali Menon', clientId: id('Dr. Anjali'), date: d(6), time: '17:30', durationMin: 30, topic: 'Tax planning before year end', mode: 'Phone', status: 'scheduled', notes: '' },
  ]
  return rows.map((r, i) => ({ id: `k-${i + 1}`, ...r }))
}

/** Last month and this month up to today. Sundays are off; today is left partly unmarked. */
function attendance(emps: Employee[], today: string): Attendance {
  const out: Attendance = {}
  const start = `${shiftPeriod(today.slice(0, 7), -1)}-01`
  emps.forEach((e, ei) => {
    const days: Record<string, AttendanceMark> = {}
    for (let day = start, n = 0; day <= today; day = addDays(day, 1), n++) {
      const [y, m, dd] = day.split('-').map(Number)
      if (new Date(y, m - 1, dd).getDay() === 0) continue
      if (day === today && ei % 4 === 3) continue
      const k = n * 7 + ei * 13
      days[day] = day !== today && k % 23 === 0 ? 'A' : k % 17 === 0 ? 'L' : k % 19 === 0 ? 'H' : 'P'
    }
    out[e.id] = days
  })
  return out
}

export function buildSeed(): SeedData {
  const today = todayISO()
  const cs = clients(today)
  const emps = employees(today)
  const data = { gst: gst(cs), it: it(cs, today), services: services(cs, today) }
  ledger(cs, data, today)
  return {
    employees: emps,
    clients: cs,
    leads: leads(today),
    tasks: tasks(today, cs),
    ...data,
    tds: tds(cs, today),
    audits: audits(cs, today),
    consultations: consultations(cs, today),
    attendance: attendance(emps, today),
  }
}

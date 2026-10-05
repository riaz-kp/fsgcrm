/**
 * What a client has to send for each registration or application, from the firm's
 * "Document & Information Requirements" note. The Requirements page picks from these
 * and turns the ticked ones into a PDF or a WhatsApp message.
 */
import type { ClientCategory, ScopeKey } from '../types'

export interface ReqItem {
  text: string
  /** A condition on the item, shown after it: "not older than 6 months". */
  note?: string
  /** What the item is made up of, such as the lines of an address. */
  parts?: string[]
}

export interface ReqSection {
  title: string
  items: ReqItem[]
}

export interface Checklist {
  id: string
  service: string
  /** The kind of business it is for, where the papers differ by kind. */
  variant?: string
  /** Scopes of work this list is sent for; a client page opens the page with these picked. */
  scopes: ScopeKey[]
  /** Client categories it suits, so the right GST list is picked for a partnership and so on. */
  categories?: ClientCategory[]
  sections: ReqSection[]
  note?: string
}

/** Goes at the top of every list. */
export const GENERAL_NOTE = 'All mobile numbers given for registrations and filings should be Aadhaar-linked mobile numbers, wherever applicable.'

const ADDRESS = ['House/Building number', 'Road/Street', 'Nearby landmark', 'City/Town', 'District', 'State', 'PIN code']

const ID_PROOFS: ReqItem[] = [{ text: 'Aadhaar card' }, { text: 'PAN card' }, { text: 'Aadhaar-linked mobile number' }, { text: 'Email ID' }]

/** What each partner, director or proprietor sends for GST registration. */
const PERSON_FOR_GST: ReqItem[] = [
  { text: 'PAN card' },
  { text: 'Aadhaar card' },
  { text: 'Aadhaar-linked mobile number' },
  { text: 'Passport-size photograph' },
  { text: 'Email ID' },
]

const PREMISES_FOR_GST: ReqItem[] = [
  { text: 'Rent agreement' },
  { text: 'Property tax receipt' },
  { text: 'Nature of business' },
]

const GST_NOTE = 'The exact supporting documents can vary with the constitution of the business and with whether the premises are owned, rented or shared.'

const APPLICANT_FOR_INCORPORATION: ReqItem[] = [
  { text: 'PAN card' },
  { text: 'Aadhaar card' },
  { text: 'Latest bank statement', note: 'not older than 6 months' },
  { text: 'Aadhaar-linked mobile number' },
  { text: 'Email ID' },
]

const REGISTERED_OFFICE: ReqSection = {
  title: 'Registered office documents',
  items: [{ text: 'NOC from the building owner' }, { text: 'Latest electricity bill of the registered office' }],
}

export const CHECKLISTS: Checklist[] = [
  {
    id: 'gst-proprietorship',
    service: 'GST registration',
    variant: 'Proprietorship',
    scopes: ['gst_registration'],
    categories: ['Proprietorship', 'Individual'],
    sections: [
      { title: 'Applicant / proprietor details', items: PERSON_FOR_GST },
      { title: 'Business / address documents', items: [...PREMISES_FOR_GST, { text: 'Complete business address, including', parts: ADDRESS }] },
    ],
    note: GST_NOTE,
  },
  {
    id: 'gst-partnership',
    service: 'GST registration',
    variant: 'Partnership firm',
    scopes: ['gst_registration'],
    categories: ['Partnership'],
    sections: [
      { title: 'Firm documents', items: [{ text: 'PAN of the firm' }, { text: 'Partnership deed' }] },
      { title: 'Details of all partners', items: [...PERSON_FOR_GST, ...PREMISES_FOR_GST, { text: 'Complete address, including', parts: ADDRESS }] },
    ],
    note: GST_NOTE,
  },
  {
    id: 'gst-llp',
    service: 'GST registration',
    variant: 'LLP',
    scopes: ['gst_registration'],
    categories: ['LLP'],
    sections: [
      { title: 'LLP documents', items: [{ text: 'PAN of the LLP' }, { text: 'Certificate of incorporation' }] },
      { title: 'Details of all partners', items: [...PERSON_FOR_GST, ...PREMISES_FOR_GST, { text: 'Complete address, including', parts: ADDRESS }] },
    ],
    note: GST_NOTE,
  },
  {
    id: 'gst-company',
    service: 'GST registration',
    variant: 'Company',
    scopes: ['gst_registration'],
    categories: ['Company'],
    sections: [
      { title: 'Company documents', items: [{ text: 'PAN of the company' }, { text: 'Certificate of incorporation' }] },
      { title: 'Details of relevant directors / partners', items: [...PERSON_FOR_GST, ...PREMISES_FOR_GST, { text: 'Complete address, including', parts: ADDRESS }] },
    ],
    note: GST_NOTE,
  },
  {
    id: 'llp-incorporation',
    service: 'LLP incorporation',
    scopes: ['incorporation'],
    categories: ['LLP'],
    sections: [
      { title: 'Applicant / designated partner documents', items: APPLICANT_FOR_INCORPORATION },
      {
        title: 'LLP / business details',
        items: [
          { text: 'Proposed LLP name' },
          { text: 'Business activity of the proposed LLP' },
          { text: 'Shareholding / contribution pattern' },
          { text: 'Full address of the registered office' },
        ],
      },
      REGISTERED_OFFICE,
    ],
    note: "An LLP has no shares: what is asked for here is the partners' contribution and profit-sharing arrangement.",
  },
  {
    id: 'company-incorporation',
    service: 'Company incorporation',
    scopes: ['incorporation'],
    categories: ['Company'],
    sections: [
      { title: 'Applicant / director documents', items: APPLICANT_FOR_INCORPORATION },
      {
        title: 'Company / business details',
        items: [
          { text: 'Proposed company name' },
          { text: 'Business activity of the proposed company' },
          { text: 'Shareholding pattern' },
          { text: 'Full address of the registered office' },
        ],
      },
      REGISTERED_OFFICE,
    ],
  },
  {
    id: 'tds-property',
    service: 'TDS on transfer of immovable property',
    scopes: [],
    sections: [
      { title: 'Seller', items: ID_PROOFS },
      { title: 'Buyer', items: [...ID_PROOFS, { text: 'Income tax portal password', note: 'if available / required' }] },
      { title: 'Property / transaction details', items: [{ text: 'Agreement / sale deed' }, { text: 'Proportion of ownership' }] },
    ],
  },
  { id: 'it-registration', service: 'Income tax registration', scopes: [], sections: [{ title: 'Documents', items: ID_PROOFS }] },
  { id: 'msme', service: 'MSME / Udyam registration', scopes: [], sections: [{ title: 'Documents', items: ID_PROOFS }] },
  { id: 'tan', service: 'TAN application', scopes: ['tan_application'], sections: [{ title: 'Documents', items: ID_PROOFS }] },
]

export function checklistTitle(c: Checklist): string {
  return c.variant ? `${c.service} · ${c.variant}` : c.service
}

/** The lists that suit a client: those for its scopes of work that fit its category. */
export function checklistsFor(client: { scopes: ScopeKey[]; category: ClientCategory }): Checklist[] {
  return CHECKLISTS.filter((c) => c.scopes.some((s) => client.scopes.includes(s)) && (!c.categories || c.categories.includes(client.category)))
}

/** The quick reference table at the end of the note. */
export const QUICK_REFERENCE: Array<{ service: string; pan: string; aadhaar: string; other: string }> = [
  { service: 'GST · Proprietorship', pan: 'Proprietor', aadhaar: 'Proprietor', other: 'Photo, rent agreement, property tax receipt, business and address details' },
  { service: 'GST · Partnership', pan: 'Firm + partners', aadhaar: 'Partners', other: 'Partnership deed, photos, address and business details' },
  { service: 'GST · LLP', pan: 'LLP + partners', aadhaar: 'Partners', other: 'Incorporation certificate, address and business details' },
  { service: 'GST · Company', pan: 'Company + relevant persons', aadhaar: 'Relevant persons', other: 'Incorporation certificate, address and business details' },
  { service: 'LLP incorporation', pan: 'Yes', aadhaar: 'Yes', other: 'Bank statement, shareholding / contribution pattern, registered office NOC and electricity bill' },
  { service: 'Company incorporation', pan: 'Yes', aadhaar: 'Yes', other: 'Bank statement, shareholding pattern, registered office NOC and electricity bill' },
  { service: 'TDS · property transfer', pan: 'Buyer + seller', aadhaar: 'Buyer + seller', other: 'Sale deed / agreement, ownership proportion, IT password if applicable' },
  { service: 'IT registration', pan: 'Yes', aadhaar: 'Yes', other: '—' },
  { service: 'MSME / Udyam', pan: 'Yes', aadhaar: 'Yes', other: '—' },
  { service: 'TAN application', pan: 'Yes', aadhaar: 'Yes', other: '—' },
]

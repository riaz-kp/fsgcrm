import { MessageCircle, Phone, Repeat } from 'lucide-react'
import type { MouseEvent, ReactNode } from 'react'
import { cn, daysUntil, fmtDate, relDue, telHref, whatsappHref } from '../lib/format'
import { SCOPE_LABEL, SCOPE_SHORT } from '../lib/meta'
import type { Recurrence, ScopeKey } from '../types'
import { Badge } from './ui'

/** A due date that turns amber when close and red when missed. */
export function Due({ date, done, compact }: { date: string; done?: boolean; compact?: boolean }) {
  const n = daysUntil(date)
  const tone = done ? 'text-ink-400' : n < 0 ? 'text-rose-600' : n <= 2 ? 'text-amber-700' : 'text-ink-600'
  return (
    <span className={cn('tnum inline-flex items-baseline gap-1.5 whitespace-nowrap', tone)}>
      <span className="font-semibold">{fmtDate(date)}</span>
      {!compact && !done && <span className="text-xs opacity-80">{relDue(date)}</span>}
    </span>
  )
}

export function ScopeChips({ scopes, max = 3 }: { scopes: ScopeKey[]; max?: number }) {
  const shown = scopes.slice(0, max)
  const rest = scopes.slice(max)
  return (
    <span className="flex flex-wrap gap-1">
      {shown.map((s) => (
        <Badge key={s} tone="neutral">
          <span title={SCOPE_LABEL[s]}>{SCOPE_SHORT[s]}</span>
        </Badge>
      ))}
      {rest.length > 0 && (
        <Badge tone="neutral">
          <span title={rest.map((s) => SCOPE_LABEL[s]).join(', ')}>+{rest.length}</span>
        </Badge>
      )}
    </span>
  )
}

/** One labelled line in a details card. An empty value shows as a dash. */
export function Detail({ icon, label, children }: { icon?: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <dt className="flex w-36 shrink-0 items-center gap-2 text-[13px] text-ink-500">
        {icon}
        {label}
      </dt>
      <dd className="min-w-0 flex-1 font-medium break-words text-ink-800">{children || <span className="font-normal text-ink-400">—</span>}</dd>
    </div>
  )
}

/* ---------- Contact links: tap to call, message or mail ---------- */

const CONTACT = 'inline-flex max-w-full items-center gap-1.5 rounded underline-offset-2 hover:underline'
// Rows and cards these sit in are often clickable themselves.
const stop = (e: MouseEvent) => e.stopPropagation()
const none = <span className="font-normal text-ink-400">—</span>

export function PhoneLink({ phone, icon, className }: { phone?: string; icon?: boolean; className?: string }) {
  if (!phone) return none
  return (
    <a href={telHref(phone)} onClick={stop} title={`Call ${phone}`} className={cn(CONTACT, 'tnum whitespace-nowrap hover:text-brand-700', className)}>
      {icon && <Phone size={13} className="shrink-0 text-ink-400" />}
      {phone}
    </a>
  )
}

/** With `compact`, only the icon shows; the number is in the tooltip. */
export function WhatsAppLink({ number, compact, className }: { number?: string; compact?: boolean; className?: string }) {
  if (!number) return compact ? null : none
  return (
    <a
      href={whatsappHref(number)}
      target="_blank"
      rel="noreferrer"
      onClick={stop}
      title={`WhatsApp ${number}`}
      aria-label={`WhatsApp ${number}`}
      className={cn(CONTACT, 'tnum whitespace-nowrap hover:text-emerald-700', className)}
    >
      <MessageCircle size={compact ? 15 : 13} className="shrink-0 text-emerald-600" />
      {!compact && number}
    </a>
  )
}

export function MailLink({ email, className }: { email?: string; className?: string }) {
  if (!email) return none
  return (
    <a href={`mailto:${email}`} onClick={stop} title={`Email ${email}`} className={cn(CONTACT, 'hover:text-brand-700', className)}>
      <span className="truncate">{email}</span>
    </a>
  )
}

export function RecurringTag({ every }: { every?: Recurrence }) {
  if (!every) return null
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-400 capitalize" title={`Repeats ${every}`}>
      <Repeat size={11} />
      {every}
    </span>
  )
}

export function StatCard({ label, value, sub, icon, tone = 'blue' }: { label: string; value: ReactNode; sub?: ReactNode; icon: ReactNode; tone?: 'blue' | 'amber' | 'green' | 'violet' }) {
  const tones = {
    blue: 'bg-brand-50 text-brand-600',
    amber: 'bg-amber-50 text-amber-600',
    green: 'bg-emerald-50 text-emerald-600',
    violet: 'bg-violet-50 text-violet-600',
  }
  return (
    <div className="rounded-xl bg-white p-4 shadow-card ring-1 ring-ink-200/80">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-semibold text-ink-500">{label}</p>
        <span className={cn('flex size-8 items-center justify-center rounded-lg', tones[tone])}>{icon}</span>
      </div>
      <p className="tnum mt-1 text-[26px] leading-none font-extrabold tracking-tight text-ink-900">{value}</p>
      {sub && <p className="mt-2 text-[13px] text-ink-500">{sub}</p>}
    </div>
  )
}

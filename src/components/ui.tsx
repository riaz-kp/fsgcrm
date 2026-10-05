import { X } from 'lucide-react'
import { useEffect, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ComponentProps, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { cn, initials } from '../lib/format'
import type { Tone } from '../lib/meta'
import type { Employee } from '../types'

/* ---------- Tone palette ---------- */

const TONE_SOFT: Record<Tone, string> = {
  neutral: 'bg-ink-100 text-ink-600',
  blue: 'bg-brand-50 text-brand-700',
  green: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-800',
  red: 'bg-rose-50 text-rose-700',
  violet: 'bg-violet-50 text-violet-700',
  teal: 'bg-teal-50 text-teal-700',
}

const TONE_DOT: Record<Tone, string> = {
  neutral: 'bg-ink-400',
  blue: 'bg-brand-500',
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-rose-500',
  violet: 'bg-violet-500',
  teal: 'bg-teal-500',
}

export const TONE_BAR = TONE_DOT

/* ---------- Button ---------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

const BUTTON: Record<ButtonVariant, string> = {
  primary: 'bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800',
  secondary: 'bg-white text-ink-700 ring-1 ring-inset ring-ink-200 shadow-sm hover:bg-ink-50 active:bg-ink-100',
  ghost: 'text-ink-600 hover:bg-ink-100 active:bg-ink-200',
  danger: 'bg-white text-rose-700 ring-1 ring-inset ring-rose-200 hover:bg-rose-50',
}

interface ButtonLook {
  variant?: ButtonVariant
  size?: 'sm' | 'md'
  icon?: ReactNode
}

const buttonClass = (variant: ButtonVariant, size: 'sm' | 'md', className?: string) =>
  cn(
    'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors disabled:opacity-50',
    size === 'sm' ? 'h-8 px-2.5 text-[13px]' : 'h-9 px-3.5 text-sm',
    BUTTON[variant],
    className,
  )

export function Button({ variant = 'secondary', size = 'md', icon, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & ButtonLook) {
  return (
    <button type="button" className={buttonClass(variant, size, className)} {...rest}>
      {icon}
      {children}
    </button>
  )
}

/** Looks like a Button, but leaves the app: a link to WhatsApp, a file, another site. */
export function LinkButton({ variant = 'secondary', size = 'md', icon, className, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & ButtonLook) {
  return (
    <a className={buttonClass(variant, size, className)} {...rest}>
      {icon}
      {children}
    </a>
  )
}

export function IconButton({ label, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

/* ---------- Badge ---------- */

export function Badge({ tone = 'neutral', dot, className, children }: { tone?: Tone; dot?: boolean; className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap',
        TONE_SOFT[tone],
        className,
      )}
    >
      {dot && <span className={cn('size-1.5 rounded-full', TONE_DOT[tone])} />}
      {children}
    </span>
  )
}

/* ---------- Avatar ---------- */

export function Avatar({ name, hue = 212, size = 28, square, photo }: { name: string; hue?: number; size?: number; square?: boolean; photo?: string }) {
  if (photo)
    return (
      <img
        src={photo}
        alt={name}
        title={name}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className={cn('shrink-0 object-cover', square ? 'rounded-[22%]' : 'rounded-full')}
      />
    )
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center font-bold select-none', square ? 'rounded-[22%]' : 'rounded-full')}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, size * 0.38),
        background: `hsl(${hue} 70% 93%)`,
        color: `hsl(${hue} 55% 32%)`,
      }}
      title={name}
    >
      {initials(name) || name[0]}
    </span>
  )
}

export function Person({ emp, size = 24, muted }: { emp?: Employee; size?: number; muted?: boolean }) {
  if (!emp) return <span className="text-ink-400">Unassigned</span>
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <Avatar name={emp.name} hue={emp.hue} photo={emp.photo} size={size} />
      <span className={cn('truncate', muted ? 'text-ink-500' : 'font-medium text-ink-700')}>{emp.name}</span>
    </span>
  )
}

/* ---------- Card ---------- */

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn('rounded-xl bg-white shadow-card ring-1 ring-ink-200/80', className)}>{children}</section>
}

export function CardHeader({ title, hint, action }: { title: string; hint?: ReactNode; action?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-5 pt-4 pb-3">
      {/* The title keeps a readable width; on a narrow card the action drops below it. */}
      <div className="min-w-40 flex-1">
        <h2 className="text-[15px] font-bold text-ink-900">{title}</h2>
        {hint && <p className="mt-0.5 truncate text-[13px] text-ink-500">{hint}</p>}
      </div>
      {action}
    </header>
  )
}

/* ---------- Progress ---------- */

export function Progress({ value, tone = 'blue', thick, className }: { value: number; tone?: Tone; thick?: boolean; className?: string }) {
  const v = Math.max(0, Math.min(100, value))
  return (
    <div className={cn('overflow-hidden rounded-full bg-ink-100', thick ? 'h-2' : 'h-1.5', className)} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn('h-full rounded-full transition-[width] duration-300', TONE_DOT[tone])} style={{ width: `${v}%` }} />
    </div>
  )
}

/* ---------- Overlays ---------- */

function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
}

export function Modal({ title, subtitle, onClose, children, footer, wide }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEscape(onClose)
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 animate-fade-in bg-ink-900/40" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative flex max-h-[92dvh] w-full animate-pop-in flex-col rounded-t-2xl bg-white shadow-pop sm:rounded-2xl',
          wide ? 'sm:max-w-2xl' : 'sm:max-w-lg',
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-ink-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[13px] text-ink-500">{subtitle}</p>}
          </div>
          <IconButton label="Close" onClick={onClose} className="-mt-1 -mr-2">
            <X size={18} />
          </IconButton>
        </header>
        <div className="scroll-thin overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-ink-100 px-5 py-3">{footer}</footer>}
      </div>
    </div>
  )
}

export function Drawer({ onClose, children, label }: { onClose: () => void; children: ReactNode; label: string }) {
  useEscape(onClose)
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 animate-fade-in bg-ink-900/30" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="relative flex h-full w-full max-w-[520px] animate-slide-in flex-col bg-white shadow-pop"
      >
        {children}
      </aside>
    </div>
  )
}

/* ---------- Form controls ---------- */

const CONTROL =
  'rounded-lg bg-white px-3 text-ink-800 ring-1 ring-inset ring-ink-200 placeholder:text-ink-400 transition-shadow focus:ring-2 focus:ring-brand-500 focus:outline-none'

interface ControlProps {
  /** Compact height for toolbars and inline editing. */
  small?: boolean
  /** Size to content instead of filling the row. */
  fit?: boolean
}

const control = ({ small, fit }: ControlProps) =>
  cn(CONTROL, small ? 'h-8 text-[13px]' : 'h-9 text-sm', fit ? 'w-auto' : 'block w-full')

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 flex items-baseline justify-between text-[13px] font-semibold text-ink-700">
        {label}
        {hint && <span className="font-normal text-ink-400">{hint}</span>}
      </span>
      {children}
    </label>
  )
}

export function Input({ className, small, fit, ...rest }: InputHTMLAttributes<HTMLInputElement> & ControlProps) {
  return <input className={cn(control({ small, fit }), className)} {...rest} />
}

export function Textarea({ className, ...rest }: ComponentProps<'textarea'>) {
  return <textarea className={cn(CONTROL, 'block w-full py-2 text-sm', className)} rows={3} {...rest} />
}

export function Select({ className, children, small, fit, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & ControlProps) {
  return (
    <select className={cn(control({ small, fit }), 'pr-8', className)} {...rest}>
      {children}
    </select>
  )
}

/** A status that is edited in place: looks like a badge, behaves like a select. */
export function StatusSelect<K extends string>({
  value,
  options,
  onChange,
  label,
  disabled,
}: {
  value: K
  options: Array<{ value: K; label: string; tone: Tone }>
  onChange: (v: K) => void
  label: string
  disabled?: boolean
}) {
  const tone = options.find((o) => o.value === value)?.tone ?? 'neutral'
  return (
    <select
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as K)}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'chevron h-7 max-w-full appearance-none rounded-md border-0 py-0 pr-5 pl-1.5 text-xs font-semibold transition-shadow hover:ring-1 hover:ring-ink-300 focus:ring-2 focus:ring-brand-500 focus:outline-none disabled:opacity-60',
        TONE_SOFT[tone],
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

/* ---------- Segmented tabs ---------- */

export function Segmented<K extends string>({
  value,
  onChange,
  items,
}: {
  value: K
  onChange: (v: K) => void
  items: Array<{ value: K; label: ReactNode; count?: number }>
}) {
  return (
    <div className="scroll-none inline-flex max-w-full overflow-x-auto rounded-lg bg-ink-100 p-0.5" role="tablist">
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          role="tab"
          aria-selected={value === it.value}
          onClick={() => onChange(it.value)}
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] font-semibold whitespace-nowrap transition-colors',
            value === it.value ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-800',
          )}
        >
          {it.label}
          {it.count !== undefined && (
            <span className={cn('tnum rounded px-1 text-[11px]', value === it.value ? 'bg-ink-100 text-ink-600' : 'text-ink-400')}>
              {it.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

/* ---------- Misc ---------- */

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[22px] leading-tight font-extrabold tracking-tight text-ink-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Empty({ icon, title, hint, action }: { icon?: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {icon && <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-ink-100 text-ink-400">{icon}</div>}
      <p className="font-semibold text-ink-700">{title}</p>
      {hint && <p className="mt-1 max-w-xs text-[13px] text-ink-500">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

const ALIGN = { left: 'text-left', center: 'text-center', right: 'text-right' }

export function Th({ children, align = 'left', className }: { children?: ReactNode; align?: keyof typeof ALIGN; className?: string }) {
  return (
    <th className={cn('px-3 py-2.5 text-[11px] font-bold tracking-wider whitespace-nowrap text-ink-500 uppercase first:pl-5 last:pr-5', ALIGN[align], className)}>
      {children}
    </th>
  )
}

/** `label` is the column's name, shown above the value when a `stack` table collapses into cards. */
export function Td({ children, className, label }: { children?: ReactNode; className?: string; label?: string }) {
  return (
    <td data-label={label} className={cn('px-3 py-2.5 align-middle first:pl-5 last:pr-5', className)}>
      {children}
    </td>
  )
}

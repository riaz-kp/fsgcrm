import { Camera } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { ageFrom, cn, todayISO } from '../lib/format'
import { BLOOD_GROUPS, ROLES, options } from '../lib/meta'
import { LIVE } from '../lib/supabase'
import { isHead, managesLogins, useCurrentUser, useStore } from '../store'
import type { BloodGroup, Employee, FamilyDetails, Role } from '../types'
import { Avatar, Button, Field, Input, Modal, Select, Textarea } from './ui'

/** Crop to a centred square and shrink, so a phone photo fits in browser storage. */
function resizePhoto(file: File, size = 240): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const side = Math.min(img.width, img.height)
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = size
      canvas.getContext('2d')?.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read that image'))
    }
    img.src = url
  })
}

const TOP_ROLES: Role[] = ['admin', 'ceo']

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5 first:mt-0">
      <h3 className="mb-2.5 border-b border-ink-100 pb-1.5 text-[11px] font-bold tracking-wider text-ink-400 uppercase">{title}</h3>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  )
}

export default function EmployeeForm({ employee, onClose }: { employee?: Employee; onClose: () => void }) {
  const addEmployee = useStore((s) => s.addEmployee)
  const updateEmployee = useStore((s) => s.updateEmployee)
  const employees = useStore((s) => s.employees)
  const me = useCurrentUser()
  // Only the admin or the CEO makes someone admin or CEO, or changes the role of someone who is.
  const mayGiveTopRoles = managesLogins(me)
  const topRoleLocked = !mayGiveTopRoles && !!employee && TOP_ROLES.includes(employee.role)
  const file = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const [f, setF] = useState({
    name: employee?.name ?? '',
    title: employee?.title ?? 'Trainee',
    role: employee?.role ?? ('trainee' as Role),
    reportsTo: employee ? (employee.reportsTo ?? '') : (employees.find((e) => e.role === 'head')?.id ?? ''),
    responsibilities: employee?.responsibilities.join(', ') ?? '',
    phone: employee?.phone ?? '',
    email: employee?.email ?? '',
    joined: employee?.joined ?? todayISO(),
    dob: employee?.dob ?? '',
    address: employee?.address ?? '',
    bloodGroup: employee?.bloodGroup ?? ('' as BloodGroup | ''),
    qualification: employee?.qualification ?? '',
    photo: employee?.photo ?? '',
    fatherName: employee?.family?.fatherName ?? '',
    fatherOccupation: employee?.family?.fatherOccupation ?? '',
    fatherPhone: employee?.family?.fatherPhone ?? '',
    motherName: employee?.family?.motherName ?? '',
    motherOccupation: employee?.family?.motherOccupation ?? '',
    siblings: employee?.family?.siblings ?? '',
  })
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }))

  const pick = async (files: FileList | null) => {
    const picked = files?.[0]
    if (!picked) return
    try {
      set('photo', await resizePhoto(picked))
      setError('')
    } catch {
      setError('That file could not be read as an image. Try a JPG or PNG.')
    }
  }

  const save = () => {
    if (!f.name.trim()) return
    // Keep only the family details that were filled in.
    const family: FamilyDetails = {}
    for (const k of ['fatherName', 'fatherOccupation', 'fatherPhone', 'motherName', 'motherOccupation', 'siblings'] as const) {
      if (f[k].trim()) family[k] = f[k].trim()
    }
    const data = {
      name: f.name.trim(),
      title: f.title.trim() || ROLES[f.role].label,
      role: f.role,
      reportsTo: f.reportsTo || undefined,
      responsibilities: f.responsibilities
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      phone: f.phone.trim(),
      email: f.email.trim(),
      joined: f.joined || undefined,
      dob: f.dob || undefined,
      address: f.address.trim() || undefined,
      bloodGroup: f.bloodGroup || undefined,
      qualification: f.qualification.trim() || undefined,
      family: Object.keys(family).length ? family : undefined,
      photo: f.photo || undefined,
    }
    if (employee) updateEmployee(employee.id, data)
    else addEmployee(data)
    onClose()
  }

  return (
    <Modal
      wide
      title={employee ? `Edit ${employee.name}` : 'Add team member'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} disabled={!f.name.trim()}>
            {employee ? 'Save changes' : 'Add member'}
          </Button>
        </>
      }
    >
      <div className="mb-4 flex items-center gap-4">
        <Avatar name={f.name || '?'} hue={employee?.hue} photo={f.photo || undefined} size={64} />
        <div>
          <div className="flex gap-2">
            <Button size="sm" icon={<Camera size={14} />} onClick={() => file.current?.click()}>
              {f.photo ? 'Change photo' : 'Add photo'}
            </Button>
            {f.photo && (
              <Button size="sm" variant="ghost" onClick={() => set('photo', '')}>
                Remove
              </Button>
            )}
          </div>
          <input ref={file} type="file" accept="image/*" hidden onChange={(e) => void pick(e.target.files)} />
          <p className={cn('mt-1.5 text-xs', error ? 'text-rose-600' : 'text-ink-500')}>{error || 'Cropped to a square and shrunk before saving.'}</p>
        </div>
      </div>

      <Section title="At the firm">
        <Field label="Name">
          <Input value={f.name} onChange={(e) => set('name', e.target.value)} autoFocus={!employee} />
        </Field>
        <Field label="Designation">
          <Input value={f.title} onChange={(e) => set('title', e.target.value)} />
        </Field>
        <Field label="Role" hint={topRoleLocked ? 'Only the admin or the CEO can change this' : undefined}>
          <Select value={f.role} onChange={(e) => set('role', e.target.value as Role)} disabled={topRoleLocked}>
            {options(ROLES)
              .filter((r) => mayGiveTopRoles || !TOP_ROLES.includes(r.value) || r.value === employee?.role)
              .map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Reports to">
          <Select value={f.reportsTo} onChange={(e) => set('reportsTo', e.target.value)}>
            <option value="">No one</option>
            {employees
              .filter((e) => isHead(e) && e.id !== employee?.id)
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Usually works on" hint="comma separated" className="sm:col-span-2">
          <Input value={f.responsibilities} onChange={(e) => set('responsibilities', e.target.value)} placeholder="GST filing, book keeping" />
        </Field>
      </Section>

      <Section title="Personal details">
        <Field label="Date of birth" hint={f.dob ? `${ageFrom(f.dob)} years old` : 'age is worked out'}>
          <Input type="date" value={f.dob} max={todayISO()} onChange={(e) => set('dob', e.target.value)} />
        </Field>
        <Field label="Date of joining">
          <Input type="date" value={f.joined} max={todayISO()} onChange={(e) => set('joined', e.target.value)} />
        </Field>
        <Field label="Mobile number">
          <Input value={f.phone} onChange={(e) => set('phone', e.target.value)} inputMode="tel" />
        </Field>
        <Field label="Mail ID" hint={LIVE ? 'They sign up and sign in with this email' : undefined}>
          <Input value={f.email} onChange={(e) => set('email', e.target.value)} type="email" />
        </Field>
        <Field label="Blood group">
          <Select value={f.bloodGroup} onChange={(e) => set('bloodGroup', e.target.value as BloodGroup | '')}>
            <option value="">Not added</option>
            {BLOOD_GROUPS.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </Select>
        </Field>
        <Field label="Qualification">
          <Input value={f.qualification} onChange={(e) => set('qualification', e.target.value)} placeholder="e.g. B.Com, CA Inter" />
        </Field>
        <Field label="Address" className="sm:col-span-2">
          <Textarea value={f.address} onChange={(e) => set('address', e.target.value)} rows={2} />
        </Field>
      </Section>

      <Section title="Family details">
        <Field label="Name of father">
          <Input value={f.fatherName} onChange={(e) => set('fatherName', e.target.value)} />
        </Field>
        <Field label="Occupation of father">
          <Input value={f.fatherOccupation} onChange={(e) => set('fatherOccupation', e.target.value)} />
        </Field>
        <Field label="Name of mother">
          <Input value={f.motherName} onChange={(e) => set('motherName', e.target.value)} />
        </Field>
        <Field label="Occupation of mother">
          <Input value={f.motherOccupation} onChange={(e) => set('motherOccupation', e.target.value)} />
        </Field>
        <Field label="Mobile number of father">
          <Input value={f.fatherPhone} onChange={(e) => set('fatherPhone', e.target.value)} inputMode="tel" />
        </Field>
        <Field label="Siblings">
          <Input value={f.siblings} onChange={(e) => set('siblings', e.target.value)} placeholder="e.g. one elder brother, one younger sister" />
        </Field>
      </Section>
    </Modal>
  )
}

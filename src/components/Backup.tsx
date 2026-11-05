import { AlertTriangle, DatabaseBackup, FileJson, FileSpreadsheet, RotateCcw, Upload } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { applyRestore, backupFile, backupName, planRestore, readBackup, takeBackup, type Backup } from '../lib/backup'
import { auditSheet, clientSheet, downloadSheets, gstSheet, itSheet, leadSheet, loginSheet, serviceSheet, taskSheet, tdsSheet, useExportContext } from '../lib/exports'
import { fmtDate } from '../lib/format'
import { LIVE } from '../lib/supabase'
import { useStoredState } from '../lib/useStoredState'
import { saveFile } from '../lib/xlsx'
import { managesLogins, useCurrentUser, useStore } from '../store'
import { Badge, Button, Card, CardHeader, Input, Modal, Switch } from './ui'

const CONFIRM_WORD = 'RESTORE'

function RestoreDialog({ backup, onClose }: { backup: Backup; onClose: () => void }) {
  const [removeOthers, setRemoveOthers] = useState(false)
  const [typed, setTyped] = useState('')
  const [done, setDone] = useState(false)
  const plan = useMemo(() => planRestore(backup, removeOthers), [backup, removeOthers])
  const rows = plan.counts.filter((c) => c.added || c.changed || (removeOthers && c.extra))
  const extra = plan.counts.reduce((n, c) => n + c.extra, 0)

  if (done)
    return (
      <Modal title="Backup restored" onClose={onClose} footer={<Button variant="primary" onClick={onClose}>Done</Button>}>
        <p className="text-sm text-ink-700">
          Everything in the backup of {fmtDate(backup.takenAt.slice(0, 10), true)} is back as it was{LIVE && '. The changes are being saved, and show in Change history under your name'}.
        </p>
      </Modal>
    )

  return (
    <Modal
      wide
      title="Restore from backup"
      subtitle={`Taken ${fmtDate(backup.takenAt.slice(0, 10), true)} at ${new Date(backup.takenAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })} by ${backup.by}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            icon={<RotateCcw size={15} />}
            disabled={typed.trim().toUpperCase() !== CONFIRM_WORD || rows.length === 0}
            onClick={() => {
              applyRestore(plan)
              setDone(true)
            }}
          >
            Restore
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        {rows.length === 0 ? (
          <p className="rounded-lg bg-emerald-50 px-3 py-2.5 font-semibold text-emerald-800">The app already matches this backup. There is nothing to restore.</p>
        ) : (
          <div className="overflow-hidden rounded-lg ring-1 ring-ink-200">
            <table className="w-full text-[13px]">
              <thead className="bg-ink-50 text-left text-xs font-bold text-ink-500">
                <tr>
                  <th className="px-3 py-2">What</th>
                  <th className="px-3 py-2 text-right">Put back</th>
                  <th className="px-3 py-2 text-right">Changed back</th>
                  <th className="px-3 py-2 text-right">{removeOthers ? 'Removed' : 'Made since, kept'}</th>
                </tr>
              </thead>
              <tbody className="tnum divide-y divide-ink-100">
                {plan.counts.map((c) => (
                  <tr key={c.label} className={c.added || c.changed || c.extra ? '' : 'text-ink-400'}>
                    <td className="px-3 py-1.5 font-semibold">{c.label}</td>
                    <td className="px-3 py-1.5 text-right">{c.added || '—'}</td>
                    <td className="px-3 py-1.5 text-right">{c.changed || '—'}</td>
                    <td className={removeOthers && c.extra ? 'px-3 py-1.5 text-right font-bold text-rose-700' : 'px-3 py-1.5 text-right'}>{c.extra || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <label className="flex items-start gap-3">
          <Switch checked={removeOthers} onChange={setRemoveOthers} label="Also remove what was added after the backup" />
          <span>
            <span className="block font-semibold text-ink-800">Also remove what was added after the backup</span>
            <span className="block text-[13px] text-ink-500">
              {extra ? `${extra} records made since then would be deleted.` : 'Nothing has been added since the backup.'} Leave this off to keep them.
            </span>
          </span>
        </label>

        <ul className="list-disc space-y-1 pl-5 text-[13px] text-ink-600">
          <li>Team members, their logins and permissions are not changed.</li>
          {!backup.passwords && <li>This backup has no passwords in it, so portal logins and DSCs stay as they are now.</li>}
          <li>Uploaded files are not in a backup. Documents and recordings point to the files where they are kept.</li>
        </ul>

        {rows.length > 0 && (
          <div className="rounded-lg bg-amber-50 p-3 ring-1 ring-amber-200">
            <p className="flex items-center gap-2 font-semibold text-amber-900">
              <AlertTriangle size={15} /> Changes made since the backup to these records will be lost{LIVE && ' for everyone'}.
            </p>
            <label className="mt-2 block text-[13px] text-amber-900">
              Type <strong>{CONFIRM_WORD}</strong> to go ahead
              <Input value={typed} onChange={(e) => setTyped(e.target.value)} className="mt-1" autoComplete="off" aria-label={`Type ${CONFIRM_WORD} to go ahead`} />
            </label>
          </div>
        )}
      </div>
    </Modal>
  )
}

export default function BackupSettings() {
  const me = useCurrentUser()
  const x = useExportContext()
  const count = useStore((s) => s.clients.length + s.tasks.length + s.leads.length + s.gst.length + s.tds.length + s.it.length + s.audits.length + s.services.length)
  const [last, setLast] = useStoredState<string>('fsg-last-backup', '')
  const [backup, setBackup] = useState<Backup>()
  const [error, setError] = useState('')
  const file = useRef<HTMLInputElement>(null)
  const restores = managesLogins(me)

  const download = () => {
    saveFile(backupFile(takeBackup(me.name, x.logins)), backupName())
    setLast(new Date().toISOString())
  }

  const excel = () => {
    const s = useStore.getState()
    // TDS has a column per month, so each financial year gets its own sheet.
    const years = [...new Set(s.tds.map((t) => t.fy))].sort().reverse()
    downloadSheets('FSG all data', [
      clientSheet(x, s.clients),
      ...(x.logins ? [loginSheet(x, s.clients)] : []),
      gstSheet(x, [...s.gst].sort((a, b) => b.period.localeCompare(a.period))),
      ...years.map((fy) => tdsSheet(x, s.tds.filter((t) => t.fy === fy), fy)),
      itSheet(x, [...s.it].sort((a, b) => b.ay.localeCompare(a.ay))),
      auditSheet(x, s.audits),
      serviceSheet(x, s.services),
      taskSheet(x, s.tasks),
      leadSheet(x, s.leads),
    ])
  }

  const pick = async (f?: File) => {
    setError('')
    if (!f) return
    try {
      setBackup(await readBackup(f))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      if (file.current) file.current.value = ''
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Download a backup" hint="A copy to keep off this system, on a pen drive or in Drive" />
        <div className="space-y-4 px-5 pb-5 text-sm">
          <p className="text-ink-600">
            One file with everything in the app: {count} clients, tasks, leads and filing rows, plus consultations, attendance, holidays, reminders, scopes and message wording.{' '}
            {x.logins ? 'Portal and DSC passwords are in it, so keep it somewhere safe.' : 'Portal and DSC passwords are left out, as you cannot see them.'}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" icon={<FileJson size={16} />} onClick={download}>
              Download backup
            </Button>
            <Button icon={<FileSpreadsheet size={16} />} onClick={excel}>
              Everything in Excel
            </Button>
          </div>
          <p className="text-[13px] text-ink-500">
            {last ? (
              <>
                Last downloaded on this device <Badge tone="green">{fmtDate(last.slice(0, 10), true)}</Badge>
              </>
            ) : (
              'No backup has been downloaded on this device yet.'
            )}{' '}
            The backup file can be restored here; the Excel copy is for reading and sharing, one sheet per list.
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Restore from a backup" hint="Put the data back as it was in a backup" />
        <div className="space-y-3 px-5 pb-5 text-sm">
          {restores ? (
            <>
              <p className="text-ink-600">Pick a backup file. You will see what it changes before anything happens.</p>
              <input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
              <Button icon={<Upload size={16} />} onClick={() => file.current?.click()}>
                Choose backup file
              </Button>
              {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-[13px] font-semibold text-rose-700">{error}</p>}
            </>
          ) : (
            <p className="flex items-start gap-2 text-ink-500">
              <DatabaseBackup size={16} className="mt-0.5 shrink-0" />
              Restoring is for those who give out logins, as it changes data for everyone.
            </p>
          )}
        </div>
      </Card>

      {backup && <RestoreDialog backup={backup} onClose={() => setBackup(undefined)} />}
    </div>
  )
}

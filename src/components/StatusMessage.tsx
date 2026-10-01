import { Check, Copy, MessageCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { cn, whatsappHref } from '../lib/format'
import { statusLines, statusMessage } from '../lib/statusMessage'
import { useCurrentUser, useStore } from '../store'
import type { Client } from '../types'
import { Button, Field, LinkButton, Modal, Textarea } from './ui'

/**
 * Drafts a work-status message for a client and hands it to WhatsApp.
 * Nothing is sent from here: the staff member reads it, opens WhatsApp and presses send there.
 */
export default function StatusMessage({ client, onClose }: { client: Client; onClose: () => void }) {
  const me = useCurrentUser()
  const gst = useStore((s) => s.gst)
  const tds = useStore((s) => s.tds)
  const it = useStore((s) => s.it)
  const audits = useStore((s) => s.audits)
  const services = useStore((s) => s.services)
  const lines = useMemo(() => statusLines(client, { gst, tds, it, audits, services }), [client, gst, tds, it, audits, services])
  const draft = (keys: Set<string>) => statusMessage(client, lines.filter((l) => keys.has(l.key)), me.name)

  const [ticked, setTicked] = useState(() => new Set(lines.filter((l) => l.on).map((l) => l.key)))
  const [text, setText] = useState(() => draft(ticked))
  const [copied, setCopied] = useState(false)
  const number = client.whatsapp || client.phone

  const toggle = (key: string) => {
    const next = new Set(ticked)
    if (!next.delete(key)) next.add(key)
    setTicked(next)
    setText(draft(next))
  }
  const copy = () => {
    void navigator.clipboard?.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Modal
      wide
      title="Work status on WhatsApp"
      subtitle={number ? `To ${client.name} · ${number}` : `To ${client.name}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button icon={copied ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />} onClick={copy} disabled={!text.trim()}>
            {copied ? 'Copied' : 'Copy message'}
          </Button>
          {number && text.trim() ? (
            <LinkButton
              variant="primary"
              icon={<MessageCircle size={15} />}
              href={`${whatsappHref(number)}?text=${encodeURIComponent(text)}`}
              target="_blank"
              rel="noreferrer"
            >
              Open in WhatsApp
            </LinkButton>
          ) : (
            <Button variant="primary" icon={<MessageCircle size={15} />} disabled>
              Open in WhatsApp
            </Button>
          )}
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-5">
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-[13px] font-semibold text-ink-700">Include</p>
          {lines.length === 0 ? (
            <p className="text-[13px] text-ink-500">Nothing is being tracked for this client yet, so write the message yourself.</p>
          ) : (
            <ul className="space-y-1">
              {lines.map((l) => {
                const on = ticked.has(l.key)
                return (
                  <li key={l.key}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      onClick={() => toggle(l.key)}
                      className={cn(
                        'flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] ring-1 transition-colors ring-inset',
                        on ? 'bg-brand-50 text-brand-900 ring-brand-200' : 'bg-white text-ink-600 ring-ink-200 hover:bg-ink-50',
                      )}
                    >
                      <span className={cn('mt-0.5 flex size-4 shrink-0 items-center justify-center rounded', on ? 'bg-brand-600 text-white' : 'ring-1 ring-ink-300 ring-inset')}>
                        {on && <Check size={12} strokeWidth={3.5} />}
                      </span>
                      <span className="min-w-0">{l.text}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          <p className="mt-2 text-xs text-ink-500">Changing a tick rewrites the message, so tick first and reword after.</p>
        </div>

        <div className="sm:col-span-3">
          <Field label="Message" hint="read it before it goes">
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={15} className="leading-relaxed" />
          </Field>
          <p className={cn('mt-2 text-xs', number ? 'text-ink-500' : 'font-semibold text-amber-700')}>
            {!number
              ? 'No WhatsApp or phone number is saved for this client. Add one with Edit, or copy the message.'
              : client.whatsapp
                ? 'Opens a chat with the message typed in. It is sent only when you press send in WhatsApp.'
                : 'No WhatsApp number is saved, so this uses the phone number. It is sent only when you press send in WhatsApp.'}
          </p>
        </div>
      </div>
    </Modal>
  )
}

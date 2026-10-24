import { LogIn } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Button, Field, Input } from '../components/ui'
import { signInEmail } from '../lib/logins'
import { supabase } from '../lib/supabase'

/** The plain page the sign-in screen and the loading and error messages sit on. */
export function Screen({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-ink-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <img src="/logo.jpeg" alt="Fin Savvy Consultors" className="mx-auto mb-6 h-14 w-auto" />
        <div className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-ink-200">
          <h1 className="text-lg font-bold text-ink-900">{title}</h1>
          {subtitle && <div className="mt-1 text-[13px] text-ink-500">{subtitle}</div>}
          {children && <div className="mt-5">{children}</div>}
        </div>
        <p className="mt-4 text-center text-xs text-ink-400">FSG Practice Manager</p>
      </div>
    </div>
  )
}

/** Supabase's messages, in words the team will follow. */
function explain(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'That username and password do not match.'
  if (/rate limit|too many/i.test(message)) return 'Too many attempts. Wait a few minutes and try again.'
  if (/fetch|network/i.test(message)) return 'Could not reach the server. Check the internet connection.'
  return message
}

/** Logins are given out by the admin or the CEO, so there is no sign-up here, and a forgotten password is reset by them. */
export default function SignIn() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!supabase || busy) return
    setError('')
    setBusy(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: signInEmail(username), password })
      if (error) setError(explain(error.message))
    } catch (err) {
      setError(explain(err instanceof Error ? err.message : String(err)))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen title="Sign in">
      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        <Field label="Username">
          <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoFocus required />
        </Field>
        <Field label="Password">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </Field>
        {error && (
          <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-[13px] text-rose-700 ring-1 ring-rose-200">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" disabled={busy} className="w-full" icon={<LogIn size={16} />}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </Screen>
  )
}

import type { Session } from '@supabase/supabase-js'
import { LogOut, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AccountContext, type Account } from '../lib/account'
import { LOGIN_DOMAIN } from '../lib/logins'
import { MODE, supabase } from '../lib/supabase'
import { startSync, stopSync, useSyncStatus } from '../lib/sync'
import SignIn, { Screen } from '../pages/SignIn'
import { Button } from './ui'

type Phase =
  | { at: 'checking' }
  | { at: 'signed-out' }
  | { at: 'loading'; session: Session }
  | { at: 'not-staff'; session: Session }
  | { at: 'failed'; session: Session; message: string }
  | { at: 'ready'; session: Session }
  | { at: 'leaving' }

function Waiting({ text }: { text: string }) {
  return (
    <Screen title={text}>
      <div className="h-1.5 overflow-hidden rounded-full bg-ink-100">
        <div className="h-full w-1/3 animate-loading rounded-full bg-brand-500" />
      </div>
    </Screen>
  )
}

/**
 * Nothing of the firm's shows until someone on the team has signed in and their data has loaded. On sample
 * data the app opens straight away; a production build with no database settings says so instead.
 */
export default function AuthGate({ children }: { children: ReactNode }) {
  if (MODE === 'demo') return children
  if (MODE === 'unconfigured')
    return (
      <Screen
        title="Not connected yet"
        subtitle="This copy of Practice Manager has no database settings. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY for the deployment and build it again."
      />
    )
  return <LiveGate>{children}</LiveGate>
}

function LiveGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>({ at: 'checking' })
  // Whose data is loaded (or loading), so a repeated sign-in event for the same person does not load it twice.
  const loadedFor = useRef<string | undefined>(undefined)

  const load = useCallback(async (session: Session) => {
    const db = supabase!
    setPhase({ at: 'loading', session })
    try {
      const { data, error } = await db.from('employees').select('id').eq('user_id', session.user.id).maybeSingle()
      if (error) throw new Error(error.message)
      if (!data) {
        setPhase({ at: 'not-staff', session })
        return
      }
      await startSync(data.id as string)
      setPhase({ at: 'ready', session })
    } catch (e) {
      loadedFor.current = undefined
      setPhase({ at: 'failed', session, message: e instanceof Error ? e.message : String(e) })
    }
  }, [])

  useEffect(() => {
    const db = supabase!
    const {
      data: { subscription },
    } = db.auth.onAuthStateChange((event, session) => {
      // Supabase asks that no other auth calls run inside this callback, so the work is done just after it.
      setTimeout(() => {
        if (!session || event === 'SIGNED_OUT') {
          loadedFor.current = undefined
          void stopSync().then(() => setPhase({ at: 'signed-out' }))
          return
        }
        if (loadedFor.current === session.user.id) return
        loadedFor.current = session.user.id
        void load(session)
      }, 0)
    })
    return () => subscription.unsubscribe()
  }, [load])

  const signOut = useCallback(async () => {
    if (useSyncStatus.getState().saving && !window.confirm('Some changes are still being saved. Sign out anyway? Anything not saved yet will be lost.')) return
    setPhase({ at: 'leaving' })
    await stopSync()
    await supabase!.auth.signOut()
  }, [])

  const session = 'session' in phase ? phase.session : null
  // A username is kept as <username>@fsg.local; show just the username.
  const email = session?.user.email ?? ''
  const login = email.endsWith(`@${LOGIN_DOMAIN}`) ? email.slice(0, -LOGIN_DOMAIN.length - 1) : email
  const account = useMemo<Account | null>(() => (session ? { login, signOut: () => void signOut() } : null), [session, login, signOut])

  switch (phase.at) {
    case 'checking':
      return <Waiting text="Opening Practice Manager…" />
    case 'leaving':
      return <Waiting text="Signing out…" />
    case 'loading':
      return <Waiting text="Loading the firm's work…" />
    case 'signed-out':
      return <SignIn />
    case 'not-staff':
      return (
        <Screen title="This login is not active" subtitle={`${login} is not linked to an active team member. Ask the admin or the CEO.`}>
          <Button onClick={() => void signOut()} icon={<LogOut size={16} />} className="w-full">
            Sign out
          </Button>
        </Screen>
      )
    case 'failed':
      return (
        <Screen title="Could not load the firm's work" subtitle={phase.message}>
          <div className="flex gap-2">
            <Button
              variant="primary"
              icon={<RotateCcw size={16} />}
              className="flex-1"
              onClick={() => {
                loadedFor.current = phase.session.user.id
                void load(phase.session)
              }}
            >
              Try again
            </Button>
            <Button onClick={() => void signOut()} icon={<LogOut size={16} />}>
              Sign out
            </Button>
          </div>
        </Screen>
      )
    case 'ready':
      return <AccountContext.Provider value={account}>{children}</AccountContext.Provider>
  }
}

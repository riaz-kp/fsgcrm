/**
 * push: sends notifications to team members' phones and computers.
 *
 * Two callers:
 *  - The database (private.send_push, through pg_net), with the shared secret in `x-push-secret`:
 *      POST { to: [employee ids], title, body, url, tag }
 *  - A signed-in team member trying it out on the device they are on, with their access token:
 *      POST { action: 'test', endpoint }
 *
 * Deployed with "Verify JWT" off, since the database has no sign-in; each caller is checked here instead.
 * The VAPID keys and the secret are read from Supabase Vault through push_server_config(), which only the service
 * key may call. A device the push service says is gone (it was uninstalled or turned off) is forgotten.
 */
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2.117.3'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
const refuse = (status: number, error: string) => reply(status, { error })

/** Compares secrets without giving away how much of a wrong one matched. */
function sameSecret(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a)
  const y = new TextEncoder().encode(b)
  let diff = x.length ^ y.length
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return diff === 0
}

interface Message {
  title: string
  body: string
  url: string
  tag?: string
}

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return refuse(405, 'Use POST.')

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const { data: config, error: configError } = await admin.rpc('push_server_config')
  if (configError) return refuse(500, configError.message)
  const keys = config as { public: string | null; private: string | null; secret: string | null }
  if (!keys.public || !keys.private || !keys.secret) return refuse(503, 'Notifications are not set up yet (VAPID keys missing in Vault).')

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return refuse(400, 'The request was not understood.')
  }

  let to: string[]
  let only: string | null = null
  let message: Message

  const hookSecret = req.headers.get('x-push-secret')
  if (hookSecret !== null) {
    if (!sameSecret(hookSecret, keys.secret)) return refuse(401, 'Wrong secret.')
    to = Array.isArray(body.to) ? body.to.filter((x): x is string => typeof x === 'string').slice(0, 100) : []
    message = { title: text(body.title, 120) || 'Practice Manager', body: text(body.body, 400), url: text(body.url, 300) || '/', tag: text(body.tag, 100) || undefined }
  } else {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (!token || token === anonKey) return refuse(401, 'Sign in first.')
    const caller = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } })
    const { data: who, error: whoError } = await caller.auth.getUser(token)
    if (whoError || !who.user) return refuse(401, 'Your sign-in has expired. Sign in again.')
    const { data: me } = await caller.rpc('current_employee_id')
    if (typeof me !== 'string') return refuse(403, 'Only active team members get notifications.')
    if (body.action !== 'test' || typeof body.endpoint !== 'string') return refuse(400, 'The request was not understood.')
    to = [me]
    only = body.endpoint
    message = { title: 'Notifications are on', body: 'This is how Practice Manager will let you know about your work on this device.', url: '/', tag: 'test' }
  }
  if (to.length === 0) return reply(200, { sent: 0, failed: 0, removed: 0 })

  let query = admin.from('push_subscriptions').select('endpoint, p256dh, auth').in('employee_id', to)
  if (only) query = query.eq('endpoint', only)
  const { data: devices, error: devicesError } = await query
  if (devicesError) return refuse(500, devicesError.message)
  if (only && devices.length === 0) return refuse(404, 'This device is not turned on for notifications. Turn them off and on again.')

  // The contact the push services see is the project's address, so no one's email goes to Google, Apple or Microsoft.
  webpush.setVapidDetails(url, keys.public, keys.private)
  const payload = JSON.stringify(message)
  const results = await Promise.allSettled(
    devices.map((d) =>
      webpush.sendNotification({ endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } }, payload, { TTL: 12 * 60 * 60, urgency: 'normal' }),
    ),
  )

  const gone: string[] = []
  const errors: string[] = []
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') return
    const status = (r.reason as { statusCode?: number })?.statusCode
    if (status === 404 || status === 410) gone.push(devices[i].endpoint)
    else errors.push(`${status ?? ''} ${(r.reason as Error)?.message ?? r.reason}`.trim())
  })
  if (gone.length) await admin.from('push_subscriptions').delete().in('endpoint', gone)
  if (errors.length) console.error('push failures', errors)

  const sent = results.length - gone.length - errors.length
  if (only && sent === 0) return refuse(502, gone.length ? 'This device no longer accepts notifications. Turn them off and on again.' : `The push service refused: ${errors[0]}`)
  return reply(200, { sent, failed: errors.length, removed: gone.length })
})

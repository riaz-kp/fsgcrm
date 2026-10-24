/**
 * staff-logins: people allowed to give out logins (the admin and the CEO to start with) give team members
 * a username and password, reset passwords, change usernames and take logins away. Making sign-ins needs
 * the service key, which never reaches the browser, so it happens here.
 *
 * POST { action: 'create', employee_id, username, password }
 *      { action: 'reset_password', employee_id, password }
 *      { action: 'rename', employee_id, username }
 *      { action: 'remove', employee_id }
 * with the signed-in person's access token as the bearer token.
 */
import { createClient } from 'npm:@supabase/supabase-js@2.117.3'

/** Supabase Auth signs in by email, so a username is kept as an address no mail is ever sent to. */
const DOMAIN = 'fsg.local'
const USERNAME = /^[a-z0-9][a-z0-9._-]{2,31}$/

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
const refuse = (status: number, error: string) => reply(status, { error })

function checkPassword(password: unknown): string | null {
  if (typeof password !== 'string' || password.length < 8) return 'Passwords need at least 8 characters.'
  if (password.length > 72) return 'Passwords can be at most 72 characters.'
  return null
}

function cleanUsername(username: unknown): string | null {
  const u = typeof username === 'string' ? username.trim().toLowerCase() : ''
  return USERNAME.test(u) ? u : null
}

const BAD_USERNAME = 'Usernames are 3 to 32 small letters, numbers, dots, dashes or underscores, starting with a letter or number.'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return refuse(405, 'Use POST.')

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return refuse(401, 'Sign in first.')

  // Who is asking, checked with Supabase Auth and then against the team.
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } })
  const { data: who, error: whoError } = await caller.auth.getUser(token)
  if (whoError || !who.user) return refuse(401, 'Your sign-in has expired. Sign in again.')
  const [{ data: allowed }, { data: me }] = await Promise.all([caller.rpc('can_manage_logins'), caller.rpc('current_employee_id')])
  if (allowed !== true) return refuse(403, 'You are not allowed to give out logins. Ask someone who is to allow it in Settings → Permissions.')

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return refuse(400, 'The request was not understood.')
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: emp, error: empError } = await admin
    .from('employees')
    .select('id, name, active, user_id, username')
    .eq('id', String(body.employee_id ?? ''))
    .maybeSingle()
  if (empError) return refuse(500, empError.message)
  if (!emp) return refuse(404, 'That team member was not found.')

  const usernameFree = async (username: string) => {
    const { data } = await admin.from('employees').select('id').eq('username', username).neq('id', emp.id).maybeSingle()
    return !data
  }

  switch (body.action) {
    case 'create': {
      const username = cleanUsername(body.username)
      if (!username) return refuse(400, BAD_USERNAME)
      const bad = checkPassword(body.password)
      if (bad) return refuse(400, bad)
      if (!emp.active) return refuse(400, `${emp.name} is not active. Make them active on the Team page first.`)
      if (emp.user_id) return refuse(409, `${emp.name} already has a login.`)
      if (!(await usernameFree(username))) return refuse(409, `The username "${username}" is taken.`)

      const email = `${username}@${DOMAIN}`
      // Let exactly this sign-in through the database's check, for this person.
      const { error: grantError } = await admin.rpc('grant_login', { p_employee_id: emp.id, p_email: email })
      if (grantError) return refuse(500, grantError.message)
      const { error } = await admin.auth.admin.createUser({ email, password: body.password as string, email_confirm: true, app_metadata: { employee_id: emp.id } })
      if (error) {
        await admin.rpc('drop_login_grant', { p_email: email })
        if (/already|registered|exists/i.test(error.message)) return refuse(409, `The username "${username}" is taken.`)
        return refuse(400, error.message)
      }
      const { error: nameError } = await admin.from('employees').update({ username }).eq('id', emp.id)
      if (nameError) return refuse(500, nameError.message)
      return reply(200, { username })
    }

    case 'reset_password': {
      const bad = checkPassword(body.password)
      if (bad) return refuse(400, bad)
      if (!emp.user_id) return refuse(400, `${emp.name} has no login yet.`)
      const { error } = await admin.auth.admin.updateUserById(emp.user_id, { password: body.password as string })
      if (error) return refuse(400, error.message)
      return reply(200, { ok: true })
    }

    case 'rename': {
      const username = cleanUsername(body.username)
      if (!username) return refuse(400, BAD_USERNAME)
      if (!emp.user_id) return refuse(400, `${emp.name} has no login yet.`)
      if (!(await usernameFree(username))) return refuse(409, `The username "${username}" is taken.`)
      const { error } = await admin.auth.admin.updateUserById(emp.user_id, { email: `${username}@${DOMAIN}`, email_confirm: true })
      if (error) return refuse(/already|registered|exists/i.test(error.message) ? 409 : 400, /already|registered|exists/i.test(error.message) ? `The username "${username}" is taken.` : error.message)
      const { error: nameError } = await admin.from('employees').update({ username }).eq('id', emp.id)
      if (nameError) return refuse(500, nameError.message)
      return reply(200, { username })
    }

    case 'remove': {
      if (emp.id === me) return refuse(400, 'You cannot remove your own login.')
      if (!emp.user_id) return reply(200, { ok: true })
      const { error } = await admin.auth.admin.deleteUser(emp.user_id)
      if (error) return refuse(400, error.message)
      // Deleting the sign-in already cleared user_id; the username goes with it.
      await admin.from('employees').update({ username: null }).eq('id', emp.id)
      return reply(200, { ok: true })
    }

    default:
      return refuse(400, 'Unknown action.')
  }
})

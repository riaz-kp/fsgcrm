/**
 * Team logins. The admin or the CEO gives each person a username and password; nobody signs up or resets
 * their own. Supabase Auth signs in by email, so a username is kept as <username>@fsg.local, an address
 * no mail is ever sent to. The work is done by the staff-logins Edge Function (supabase/functions).
 */
import { supabase } from './supabase'

export const LOGIN_DOMAIN = 'fsg.local'
export const USERNAME_RULE = /^[a-z0-9][a-z0-9._-]{2,31}$/
export const USERNAME_HINT = '3 to 32 small letters, numbers, dots, dashes or underscores'
export const MIN_PASSWORD = 8

/** What goes to Supabase Auth for what was typed in the username box. An email still works, for a login made before usernames. */
export function signInEmail(typed: string): string {
  const v = typed.trim().toLowerCase()
  return v.includes('@') ? v : `${v}@${LOGIN_DOMAIN}`
}

/** The first name ("Harikrishna" → harikrishna), or the whole name when that is too short ("K Anna" → k.anna); a number is added if it is taken. */
export function suggestUsername(name: string, taken: Set<string>): string {
  const words = name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, '')
    .split(/\s+/)
    .filter(Boolean)
  let base = words[0] ?? ''
  if (base.length < 3) base = words.join('.')
  base = (base.length >= 3 ? base : `${base}user`).slice(0, 28)
  if (!taken.has(base)) return base
  for (let n = 2; ; n++) if (!taken.has(`${base}${n}`)) return `${base}${n}`
}

// No 0/O, 1/l/I: these get read out or copied by hand.
const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'

/** A random password of `length` characters with at least one letter and one digit. */
export function newPassword(length = 10): string {
  for (;;) {
    const out: string[] = []
    while (out.length < length) {
      for (const b of crypto.getRandomValues(new Uint8Array(length * 2))) {
        // Throw away bytes past the last whole run of the alphabet, so every character is equally likely.
        if (b < 256 - (256 % ALPHABET.length) && out.length < length) out.push(ALPHABET[b % ALPHABET.length])
      }
    }
    const pw = out.join('')
    if (/\d/.test(pw) && /[a-z]/i.test(pw)) return pw
  }
}

export type LoginRequest =
  | { action: 'create'; employee_id: string; username: string; password: string }
  | { action: 'reset_password'; employee_id: string; password: string }
  | { action: 'rename'; employee_id: string; username: string }
  | { action: 'remove'; employee_id: string }

/** Ask the staff-logins function to do it; throws with its explanation when it says no. */
export async function manageLogin(request: LoginRequest): Promise<{ username?: string }> {
  if (!supabase) throw new Error('Logins can only be managed when the app is connected to the database')
  const { data, error } = await supabase.functions.invoke('staff-logins', { body: request })
  if (error) {
    let message = error.message
    const response = (error as { context?: unknown }).context
    if (response instanceof Response) {
      try {
        const body = (await response.json()) as { error?: string }
        if (body.error) message = body.error
      } catch {
        // Keep the general message.
      }
    }
    throw new Error(message)
  }
  return (data ?? {}) as { username?: string }
}

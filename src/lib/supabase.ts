import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY)?.trim()

/** The connection to the firm's database, or null when the app runs on sample data. */
export const supabase = url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null

/**
 * How the app runs:
 * - `live`: signed-in staff working on the database.
 * - `demo`: made-up sample data kept in this browser. Only when developing, or when a build asks for it with VITE_DEMO.
 * - `unconfigured`: a production build with no database settings. It says so rather than quietly falling back to sample data
 *   that someone might start entering real work into.
 */
export const MODE: 'live' | 'demo' | 'unconfigured' = supabase ? 'live' : import.meta.env.DEV || import.meta.env.VITE_DEMO === 'true' ? 'demo' : 'unconfigured'

export const LIVE = MODE === 'live'

/** Client documents and call recordings. */
export const FILES_BUCKET = 'client-files'

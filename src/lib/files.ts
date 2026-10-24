/**
 * Client documents and call recordings, kept in a private Supabase Storage bucket. A file is only ever
 * reached through a link that lasts a minute, made for someone signed in to the team.
 */
import { uid } from './format'
import { FILES_BUCKET, supabase } from './supabase'

/** Matches the bucket's limit in the database migration. */
export const MAX_FILE_MB = 50

/** Store a file under the client's folder and return where it went. */
export async function uploadClientFile(clientId: string, file: File): Promise<string> {
  if (!supabase) throw new Error('Files can only be stored when the app is connected to the database')
  if (file.size > MAX_FILE_MB * 1024 * 1024) throw new Error(`${file.name} is larger than ${MAX_FILE_MB} MB`)
  const safe = file.name.replace(/[^\w.-]+/g, '_').slice(-120) || 'file'
  const path = `${clientId}/${uid('f')}-${safe}`
  const { error } = await supabase.storage.from(FILES_BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: false })
  if (error) throw new Error(`Could not upload ${file.name}: ${error.message}`)
  return path
}

/** Open a stored file in a new tab. The tab is opened first, while the click still counts, so pop-up blockers let it through. */
export async function openClientFile(path: string, name: string) {
  if (!supabase) return
  const tab = window.open('about:blank', '_blank')
  const { data, error } = await supabase.storage.from(FILES_BUCKET).createSignedUrl(path, 60, { download: name })
  if (error || !data) {
    tab?.close()
    throw new Error(`Could not open ${name}: ${error?.message ?? 'no link'}`)
  }
  if (tab) {
    tab.opener = null
    tab.location.href = data.signedUrl
  } else window.location.assign(data.signedUrl)
}

export async function removeClientFile(path: string) {
  if (!supabase) return
  const { error } = await supabase.storage.from(FILES_BUCKET).remove([path])
  if (error) throw new Error(`Could not remove the file: ${error.message}`)
}

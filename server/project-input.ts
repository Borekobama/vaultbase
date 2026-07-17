import { z } from 'zod'

export const projectInputSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  plan: z.enum(['free', 'pro', 'team', 'enterprise']),
  databaseUrl: z.string().trim().min(20).max(2048),
  backupSchedule: z.string().trim().min(1).max(100).default('0 3 * * *'),
  keepAliveSchedule: z.string().trim().max(100).nullable().default(null),
  backupMode: z.enum(['database', 'full_project']).default('database'),
})

export function normalizeProjectId(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 63)
}

export function parseSupabaseDatabaseUrl(raw: string) {
  let url: URL
  try { url = new URL(raw) } catch { throw new Error('Enter a valid PostgreSQL connection string.') }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('The connection string must use PostgreSQL.')
  if (!url.password || url.password === '[YOUR-PASSWORD]') throw new Error('Replace [YOUR-PASSWORD] with the database password.')
  if (url.hostname.endsWith('.pooler.supabase.com') && url.port === '6543') throw new Error('Use the Session Pooler on port 5432 for backups, not Transaction mode on port 6543.')

  const usernameRef = decodeURIComponent(url.username).match(/^postgres\.([a-z0-9]+)$/i)?.[1]
  const directRef = url.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/i)?.[1]
  const projectRef = usernameRef ?? directRef
  if (!projectRef) throw new Error('Could not derive the Supabase project reference from this connection string.')
  const region = url.hostname.match(/^aws-\d+-([a-z]+-[a-z]+-\d+)\.pooler\.supabase\.com$/i)?.[1] ?? null

  return { projectRef, region, connectionType: url.hostname.includes('.pooler.supabase.com') ? 'session_pooler' : 'direct' as const }
}

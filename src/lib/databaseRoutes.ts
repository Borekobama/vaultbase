export interface DatabaseRouteFields {
  projectRef: string
  databaseUser: string
  password: string
  poolerRegion: string
  includeDirect: boolean
}

export interface DatabaseRouteUrls {
  sessionUrl: string
  directUrl: string
}

export const DEFAULT_POOLER_REGION = 'aws-0-eu-west-1'
const PROJECT_REF_PATTERN = /^[a-z0-9]{8,64}$/

function encode(value: string) {
  return encodeURIComponent(value)
}

export function normalizeSupabaseProjectRef(value: string) {
  let normalized = value.trim().toLowerCase()
  if (!normalized) return ''

  if (normalized.includes('://')) {
    try {
      const url = new URL(normalized)
      normalized = url.hostname
    } catch {
      return ''
    }
  }

  normalized = normalized
    .replace(/^db\./, '')
    .replace(/\.supabase\.co$/, '')

  return PROJECT_REF_PATTERN.test(normalized) ? normalized : ''
}

export function poolerHostname(value: string) {
  const trimmed = value.trim().toLowerCase()
  return trimmed.endsWith('.pooler.supabase.com') ? trimmed : `${trimmed}.pooler.supabase.com`
}

export function buildDatabaseRoutes(fields: DatabaseRouteFields): DatabaseRouteUrls {
  const projectRef = normalizeSupabaseProjectRef(fields.projectRef)
  const databaseUser = fields.databaseUser.trim()
  const password = fields.password
  const poolerRegion = fields.poolerRegion.trim()
  if (!projectRef || !databaseUser || !password || !poolerRegion) return { sessionUrl: '', directUrl: '' }
  return {
    sessionUrl: `postgresql://${encode(`${databaseUser}.${projectRef}`)}:${encode(password)}@${poolerHostname(poolerRegion)}:5432/postgres`,
    directUrl: fields.includeDirect
      ? `postgresql://${encode(databaseUser)}:${encode(password)}@db.${projectRef}.supabase.co:5432/postgres`
      : '',
  }
}

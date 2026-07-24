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

function encode(value: string) {
  return encodeURIComponent(value)
}

export function poolerHostname(value: string) {
  const trimmed = value.trim().toLowerCase()
  return trimmed.endsWith('.pooler.supabase.com') ? trimmed : `${trimmed}.pooler.supabase.com`
}

export function buildDatabaseRoutes(fields: DatabaseRouteFields): DatabaseRouteUrls {
  const projectRef = fields.projectRef.trim().toLowerCase()
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

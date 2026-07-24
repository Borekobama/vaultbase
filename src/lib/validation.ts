import type { NewProjectInput } from '../domain'

export type FieldErrors = Partial<Record<keyof NewProjectInput, string>>

export function normalizeProjectId(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function validateProject(input: NewProjectInput, existingIds: string[]): FieldErrors {
  const errors: FieldErrors = {}
  const id = normalizeProjectId(input.name)
  if (!id) errors.name = 'Enter a project name using letters or numbers.'
  else if (id.length > 63) errors.name = 'Project names must be 63 characters or fewer.'
  else if (existingIds.includes(id)) errors.name = 'A project with this name already exists.'

  try {
    const url = new URL(input.databaseUrl)
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) errors.databaseUrl = 'Use a PostgreSQL connection string.'
    else if (!url.hostname || !url.username || !url.password) errors.databaseUrl = 'The connection string must include a host, username, and password.'
    else if (url.hostname.endsWith('.pooler.supabase.com') && url.port === '6543') errors.databaseUrl = 'Use Session Pooler port 5432 for backups, not Transaction mode 6543.'
    else if (!/^[a-z_][a-z0-9_-]*\.[a-z0-9]+$/i.test(decodeURIComponent(url.username)) && !/^db\.[a-z0-9]+\.supabase\.co$/i.test(url.hostname)) errors.databaseUrl = 'Use a Supabase Direct or Session Pooler connection string.'
    else if (decodeURIComponent(url.username).split('.')[0].toLowerCase() === 'postgres') errors.databaseUrl = 'Use the dedicated vaultbase_backup role, not the powerful default postgres user.'
  } catch {
    errors.databaseUrl = 'Enter a valid PostgreSQL connection string.'
  }

  if (input.directDatabaseUrl?.trim()) {
    try {
      const direct = new URL(input.directDatabaseUrl)
      if (!['postgres:', 'postgresql:'].includes(direct.protocol)) errors.directDatabaseUrl = 'Use a PostgreSQL connection string.'
      else if (!direct.hostname || !direct.username || !direct.password) errors.directDatabaseUrl = 'The connection string must include a host, username, and password.'
      else if (!/^db\.[a-z0-9]+\.supabase\.co$/i.test(direct.hostname)) errors.directDatabaseUrl = 'Use the Direct connection from Supabase Connect.'
      else if (direct.port === '6543') errors.directDatabaseUrl = 'Use Direct port 5432, not Dedicated Pooler port 6543.'
      else if (decodeURIComponent(direct.username).split('.')[0].toLowerCase() === 'postgres') errors.directDatabaseUrl = 'Use the dedicated vaultbase_backup role, not the powerful default postgres user.'
      else {
        const sessionRef = decodeURIComponent(new URL(input.databaseUrl).username).match(/\.([a-z0-9]+)$/i)?.[1]
        const directRef = direct.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/i)?.[1]
        if (sessionRef && directRef !== sessionRef) errors.directDatabaseUrl = 'The Direct and Session URLs must belong to the same project.'
      }
    } catch {
      errors.directDatabaseUrl = 'Enter a valid Direct PostgreSQL connection string.'
    }
  }

  if (!['free', 'pro', 'team'].includes(input.plan)) errors.plan = 'Choose a supported Supabase plan.'
  if (!['database', 'full_project'].includes(input.backupMode)) errors.backupMode = 'Choose a protection mode.'
  return errors
}

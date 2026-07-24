import { describe, expect, it } from 'vitest'
import { normalizeProjectId, validateProject } from './validation'

const valid = { name: 'Customer Portal', plan: 'free' as const, backupMode: 'database' as const, databaseUrl: 'postgresql://vaultbase_backup.abcdefghijkl:password@aws-0-eu-central-1.pooler.supabase.com:5432/postgres', backupSchedule: 'Daily', keepAliveSchedule: 'Every 3 days' }

describe('project validation', () => {
  it('normalizes human names into stable ids', () => {
    expect(normalizeProjectId('  Café & Sales  ')).toBe('caf-sales')
    expect(normalizeProjectId('العربية')).toBe('')
  })

  it('accepts a complete PostgreSQL connection', () => {
    expect(validateProject(valid, [])).toEqual({})
  })

  it('accepts a dedicated backup role through the session pooler', () => {
    expect(validateProject({ ...valid, databaseUrl: 'postgresql://vaultbase_backup.abcdefghijkl:password@aws-0-eu-central-1.pooler.supabase.com:5432/postgres' }, [])).toEqual({})
  })

  it('accepts a matching Direct fallback and rejects a mismatched one', () => {
    expect(validateProject({ ...valid, directDatabaseUrl: 'postgresql://vaultbase_backup:password@db.abcdefghijkl.supabase.co:5432/postgres' }, [])).toEqual({})
    const errors = validateProject({ ...valid, directDatabaseUrl: 'postgresql://vaultbase_backup:password@db.differentref.supabase.co:5432/postgres' }, [])
    expect(errors.directDatabaseUrl).toMatch(/same project/i)
  })

  it('rejects the default postgres credential', () => {
    const errors = validateProject({ ...valid, databaseUrl: 'postgresql://postgres.abcdefghijkl:password@aws-0-eu-central-1.pooler.supabase.com:5432/postgres' }, [])
    expect(errors.databaseUrl).toMatch(/vaultbase_backup/i)
  })

  it('rejects duplicate names and incomplete secrets', () => {
    const errors = validateProject({ ...valid, databaseUrl: 'postgresql://host/postgres' }, ['customer-portal'])
    expect(errors.name).toMatch(/already exists/i)
    expect(errors.databaseUrl).toMatch(/username, and password/i)
  })

  it('rejects invalid protocols', () => {
    const errors = validateProject({ ...valid, databaseUrl: 'https://example.com' }, [])
    expect(errors.databaseUrl).toMatch(/PostgreSQL/i)
  })
})

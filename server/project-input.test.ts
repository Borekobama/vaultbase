import { describe, expect, it } from 'vitest'
import { invalidOptionalDirectRoute, parseSupabaseDatabaseUrl, projectInputSchema, projectUpdateSchema } from './project-input'

describe('Supabase database connection parsing', () => {
  it('derives the project reference and region from a session pooler URL', () => {
    expect(parseSupabaseDatabaseUrl('postgresql://backup_reader.abcdefghijkl:password@aws-0-eu-north-1.pooler.supabase.com:5432/postgres')).toEqual({
      projectRef: 'abcdefghijkl', region: 'eu-north-1', connectionType: 'session_pooler',
    })
  })

  it('accepts a dedicated backup role through the session pooler', () => {
    expect(parseSupabaseDatabaseUrl('postgresql://vaultbase_backup.abcdefghijkl:password@aws-0-eu-north-1.pooler.supabase.com:5432/postgres')).toEqual({
      projectRef: 'abcdefghijkl', region: 'eu-north-1', connectionType: 'session_pooler',
    })
  })

  it('derives the project reference from a direct URL', () => {
    expect(parseSupabaseDatabaseUrl('postgresql://vaultbase_backup:password@db.abcdefghijkl.supabase.co:5432/postgres')).toMatchObject({
      projectRef: 'abcdefghijkl', region: null, connectionType: 'direct',
    })
  })

  it('rejects the powerful default postgres credential', () => {
    expect(() => parseSupabaseDatabaseUrl('postgresql://postgres.abcdefghijkl:password@aws-0-eu-north-1.pooler.supabase.com:5432/postgres')).toThrow(/dedicated vaultbase_backup role/i)
  })

  it('rejects the transaction pooler for backup jobs', () => {
    expect(() => parseSupabaseDatabaseUrl('postgresql://postgres.abcdefghijkl:password@aws-0-eu-north-1.pooler.supabase.com:6543/postgres')).toThrow(/Session Pooler.*5432/i)
  })

  it('rejects invalid cron expressions at the API boundary', () => {
    const result = projectInputSchema.safeParse({
      displayName: 'Example project', plan: 'free', databaseUrl: 'postgresql://vaultbase_backup.abcdefghijkl:password@aws-0-eu-north-1.pooler.supabase.com:5432/postgres',
      backupSchedule: 'definitely not cron', keepAliveSchedule: null, backupMode: 'database',
    })
    expect(result.success).toBe(false)
  })

  it('accepts valid backup and keep-alive cron expressions', () => {
    const result = projectInputSchema.safeParse({
      displayName: 'Example project', ownerEmail: 'owner@example.com', plan: 'free', databaseUrl: 'postgresql://vaultbase_backup.abcdefghijkl:password@aws-0-eu-north-1.pooler.supabase.com:5432/postgres',
      backupSchedule: '0 */6 * * *', keepAliveSchedule: '0 9 */3 * *', backupMode: 'database',
      storageCredentials: {
        endpoint: 'https://abcdefghijkl.storage.supabase.co/storage/v1/s3',
        region: 'eu-north-1',
        accessKeyId: 'storage-access-key',
        secretAccessKey: 'storage-secret-value',
      },
    })
    expect(result.success).toBe(true)
  })

  it('rejects an invalid owner email', () => {
    expect(projectInputSchema.safeParse({
      displayName: 'Example project', ownerEmail: 'not-an-email', plan: 'free',
      databaseUrl: 'postgresql://vaultbase_backup.abcdefghijkl:password@aws-0-eu-north-1.pooler.supabase.com:5432/postgres',
      backupSchedule: '0 3 * * *', keepAliveSchedule: null, backupMode: 'database',
    }).success).toBe(false)
  })

  it('accepts a matching optional Direct fallback', () => {
    const result = projectInputSchema.safeParse({
      displayName: 'Example project', plan: 'free',
      databaseUrl: 'postgresql://vaultbase_backup.abcdefghijkl:password@aws-0-eu-north-1.pooler.supabase.com:5432/postgres',
      directDatabaseUrl: 'postgresql://vaultbase_backup:password@db.abcdefghijkl.supabase.co:5432/postgres',
      backupSchedule: '0 3 * * *', keepAliveSchedule: null, backupMode: 'database',
    })
    expect(result.success).toBe(true)
  })

  it('accepts a project without the optional Direct route', () => {
    const result = projectInputSchema.safeParse({
      displayName: 'Session only project', plan: 'pro',
      databaseUrl: 'postgresql://vaultbase_backup.abcdefghijkl:password@aws-0-eu-north-1.pooler.supabase.com:5432/postgres',
      backupSchedule: '0 3 * * *', keepAliveSchedule: null, backupMode: 'full_project',
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.directDatabaseUrl).toBeUndefined()
  })

  it('does not reject an omitted optional Direct route', () => {
    expect(invalidOptionalDirectRoute(null)).toBe(false)
    expect(invalidOptionalDirectRoute(parseSupabaseDatabaseUrl(
      'postgresql://vaultbase_backup:password@db.abcdefghijkl.supabase.co:5432/postgres',
    ))).toBe(false)
    expect(invalidOptionalDirectRoute(parseSupabaseDatabaseUrl(
      'postgresql://vaultbase_backup.abcdefghijkl:password@aws-0-eu-north-1.pooler.supabase.com:5432/postgres',
    ))).toBe(true)
  })

  it('rejects the dedicated transaction pooler as a Direct route', () => {
    expect(() => parseSupabaseDatabaseUrl('postgresql://vaultbase_backup:password@db.abcdefghijkl.supabase.co:6543/postgres')).toThrow(/Direct connection.*5432/i)
  })

  it('validates editable project profile details', () => {
    expect(projectUpdateSchema.safeParse({
      displayName: 'Customer Production',
      ownerEmail: 'owner@example.com',
      environment: 'production',
      notes: 'Customer accounts and billing.',
      plan: 'free',
      backupSchedule: '0 3 * * *',
      keepAliveSchedule: '0 9 */3 * *',
      backupMode: 'full_project',
    }).success).toBe(true)
    expect(projectUpdateSchema.safeParse({
      displayName: 'Customer Production',
      environment: 'production',
      notes: '',
      plan: 'pro',
      backupSchedule: '0 3 * * *',
      keepAliveSchedule: '0 9 */3 * *',
      backupMode: 'database',
    }).success).toBe(false)
  })
})

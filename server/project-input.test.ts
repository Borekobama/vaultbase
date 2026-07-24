import { describe, expect, it } from 'vitest'
import { parseSupabaseDatabaseUrl, projectInputSchema, projectUpdateSchema } from './project-input'

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
      displayName: 'Example project', plan: 'free', databaseUrl: 'postgresql://vaultbase_backup.abcdefghijkl:password@aws-0-eu-north-1.pooler.supabase.com:5432/postgres',
      backupSchedule: '0 */6 * * *', keepAliveSchedule: '0 9 */3 * *', backupMode: 'database',
    })
    expect(result.success).toBe(true)
  })

  it('validates editable project profile details', () => {
    expect(projectUpdateSchema.safeParse({
      displayName: 'Customer Production',
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

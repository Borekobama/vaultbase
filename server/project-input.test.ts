import { describe, expect, it } from 'vitest'
import { parseSupabaseDatabaseUrl } from './project-input'

describe('Supabase database connection parsing', () => {
  it('derives the project reference and region from a session pooler URL', () => {
    expect(parseSupabaseDatabaseUrl('postgresql://postgres.abcdefghijkl:password@aws-0-eu-north-1.pooler.supabase.com:5432/postgres')).toEqual({
      projectRef: 'abcdefghijkl', region: 'eu-north-1', connectionType: 'session_pooler',
    })
  })

  it('derives the project reference from a direct URL', () => {
    expect(parseSupabaseDatabaseUrl('postgresql://postgres:password@db.abcdefghijkl.supabase.co:5432/postgres')).toMatchObject({
      projectRef: 'abcdefghijkl', region: null, connectionType: 'direct',
    })
  })

  it('rejects the transaction pooler for backup jobs', () => {
    expect(() => parseSupabaseDatabaseUrl('postgresql://postgres.abcdefghijkl:password@aws-0-eu-north-1.pooler.supabase.com:6543/postgres')).toThrow(/Session Pooler.*5432/i)
  })
})

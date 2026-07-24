import { describe, expect, it } from 'vitest'
import { buildDatabaseRoutes, poolerHostname } from './databaseRoutes'

describe('database route builder', () => {
  it('builds Session and Direct URLs with the backup-role password safely encoded', () => {
    expect(buildDatabaseRoutes({
      projectRef: 'abcdefghijkl',
      databaseUser: 'vaultbase_backup',
      password: 'a$b%s p',
      poolerRegion: 'aws-0-eu-west-1',
      includeDirect: true,
    })).toEqual({
      sessionUrl: 'postgresql://vaultbase_backup.abcdefghijkl:a%24b%25s%20p@aws-0-eu-west-1.pooler.supabase.com:5432/postgres',
      directUrl: 'postgresql://vaultbase_backup:a%24b%25s%20p@db.abcdefghijkl.supabase.co:5432/postgres',
    })
  })

  it('accepts either the pooler region prefix or complete hostname', () => {
    expect(poolerHostname('aws-0-eu-north-1')).toBe('aws-0-eu-north-1.pooler.supabase.com')
    expect(poolerHostname('aws-0-eu-north-1.pooler.supabase.com')).toBe('aws-0-eu-north-1.pooler.supabase.com')
  })

  it('can omit the Direct fallback', () => {
    expect(buildDatabaseRoutes({
      projectRef: 'abcdefghijkl', databaseUser: 'vaultbase_backup', password: 'password',
      poolerRegion: 'aws-0-eu-west-1', includeDirect: false,
    }).directUrl).toBe('')
  })
})

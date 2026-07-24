import { describe, expect, it } from 'vitest'
import { BACKUP_ROLE_SQL } from './backupRoleTemplate'

describe('backup role SQL template', () => {
  it('is rerunnable and verifies that the predefined write role is absent', () => {
    expect(BACKUP_ROLE_SQL).toContain("IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vaultbase_backup')")
    expect(BACKUP_ROLE_SQL).toContain('GRANT pg_read_all_data TO vaultbase_backup')
    expect(BACKUP_ROLE_SQL).toContain("pg_has_role('vaultbase_backup', 'pg_write_all_data', 'MEMBER')")
    expect(BACKUP_ROLE_SQL).not.toContain('REVOKE pg_write_all_data FROM vaultbase_backup')
    expect(BACKUP_ROLE_SQL).toContain('BYPASSRLS')
    expect(BACKUP_ROLE_SQL).toContain('default_transaction_read_only = on')
  })

  it('refuses to run until the password placeholder is replaced', () => {
    expect(BACKUP_ROLE_SQL).toContain("RAISE EXCEPTION 'Replace the placeholder")
  })
})

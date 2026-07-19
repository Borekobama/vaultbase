ALTER TABLE vaultbase.snapshots DROP CONSTRAINT IF EXISTS snapshots_status_check;
ALTER TABLE vaultbase.snapshots ADD CONSTRAINT snapshots_status_check
  CHECK (status IN ('running', 'uploaded', 'verified', 'restore_verified', 'failed', 'expired'));

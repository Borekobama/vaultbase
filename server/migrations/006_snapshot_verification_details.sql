ALTER TABLE vaultbase.snapshots
  ADD COLUMN IF NOT EXISTS verification_details jsonb NOT NULL DEFAULT '{}'::jsonb;

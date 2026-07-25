ALTER TABLE vaultbase.snapshots
  ADD COLUMN IF NOT EXISTS trigger_source text NOT NULL DEFAULT 'scheduled';

ALTER TABLE vaultbase.snapshots
  DROP CONSTRAINT IF EXISTS snapshots_trigger_source_check;

ALTER TABLE vaultbase.snapshots
  ADD CONSTRAINT snapshots_trigger_source_check
  CHECK (trigger_source IN ('manual', 'scheduled'));

UPDATE vaultbase.snapshots snapshot
SET trigger_source = 'manual'
FROM vaultbase.jobs job
WHERE job.job_type = 'backup'
  AND job.result->>'snapshotId' = snapshot.id::text;
